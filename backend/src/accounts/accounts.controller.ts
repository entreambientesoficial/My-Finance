import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar conta' })
  create(@Req() req, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(req.user.householdId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar contas' })
  findAll(@Req() req) {
    return this.accountsService.findAll(req.user.householdId);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.accountsService.findOne(id, req.user.householdId);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: Partial<CreateAccountDto>) {
    return this.accountsService.update(id, req.user.householdId, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.accountsService.remove(id, req.user.householdId);
  }
}
