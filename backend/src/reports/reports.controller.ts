import { Controller, Get, Query, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('cash-flow')
  @ApiOperation({ summary: 'Fluxo de caixa dos últimos N meses' })
  @ApiQuery({ name: 'months', type: Number, required: false })
  cashFlow(@Req() req, @Query('months') months?: number) {
    return this.reportsService.getCashFlow(req.user.householdId, months && +months);
  }

  @Get('expenses-by-category')
  @ApiOperation({ summary: 'Despesas por categoria' })
  @ApiQuery({ name: 'month', type: Number })
  @ApiQuery({ name: 'year', type: Number })
  expensesByCategory(
    @Req() req,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.reportsService.getExpensesByCategory(req.user.householdId, +month, +year);
  }

  @Get('net-worth')
  @ApiOperation({ summary: 'Patrimônio líquido' })
  netWorth(@Req() req) {
    return this.reportsService.getNetWorth(req.user.householdId);
  }

  @Get('upcoming-bills')
  @ApiOperation({ summary: 'Contas a pagar nos próximos dias' })
  @ApiQuery({ name: 'daysAhead', type: Number, required: false })
  upcomingBills(@Req() req, @Query('daysAhead') daysAhead?: number) {
    return this.reportsService.getUpcomingBills(req.user.householdId, daysAhead && +daysAhead);
  }

  @Get('export/summary.pdf')
  @ApiOperation({ summary: 'Exportar relatório resumido em PDF' })
  async exportPdf(@Req() req, @Res() res: Response) {
    const buffer = await this.reportsService.exportSummaryPdf(req.user.householdId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.send(buffer);
  }

  @Get('export/transactions.csv')
  @ApiOperation({ summary: 'Exportar transações em CSV' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'type', required: false })
  async exportTransactions(
    @Req() req,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
  ) {
    const csv = await this.reportsService.exportTransactionsCsv(
      req.user.householdId,
      { startDate, endDate, type },
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transacoes-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('﻿' + csv); // BOM para Excel reconhecer UTF-8
  }
}
