import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGoalDto {
  @ApiProperty({ example: 'Viagem para Europa' })
  @IsString()
  name: string;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  targetAmount: number;

  @ApiProperty({ required: false, example: 500 })
  @IsOptional()
  @IsNumber()
  currentAmount?: number;

  @ApiProperty({ required: false, example: '2027-06-01' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ required: false, example: '#10b981' })
  @IsOptional()
  @IsString()
  color?: string;
}
