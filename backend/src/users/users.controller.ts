import {
  Controller, Get, Patch, Body, UseGuards, Req,
  Post, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { StorageService } from '../storage/storage.service';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const imageFileFilter = (_req: any, file: Express.Multer.File, cb: Function) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(new BadRequestException('Apenas imagens JPG, PNG, WEBP ou GIF são permitidas'), false);
  }
  cb(null, true);
};

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storage: StorageService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuário logado' })
  me(@Req() req) {
    return this.usersService.findMe(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualizar perfil' })
  update(@Req() req, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.id, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Fazer upload de foto de perfil (Supabase Storage)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  async uploadAvatar(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo de imagem obrigatório');
    const avatarUrl = await this.storage.uploadAvatar(req.user.id, file.buffer, file.mimetype);
    await this.usersService.update(req.user.id, { avatarUrl });
    return { avatarUrl };
  }
}
