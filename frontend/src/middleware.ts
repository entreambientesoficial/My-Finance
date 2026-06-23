import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const PROTECTED = [
  '/dashboard',
  '/accounts',
  '/transactions',
  '/budgets',
  '/goals',
  '/investments',
  '/reports',
  '/settings',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get('accessToken')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', req.url));

  try {
    await jwtVerify(token, ACCESS_SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon|icons|logo|sw\\.js|manifest\\.json|robots\\.txt).*)'],
};
