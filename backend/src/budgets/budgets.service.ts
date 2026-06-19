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
    // 1. Fetch all expense categories
    const categories = await this.prisma.category.findMany({
      where: { householdId, type: 'EXPENSE' },
    });

    // 2. Fetch manual budgets for this month/year
    const manualBudgets = await this.prisma.budget.findMany({
      where: { householdId, month, year, isActive: true },
    });

    const currentMonthStart = new Date(year, month - 1, 1);
    const currentMonthEnd = new Date(year, month, 0, 23, 59, 59);

    const pastStart = new Date(year, month - 4, 1);
    const pastEnd = new Date(year, month - 1, 0, 23, 59, 59);

    const results = await Promise.all(
      categories.map(async (category) => {
        // Find if there is a manual budget
        const manualBudget = manualBudgets.find(b => b.categoryId === category.id);

        // Spent in current month
        const currentSpent = await this.prisma.transaction.aggregate({
          where: {
            householdId,
            type: 'EXPENSE',
            isPaid: true,
            categoryId: category.id,
            date: { gte: currentMonthStart, lte: currentMonthEnd },
          },
          _sum: { amount: true },
        });

        // Spent in previous 3 months
        const pastSpent = await this.prisma.transaction.aggregate({
          where: {
            householdId,
            type: 'EXPENSE',
            isPaid: true,
            categoryId: category.id,
            date: { gte: pastStart, lte: pastEnd },
          },
          _sum: { amount: true },
        });

        const spentThisMonth = Number(currentSpent._sum.amount || 0);
        const spentPastThreeMonths = Number(pastSpent._sum.amount || 0);
        const pastAverage = spentPastThreeMonths / 3;

        let limit = 500;
        let isAutomatic = true;

        if (manualBudget) {
          limit = Number(manualBudget.amount);
          isAutomatic = false;
        } else {
          // Calculate suggested limit
          let rawLimit = pastAverage;
          if (rawLimit <= 0) {
            rawLimit = spentThisMonth > 0 ? spentThisMonth * 1.5 : 500;
          }
          // Round limit to nearest 50 for clean design, min 100
          limit = Math.ceil(rawLimit / 50) * 50;
          if (limit < 100) limit = 100;
        }

        return {
          id: manualBudget ? manualBudget.id : `auto-${category.id}`,
          name: category.name,
          amount: limit,
          spent: spentThisMonth,
          remaining: limit - spentThisMonth,
          percentage: limit > 0 ? Math.round((spentThisMonth / limit) * 100) : 0,
          category: {
            id: category.id,
            name: category.name,
            color: category.color,
            icon: category.icon,
          },
          description: manualBudget
            ? `Limite definido manualmente.`
            : pastAverage > 0 
              ? `Média de R$ ${pastAverage.toFixed(2)} nos últimos 3 meses.`
              : `Média de gastos sugerida.`,
          isAutomatic,
        };
      })
    );

    // Keep categories with spending, or with manual budgets, or with past averages.
    // If empty, return a few categories anyway.
    let filteredResults = results.filter(
      r => r.spent > 0 || !r.isAutomatic || r.amount > 100
    );
    if (filteredResults.length === 0) {
      filteredResults = results.slice(0, 4);
    }

    return filteredResults;
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
