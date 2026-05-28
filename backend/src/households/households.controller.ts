import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdsService } from './households.service';
import { UpdateHouseholdDto } from './dto/update-household.dto';

class InviteDto {
  @IsEmail()
  email: string;
}

@ApiTags('households')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households')
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Dados do household do usuário' })
  findMine(@Req() req) {
    return this.householdsService.findMine(req.user.householdId);
  }

  @Get('mine/summary')
  @ApiOperation({ summary: 'Resumo financeiro do household' })
  summary(@Req() req) {
    return this.householdsService.summary(req.user.householdId);
  }

  @Patch('mine')
  @ApiOperation({ summary: 'Atualizar household' })
  update(@Req() req, @Body() dto: UpdateHouseholdDto) {
    return this.householdsService.update(req.user.householdId, dto);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Convidar membro por e-mail' })
  @ApiBody({ type: InviteDto })
  invite(@Req() req, @Body() dto: InviteDto) {
    return this.householdsService.inviteMember(req.user.householdId, req.user.sub, dto.email);
  }

  @Get('invites')
  @ApiOperation({ summary: 'Listar convites pendentes' })
  invites(@Req() req) {
    return this.householdsService.getPendingInvites(req.user.householdId);
  }

  @Delete('invites/:id')
  @ApiOperation({ summary: 'Cancelar convite' })
  cancelInvite(@Req() req, @Param('id') id: string) {
    return this.householdsService.cancelInvite(req.user.householdId, id);
  }
}
