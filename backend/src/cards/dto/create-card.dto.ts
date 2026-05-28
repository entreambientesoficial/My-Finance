import { IsString, IsEnum, IsOptional, IsNumber, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CardBrand } from '@prisma/client';

export class CreateCardDto {
  @ApiProperty({ example: 'Nubank Roxinho' })
  @IsString()
  name: string;

  @ApiProperty({ enum: CardBrand, default: CardBrand.OTHER })
  @IsOptional()
  @IsEnum(CardBrand)
  brand?: CardBrand;

  @ApiProperty({ required: false, example: '1234' })
  @IsOptional()
  @IsString()
  lastFourDigits?: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  creditLimit: number;

  @ApiProperty({ example: 1, description: 'Dia do fechamento da fatura (1-28)' })
  @IsInt()
  @Min(1)
  @Max(28)
  billingDay: number;

  @ApiProperty({ example: 10, description: 'Dia do vencimento (1-28)' })
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiProperty({ required: false, example: '#8b5cf6' })
  @IsOptional()
  @IsString()
  color?: string;
}
