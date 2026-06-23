import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, JwtPayload } from './auth';
import { unauthorized } from './api-response';

type Handler = (req: NextRequest, user: JwtPayload) => Promise<NextResponse>;

export function withAuth(handler: Handler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    return handler(req, user);
  };
}
