import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';

@ApiTags('investments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateInvestmentDto) {
    return this.investmentsService.create(req.user.householdId, dto);
  }

  @Get()
  findAll(@Req() req) {
    return this.investmentsService.findAll(req.user.householdId);
  }

  @Get('portfolio')
  @ApiOperation({ summary: 'Resumo da carteira de investimentos' })
  portfolio(@Req() req) {
    return this.investmentsService.getPortfolioSummary(req.user.householdId);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: Partial<CreateInvestmentDto>) {
    return this.investmentsService.update(id, req.user.householdId, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.investmentsService.remove(id, req.user.householdId);
  }
}
