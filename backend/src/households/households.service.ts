import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class HouseholdsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async findMine(householdId: string) {
    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
      include: {
        users: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
    if (!household) throw new NotFoundException('Household não encontrado');
    return household;
  }

  async update(householdId: string, dto: UpdateHouseholdDto) {
    return this.prisma.household.update({
      where: { id: householdId },
      data: dto,
    });
  }

  async summary(householdId: string) {
    const [accounts, cards, goals, budgets] = await Promise.all([
      this.prisma.account.findMany({
        where: { householdId, isActive: true },
        select: { id: true, name: true, type: true, balance: true, currency: true },
      }),
      this.prisma.card.findMany({
        where: { householdId, isActive: true },
        select: { id: true, name: true, brand: true, creditLimit: true },
      }),
      this.prisma.goal.findMany({
        where: { householdId, isCompleted: false },
        select: { id: true, name: true, targetAmount: true, currentAmount: true },
      }),
      this.prisma.budget.findMany({
        where: { householdId, isActive: true },
        select: { id: true, name: true, amount: true, period: true },
      }),
    ]);

    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
    return { accounts, cards, goals, budgets, totalBalance };
  }

  async inviteMember(householdId: string, inviterUserId: string, email: string) {
    // Check if user is already in this household
    const existing = await this.prisma.user.findFirst({ where: { email, householdId } });
    if (existing) throw new BadRequestException('Usuário já faz parte da família');

    // Expire old pending invites for same email/household
    await this.prisma.invite.deleteMany({ where: { householdId, email, acceptedAt: null } });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    const invite = await this.prisma.invite.create({
      data: { householdId, email, token, expiresAt },
    });

    const [household, inviter] = await Promise.all([
      this.prisma.household.findUnique({ where: { id: householdId } }),
      this.prisma.user.findUnique({ where: { id: inviterUserId } }),
    ]);

    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`;
    await this.mail.sendInvite(email, inviter!.name, household!.name, inviteLink);

    return { message: `Convite enviado para ${email}`, token };
  }

  async getPendingInvites(householdId: string) {
    return this.prisma.invite.findMany({
      where: { householdId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelInvite(householdId: string, inviteId: string) {
    await this.prisma.invite.deleteMany({ where: { id: inviteId, householdId } });
    return { message: 'Convite cancelado' };
  }
}
