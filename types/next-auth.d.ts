import 'next-auth';
declare module 'next-auth' {
  interface Session { user: { id: string; name: string; username: string; role: string } }
}
