import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(householdId: string, dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: { ...dto, householdId },
    });
  }

  async findAll(householdId: string) {
    return this.prisma.account.findMany({
      where: { householdId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, householdId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, householdId },
    });
    if (!account) throw new NotFoundException('Conta não encontrada');
    return account;
  }

  async update(id: string, householdId: string, dto: Partial<CreateAccountDto>) {
    await this.findOne(id, householdId);
    return this.prisma.account.update({ where: { id }, data: dto });
  }

  async remove(id: string, householdId: string) {
    await this.findOne(id, householdId);
    return this.prisma.account.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
