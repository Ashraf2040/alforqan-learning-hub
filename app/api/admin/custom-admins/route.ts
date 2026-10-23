import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ADMIN_FEATURES, setCustomAdminAccess, type AdminFeature } from '@/lib/custom-admin';

async function isOwner() {
  const session = await getServerSession(authOptions);
  return session?.user.role === 'ADMIN' ? session : null;
}

export async function GET() {
  if (!await isOwner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [users, setting] = await Promise.all([
    prisma.user.findMany({ where: { role: 'CUSTOM_ADMIN' }, orderBy: { name: 'asc' }, select: { id: true, name: true, username: true } }),
    prisma.appSetting.findUnique({ where: { key: 'customAdminFeatureAccess' }, select: { value: true } }),
  ]);
  let permissions: Record<string, AdminFeature[]> = {};
  try { permissions = JSON.parse(setting?.value ?? '{}') as Record<string, AdminFeature[]>; } catch { permissions = {}; }
  return NextResponse.json({ users: users.map((user) => ({ ...user, features: (Array.isArray(permissions[user.id]) ? permissions[user.id] : []).filter((feature) => ADMIN_FEATURES.includes(feature)) })) });
}

export async function POST(request: NextRequest) {
  if (!await isOwner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as { name?: unknown; username?: unknown; password?: unknown; features?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const features = Array.isArray(body.features) ? [...new Set(body.features.filter((value): value is AdminFeature => typeof value === 'string' && ADMIN_FEATURES.includes(value as AdminFeature)))] : [];
    if (!name || !/^[a-z0-9._-]{3,40}$/.test(username) || password.length < 8 || features.length === 0) {
      return NextResponse.json({ error: 'Enter a name, username (3–40 letters/numbers), password (8+ characters), and at least one feature.' }, { status: 400 });
    }
    const user = await prisma.user.create({ data: { name, username, password: await bcrypt.hash(password, 12), role: 'CUSTOM_ADMIN' }, select: { id: true, name: true, username: true } });
    await setCustomAdminAccess(user.id, features);
    return NextResponse.json({ user: { ...user, features } }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'That username is already in use.' }, { status: 409 });
    return NextResponse.json({ error: 'Could not create this admin account.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!await isOwner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as { id?: unknown; name?: unknown; username?: unknown; password?: unknown; features?: unknown };
    const id = typeof body.id === 'string' ? body.id : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const features = Array.isArray(body.features) ? [...new Set(body.features.filter((value): value is AdminFeature => typeof value === 'string' && ADMIN_FEATURES.includes(value as AdminFeature)))] : [];
    if (!id || !name || !/^[a-z0-9._-]{3,40}$/.test(username) || (password.length > 0 && password.length < 8) || !Array.isArray(body.features) || features.length === 0) {
      return NextResponse.json({ error: 'Enter a name, valid username (3–40 letters/numbers), optional password (8+ characters), and at least one feature.' }, { status: 400 });
    }
    const user = await prisma.user.findFirst({ where: { id, role: 'CUSTOM_ADMIN' }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'Admin account not found.' }, { status: 404 });
    const updated = await prisma.user.update({ where: { id }, data: { name, username, ...(password ? { password: await bcrypt.hash(password, 12) } : {}) }, select: { id: true, name: true, username: true } });
    await setCustomAdminAccess(id, features);
    return NextResponse.json({ user: updated, features });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'That username is already in use.' }, { status: 409 });
    return NextResponse.json({ error: 'Could not update this admin account.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!await isOwner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? '';
  const user = await prisma.user.findFirst({ where: { id, role: 'CUSTOM_ADMIN' }, select: { id: true } });
  if (!user) return NextResponse.json({ error: 'Admin account not found.' }, { status: 404 });
  await setCustomAdminAccess(id, null);
  await prisma.user.update({ where: { id }, data: { role: 'REVOKED' } });
  return NextResponse.json({ ok: true });
}
