import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';
import { TransactionType } from '@prisma/client';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const type = new URL(req.url).searchParams.get('type') as TransactionType | null;
    const categories = await prisma.category.findMany({
      where: { householdId: user.householdId, ...(type && { type }), parentId: null },
      include: { children: true },
      orderBy: { name: 'asc' },
    });
    return ok(categories);
  } catch (err) {
    console.error('[categories GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const category = await prisma.category.create({
      data: { ...body, parentId: body.parentId || null, householdId: user.householdId },
    });
    return created(category);
  } catch (err) {
    console.error('[categories POST]', err);
    return serverError();
  }
});
