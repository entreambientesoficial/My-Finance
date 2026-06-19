import { IsString, IsEnum, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InvestmentType } from '@prisma/client';

export class CreateInvestmentDto {
  @ApiProperty({ example: 'ITSA4' })
  @IsString()
  name: string;

  @ApiProperty({ enum: InvestmentType })
  @IsEnum(InvestmentType)
  type: InvestmentType;

  @ApiProperty({ required: false, example: 'ITSA4' })
  @IsOptional()
  @IsString()
  ticker?: string;

  @ApiProperty({ required: false, example: 100 })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiProperty({ required: false, example: 10.50 })
  @IsOptional()
  @IsNumber()
  purchasePrice?: number;

  @ApiProperty({ required: false, example: 11.20 })
  @IsOptional()
  @IsNumber()
  currentPrice?: number;

  @ApiProperty({ required: false, example: '2025-01-15' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiProperty({ required: false, example: 'XP Investimentos' })
  @IsOptional()
  @IsString()
  broker?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, example: 'cuid-account-id' })
  @IsOptional()
  @IsString()
  accountId?: string;
}
