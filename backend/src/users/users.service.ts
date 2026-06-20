import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        householdId: true,
        household: { select: { id: true, name: true, currency: true } },
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async update(userId: string, dto: UpdateUserDto) {
    const { currentPassword, newPassword, ...rest } = dto;
    const updateData: any = { ...rest };

    if (newPassword) {
      if (!currentPassword) {
        throw new BadRequestException('A senha atual é obrigatória para cadastrar uma nova senha');
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('Usuário não encontrado');

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new BadRequestException('Senha atual incorreta');
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
  }
}
