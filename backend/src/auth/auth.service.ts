import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { DEFAULT_CATEGORIES } from '../categories/categories.defaults';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: { name: dto.householdName || `Casa de ${dto.name}` },
      });

      const newUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          householdId: household.id,
        },
      });

      // Criar categorias padrão
      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((cat) => ({
          ...cat,
          householdId: household.id,
          isDefault: true,
        })),
      });

      return newUser;
    });

    return this.generateTokens(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException('Credenciais inválidas');

    return this.generateTokens(user.id, user.email);
  }

  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.generateTokens(stored.user.id, stored.user.email);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  async acceptInvite(token: string, name: string, password: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite) throw new UnauthorizedException('Convite inválido ou não encontrado');
    if (invite.expiresAt < new Date()) throw new UnauthorizedException('Convite expirado');
    if (invite.acceptedAt) throw new UnauthorizedException('Convite já utilizado');

    const existing = await this.prisma.user.findUnique({ where: { email: invite.email } });
    if (existing) {
      // User already exists — just join the household
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { householdId: invite.householdId },
      });
      await this.prisma.invite.update({ where: { token }, data: { acceptedAt: new Date() } });
      return this.generateTokens(existing.id, existing.email);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { name, email: invite.email, passwordHash, householdId: invite.householdId },
    });

    await this.prisma.invite.update({ where: { token }, data: { acceptedAt: new Date() } });
    return this.generateTokens(user.id, user.email);
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN') || '15m',
    });

    const rawRefresh = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { token: rawRefresh, userId, expiresAt },
    });

    return { accessToken, refreshToken: rawRefresh };
  }
}
