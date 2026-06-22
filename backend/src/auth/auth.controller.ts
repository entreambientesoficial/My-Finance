import {
  Controller, Post, Body, HttpCode, HttpStatus,
  UseGuards, Req, Res, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, MinLength, IsNotEmpty, Matches } from 'class-validator';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

class AcceptInviteDto {
  @IsString() @IsNotEmpty() token: string;
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, { message: 'Senha deve conter ao menos uma letra maiúscula e um número' })
  password: string;
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private get cookieOpts() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
  }

  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('accessToken', tokens.accessToken, { ...this.cookieOpts, maxAge: FIFTEEN_MINUTES });
    res.cookie('refreshToken', tokens.refreshToken, { ...this.cookieOpts, maxAge: SEVEN_DAYS });
  }

  private clearAuthCookies(res: Response) {
    const base = this.cookieOpts;
    res.clearCookie('accessToken', base);
    res.clearCookie('refreshToken', base);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  @ApiOperation({ summary: 'Criar nova conta' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(dto);
    this.setAuthCookies(res, tokens);
    return { message: 'Conta criada com sucesso' };
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fazer login' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto);
    this.setAuthCookies(res, tokens);
    return { message: 'Login realizado com sucesso' };
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token via cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (!refreshToken) throw new UnauthorizedException('Refresh token ausente');
    const tokens = await this.authService.refresh(refreshToken);
    this.setAuthCookies(res, tokens);
    return { message: 'Token renovado' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fazer logout' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    await this.authService.logout(refreshToken);
    this.clearAuthCookies(res);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('accept-invite')
  @ApiOperation({ summary: 'Aceitar convite e criar/vincular conta' })
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.acceptInvite(dto.token, dto.name, dto.password);
    this.setAuthCookies(res, tokens);
    return { message: 'Conta criada com sucesso' };
  }
}
