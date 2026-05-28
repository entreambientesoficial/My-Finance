import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { TransactionType } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(householdId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { ...dto, householdId } });
  }

  async findAll(householdId: string, type?: TransactionType) {
    return this.prisma.category.findMany({
      where: { householdId, ...(type && { type }), parentId: null },
      include: { children: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, householdId: string, dto: Partial<CreateCategoryDto>) {
    const cat = await this.prisma.category.findFirst({ where: { id, householdId } });
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string, householdId: string) {
    const cat = await this.prisma.category.findFirst({ where: { id, householdId } });
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    return this.prisma.category.delete({ where: { id } });
  }
}
