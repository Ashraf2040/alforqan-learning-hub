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
      if (!credentials?.username || !credentials.password) return null;
      const user = await prisma.user.findUnique({ where: { username: credentials.username } });
      if (!user) return null;
      const valid = user.password.startsWith('$2')
        ? await (await import('bcryptjs')).compare(credentials.password, user.password)
        : credentials.password === user.password;
      if (!valid) return null;
      return { id: user.id, name: user.name, username: user.username, role: user.role };
    },
  })],
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) { if (user) Object.assign(token, { id: user.id, name: user.name, username: user.username, role: user.role }); return token; },
    async session({ session, token }) { if (session.user) Object.assign(session.user, { id: token.id, name: token.name, username: token.username, role: token.role }); return session; },
  },
};
