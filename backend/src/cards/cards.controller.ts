import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';

@ApiTags('cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateCardDto) {
    return this.cardsService.create(req.user.householdId, dto);
  }

  @Get()
  findAll(@Req() req) {
    return this.cardsService.findAll(req.user.householdId);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.cardsService.findOne(id, req.user.householdId);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: Partial<CreateCardDto>) {
    return this.cardsService.update(id, req.user.householdId, dto);
  }

  @Patch(':id/freeze')
  @ApiOperation({ summary: 'Congelar/descongelar cartão' })
  toggleFreeze(@Req() req, @Param('id') id: string) {
    return this.cardsService.toggleFreeze(id, req.user.householdId);
  }

  @Get(':id/invoice')
  @ApiQuery({ name: 'month', type: Number })
  @ApiQuery({ name: 'year', type: Number })
  getInvoice(
    @Req() req,
    @Param('id') id: string,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.cardsService.getInvoiceSummary(id, req.user.householdId, +month, +year);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.cardsService.remove(id, req.user.householdId);
  }
}
