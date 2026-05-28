import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  async create(householdId: string, dto: CreateGoalDto) {
    return this.prisma.goal.create({
      data: {
        ...dto,
        householdId,
        ...(dto.targetDate && { targetDate: new Date(dto.targetDate) }),
      },
    });
  }

  async findAll(householdId: string) {
    return this.prisma.goal.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addProgress(id: string, householdId: string, amount: number) {
    const goal = await this.prisma.goal.findFirst({ where: { id, householdId } });
    if (!goal) throw new NotFoundException('Meta não encontrada');

    const newAmount = Number(goal.currentAmount) + amount;
    const isCompleted = newAmount >= Number(goal.targetAmount);

    return this.prisma.goal.update({
      where: { id },
      data: { currentAmount: newAmount, isCompleted },
    });
  }

  async update(id: string, householdId: string, dto: Partial<CreateGoalDto>) {
    const goal = await this.prisma.goal.findFirst({ where: { id, householdId } });
    if (!goal) throw new NotFoundException('Meta não encontrada');
    return this.prisma.goal.update({
      where: { id },
      data: { ...dto, ...(dto.targetDate && { targetDate: new Date(dto.targetDate) }) },
    });
  }

  async remove(id: string, householdId: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id, householdId } });
    if (!goal) throw new NotFoundException('Meta não encontrada');
    return this.prisma.goal.delete({ where: { id } });
  }
}
