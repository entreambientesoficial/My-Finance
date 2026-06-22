import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, Req, UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { StorageService } from '../storage/storage.service';

// ── Filtros de tipo de arquivo ────────────────────────────────────────────────

// Aceita apenas CSV e texto simples para importação
const csvFileFilter = (_req: any, file: Express.Multer.File, cb: Function) => {
  const allowedMimes = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
  const allowedExts = ['.csv', '.txt'];
  if (!allowedMimes.includes(file.mimetype) && !allowedExts.includes(extname(file.originalname).toLowerCase())) {
    return cb(new BadRequestException('Apenas arquivos CSV são aceitos'), false);
  }
  cb(null, true);
};

// Aceita apenas OFX/OFC para importação bancária
const ofxFileFilter = (_req: any, file: Express.Multer.File, cb: Function) => {
  const allowedExts = ['.ofx', '.ofc', '.qfx'];
  if (!allowedExts.includes(extname(file.originalname).toLowerCase())) {
    return cb(new BadRequestException('Apenas arquivos OFX, OFC ou QFX são aceitos'), false);
  }
  cb(null, true);
};

// Aceita apenas imagens e PDF como comprovantes de transação
const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const attachmentFileFilter = (_req: any, file: Express.Multer.File, cb: Function) => {
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
    return cb(new BadRequestException('Apenas imagens (JPG, PNG, WEBP) ou PDF são aceitos como comprovante'), false);
  }
  cb(null, true);
};

// ── Controller ────────────────────────────────────────────────────────────────

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly storage: StorageService,
  ) {}

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

  // ── Importação ──────────────────────────────────────────────────────────────

  @Post('import/csv')
  @ApiOperation({ summary: 'Importar transações via arquivo CSV' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, accountId: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: csvFileFilter }))
  async importCsv(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('accountId') accountId?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo CSV obrigatório');
    const content = file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    return this.transactionsService.importFromCsv(req.user.householdId, content, accountId);
  }

  @Post('import/ofx')
  @ApiOperation({ summary: 'Importar transações via arquivo OFX/OFC' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, accountId: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: ofxFileFilter }))
  async importOfx(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('accountId') accountId?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo OFX obrigatório');
    const content = file.buffer.toString('latin1');
    return this.transactionsService.importFromOfx(req.user.householdId, content, accountId);
  }

  // ── Anexos (Supabase Storage) ───────────────────────────────────────────────

  @Post(':id/attachments')
  @ApiOperation({ summary: 'Fazer upload de anexo para uma transação (Supabase Storage)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: attachmentFileFilter,
  }))
  async uploadAttachment(
    @Req() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    const fileUrl = await this.storage.uploadAttachment(
      req.user.householdId,
      file.originalname,
      file.buffer,
      file.mimetype,
    );
    return this.transactionsService.addAttachment(id, req.user.householdId, fileUrl);
  }

  @Delete(':id/attachments/:filename')
  @ApiOperation({ summary: 'Remover anexo de uma transação' })
  removeAttachment(@Req() req, @Param('id') id: string, @Param('filename') filename: string) {
    return this.transactionsService.removeAttachment(id, req.user.householdId, filename);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

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
