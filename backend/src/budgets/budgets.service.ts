import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  async create(householdId: string, dto: CreateBudgetDto) {
    const data = {
      ...dto,
      householdId,
      categoryId: dto.categoryId || null,
    };
    return this.prisma.budget.create({ data });
  }

  async findAll(householdId: string, month?: number, year?: number) {
    return this.prisma.budget.findMany({
      where: {
        householdId,
        isActive: true,
        ...(month && { month }),
        ...(year && { year }),
      },
      include: { category: { select: { id: true, name: true, color: true, icon: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findWithProgress(householdId: string, month: number, year: number) {
    const budgets = await this.findAll(householdId, month, year);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await this.prisma.transaction.aggregate({
          where: {
            householdId,
            type: 'EXPENSE',
            isPaid: true,
            date: { gte: startDate, lte: endDate },
            ...(budget.categoryId && { categoryId: budget.categoryId }),
          },
          _sum: { amount: true },
        });
        const spentAmount = Number(spent._sum.amount || 0);
        return {
          ...budget,
          spent: spentAmount,
          remaining: Number(budget.amount) - spentAmount,
          percentage: Math.min(100, Math.round((spentAmount / Number(budget.amount)) * 100)),
        };
      }),
    );

    return result;
  }

  async update(id: string, householdId: string, dto: Partial<CreateBudgetDto>) {
    const budget = await this.prisma.budget.findFirst({ where: { id, householdId } });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    const data = {
      ...dto,
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId || null }),
    };
    return this.prisma.budget.update({ where: { id }, data });
  }

  async remove(id: string, householdId: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id, householdId } });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    return this.prisma.budget.update({ where: { id }, data: { isActive: false } });
  }
}
