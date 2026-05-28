import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';

@Injectable()
export class InvestmentsService {
  constructor(private prisma: PrismaService) {}

  async create(householdId: string, dto: CreateInvestmentDto) {
    return this.prisma.investment.create({
      data: {
        ...dto,
        householdId,
        ...(dto.purchaseDate && { purchaseDate: new Date(dto.purchaseDate) }),
      },
    });
  }

  async findAll(householdId: string) {
    return this.prisma.investment.findMany({
      where: { householdId },
      orderBy: { name: 'asc' },
    });
  }

  async getPortfolioSummary(householdId: string) {
    const investments = await this.findAll(householdId);

    const summary = investments.map((inv) => {
      const cost = Number(inv.quantity || 0) * Number(inv.purchasePrice || 0);
      const current = Number(inv.quantity || 0) * Number(inv.currentPrice || inv.purchasePrice || 0);
      const gain = current - cost;
      const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
      return { ...inv, cost, current, gain, gainPct: Math.round(gainPct * 100) / 100 };
    });

    const totalCost = summary.reduce((s, i) => s + i.cost, 0);
    const totalCurrent = summary.reduce((s, i) => s + i.current, 0);
    const totalGain = totalCurrent - totalCost;
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return {
      investments: summary,
      totalCost,
      totalCurrent,
      totalGain,
      totalGainPct: Math.round(totalGainPct * 100) / 100,
    };
  }

  async update(id: string, householdId: string, dto: Partial<CreateInvestmentDto>) {
    const inv = await this.prisma.investment.findFirst({ where: { id, householdId } });
    if (!inv) throw new NotFoundException('Investimento não encontrado');
    return this.prisma.investment.update({
      where: { id },
      data: { ...dto, ...(dto.purchaseDate && { purchaseDate: new Date(dto.purchaseDate) }) },
    });
  }

  async remove(id: string, householdId: string) {
    const inv = await this.prisma.investment.findFirst({ where: { id, householdId } });
    if (!inv) throw new NotFoundException('Investimento não encontrado');
    return this.prisma.investment.delete({ where: { id } });
  }
}
