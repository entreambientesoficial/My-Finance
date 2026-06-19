import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';

class AddProgressDto {
  @ApiProperty({ example: 500 })
  @IsNumber()
  amount: number;

  @ApiProperty({ required: false, example: 'cuid-account-id' })
  @IsOptional()
  @IsString()
  accountId?: string;
}

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(req.user.householdId, dto);
  }

  @Get()
  findAll(@Req() req) {
    return this.goalsService.findAll(req.user.householdId);
  }

  @Post(':id/progress')
  @ApiOperation({ summary: 'Adicionar valor à meta' })
  addProgress(@Req() req, @Param('id') id: string, @Body() dto: AddProgressDto) {
    return this.goalsService.addProgress(id, req.user.householdId, dto.amount, dto.accountId);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: Partial<CreateGoalDto>) {
    return this.goalsService.update(id, req.user.householdId, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.goalsService.remove(id, req.user.householdId);
  }
}
