import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(function middleware(req) {
  const role = req.nextauth.token?.role;
  if (req.nextUrl.pathname.startsWith('/admin') && role !== 'ADMIN') return NextResponse.redirect(new URL('/teacher', req.url));
  if (req.nextUrl.pathname.startsWith('/teacher') && role !== 'TEACHER') return NextResponse.redirect(new URL('/admin', req.url));
  return NextResponse.next();
}, { callbacks: { authorized: ({ token }) => !!token } });

export const config = { matcher: ['/admin/:path*', '/teacher/:path*'] };
