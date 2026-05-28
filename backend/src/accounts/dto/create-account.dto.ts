import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
  @ApiProperty({ example: 'Conta Corrente Itaú' })
  @IsString()
  name: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiProperty({ required: false, example: 'Itaú' })
  @IsOptional()
  @IsString()
  bank?: string;

  @ApiProperty({ required: false, example: 1500.00 })
  @IsOptional()
  @IsNumber()
  balance?: number;

  @ApiProperty({ required: false, example: 'BRL' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false, example: '#006c49' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ required: false, example: 'bank' })
  @IsOptional()
  @IsString()
  icon?: string;
}
