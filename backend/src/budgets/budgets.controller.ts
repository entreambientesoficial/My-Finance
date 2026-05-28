import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';

@ApiTags('budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(req.user.householdId, dto);
  }

  @Get()
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  findAll(@Req() req, @Query('month') month?: number, @Query('year') year?: number) {
    return this.budgetsService.findAll(req.user.householdId, month && +month, year && +year);
  }

  @Get('progress')
  @ApiQuery({ name: 'month', type: Number })
  @ApiQuery({ name: 'year', type: Number })
  progress(@Req() req, @Query('month') month: number, @Query('year') year: number) {
    return this.budgetsService.findWithProgress(req.user.householdId, +month, +year);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: Partial<CreateBudgetDto>) {
    return this.budgetsService.update(id, req.user.householdId, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.budgetsService.remove(id, req.user.householdId);
  }
}
