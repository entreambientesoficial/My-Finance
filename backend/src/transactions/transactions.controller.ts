import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, Req, UseInterceptors, UploadedFile,
  BadRequestException, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

const attachmentStorage = diskStorage({
  destination: join(process.cwd(), 'uploads', 'attachments'),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${extname(file.originalname)}`);
  },
});

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(req.user.householdId, dto);
  }

  @Get()
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'accountId', required: false })
  @ApiQuery({ name: 'cardId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'isPaid', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Req() req, @Query() filters: any) {
    return this.transactionsService.findAll(req.user.householdId, filters);
  }

  @Get('summary/monthly')
  @ApiOperation({ summary: 'Resumo de receitas e despesas do mês' })
  @ApiQuery({ name: 'month', type: Number })
  @ApiQuery({ name: 'year', type: Number })
  monthlySummary(@Req() req, @Query('month') month: number, @Query('year') year: number) {
    return this.transactionsService.getMonthlySummary(req.user.householdId, +month, +year);
  }

  @Post('import/csv')
  @ApiOperation({ summary: 'Importar transações via arquivo CSV' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, accountId: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importCsv(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('accountId') accountId?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo CSV obrigatório');
    const content = file.buffer.toString('utf-8').replace(/^﻿/, '');
    return this.transactionsService.importFromCsv(req.user.householdId, content, accountId);
  }

  @Post('import/ofx')
  @ApiOperation({ summary: 'Importar transações via arquivo OFX/OFC' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, accountId: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importOfx(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('accountId') accountId?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo OFX obrigatório');
    const content = file.buffer.toString('latin1'); // OFX often uses latin1
    return this.transactionsService.importFromOfx(req.user.householdId, content, accountId);
  }

  @Post(':id/attachments')
  @ApiOperation({ summary: 'Fazer upload de anexo para uma transação' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: attachmentStorage, limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadAttachment(
    @Req() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    const fileUrl = `/uploads/attachments/${file.filename}`;
    return this.transactionsService.addAttachment(id, req.user.householdId, fileUrl);
  }

  @Delete(':id/attachments/:filename')
  @ApiOperation({ summary: 'Remover anexo de uma transação' })
  removeAttachment(@Req() req, @Param('id') id: string, @Param('filename') filename: string) {
    return this.transactionsService.removeAttachment(id, req.user.householdId, filename);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.transactionsService.findOne(id, req.user.householdId);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: Partial<CreateTransactionDto>) {
    return this.transactionsService.update(id, req.user.householdId, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.transactionsService.remove(id, req.user.householdId);
  }
}
