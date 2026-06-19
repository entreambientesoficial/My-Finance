import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';

@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService) {}

  async create(householdId: string, dto: CreateCardDto) {
    const data: any = { ...dto };
    if (data.accountId === '') data.accountId = null;
    if (data.lastFourDigits === '') data.lastFourDigits = null;
    return this.prisma.card.create({
      data: {
        ...data,
        householdId,
      },
    });
  }

  async findAll(householdId: string) {
    return this.prisma.card.findMany({
      where: { householdId, isActive: true },
      include: {
        account: {
          select: {
            name: true,
            balance: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, householdId: string) {
    const card = await this.prisma.card.findFirst({
      where: { id, householdId, isActive: true },
      include: {
        account: {
          select: {
            name: true,
            balance: true,
          },
        },
      },
    });
    if (!card) {
      throw new NotFoundException('Cartão não encontrado');
    }
    return card;
  }

  async update(id: string, householdId: string, dto: Partial<CreateCardDto>) {
    await this.findOne(id, householdId);
    const data: any = { ...dto };
    if (data.accountId === '') data.accountId = null;
    if (data.lastFourDigits === '') data.lastFourDigits = null;
    return this.prisma.card.update({
      where: { id },
      data,
    });
  }

  async toggleFreeze(id: string, householdId: string) {
    const card = await this.findOne(id, householdId);
    return this.prisma.card.update({
      where: { id },
      data: { isFrozen: !card.isFrozen },
    });
  }

  async getInvoiceSummary(id: string, householdId: string, month: number, year: number) {
    await this.findOne(id, householdId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: { cardId: id, date: { gte: startDate, lte: endDate } },
      include: { category: { select: { name: true, color: true, icon: true } } },
      orderBy: { date: 'desc' },
    });

    const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    return { total, transactions };
  }

  async remove(id: string, householdId: string) {
    await this.findOne(id, householdId);
    return this.prisma.card.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
