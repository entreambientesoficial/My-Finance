import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  // Runs daily at 09:00
  @Cron('0 9 * * *')
  async checkUpcomingBills() {
    this.logger.log('Verificando contas a vencer...');
    const today = new Date();
    const threeDaysAhead = new Date(today);
    threeDaysAhead.setDate(today.getDate() + 3);

    const households = await this.prisma.household.findMany({
      include: { users: true },
    });

    for (const household of households) {
      const bills = await this.prisma.transaction.findMany({
        where: {
          householdId: household.id,
          type: 'EXPENSE',
          isPaid: false,
          date: { gte: today, lte: threeDaysAhead },
        },
        orderBy: { date: 'asc' },
      });

      if (bills.length === 0) continue;

      for (const user of household.users) {
        await this.mail.sendUpcomingBillAlert(user, bills);
      }
    }
  }

  // Runs daily at 09:00
  @Cron('0 9 * * *')
  async checkBudgetsOverLimit() {
    this.logger.log('Verificando orçamentos excedidos...');
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const budgets = await this.prisma.budget.findMany({
      where: { isActive: true, month, year },
      include: {
        household: { include: { users: true } },
        category: true,
      },
    });

    for (const budget of budgets) {
      const where: any = {
        householdId: budget.householdId,
        type: 'EXPENSE',
        isPaid: true,
        date: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      };
      if (budget.categoryId) where.categoryId = budget.categoryId;

      const agg = await this.prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
      });

      const spent = Number(agg._sum.amount || 0);
      const limit = Number(budget.amount);
      const percentage = Math.round((spent / limit) * 100);

      if (percentage >= 80) {
        for (const user of budget.household.users) {
          await this.mail.sendBudgetAlert(user, { ...budget, spent, percentage });
        }
      }
    }
  }

  // Runs hourly — checks goals just completed
  @Cron(CronExpression.EVERY_HOUR)
  async checkCompletedGoals() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const goals = await this.prisma.goal.findMany({
      where: { isCompleted: true, updatedAt: { gte: oneHourAgo } },
      include: { household: { include: { users: true } } },
    });

    for (const goal of goals) {
      for (const user of goal.household.users) {
        await this.mail.sendGoalCompletedAlert(user, goal);
      }
    }
  }
}
