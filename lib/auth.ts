import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';

declare module 'next-auth' {
  interface Session { user: { id: string; name: string; username: string; role: string } }
  interface User { id: string; username: string; role: string }
}
declare module 'next-auth/jwt' {
  interface JWT { id: string; username: string; role: string }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [CredentialsProvider({
    name: 'School account',
    credentials: { username: { label: 'Username', type: 'text' }, password: { label: 'Password', type: 'password' } },
    async authorize(credentials) {
      const username = credentials?.username?.trim().toLowerCase();
      const password = credentials?.password;
      if (!username || !password) { console.warn('[auth] Login rejected: username or password missing.'); return null; }
      try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) { console.warn('[auth] Login rejected: account not found.'); return null; }
        if (!['ADMIN', 'TEACHER', 'COORDINATOR', 'CUSTOM_ADMIN'].includes(user.role)) { console.warn(`[auth] Login rejected: account ${user.id} has inactive role ${user.role}.`); return null; }
        const valid = user.password.startsWith('$2')
          ? await (await import('bcryptjs')).compare(password, user.password)
          : password === user.password;
        if (!valid) { console.warn(`[auth] Login rejected: password mismatch for account ${user.id}.`); return null; }
        console.info(`[auth] Login accepted: account ${user.id}, role ${user.role}.`);
        return { id: user.id, name: user.name, username: user.username, role: user.role };
      } catch (error) {
        console.error('[auth] Login could not reach or query the user database.', error);
        throw error;
      }
    },
  })],
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) { if (user) Object.assign(token, { id: user.id, name: user.name, username: user.username, role: user.role }); return token; },
    async session({ session, token }) { if (session.user) Object.assign(session.user, { id: token.id, name: token.name, username: token.username, role: token.role }); return session; },
  },
};
