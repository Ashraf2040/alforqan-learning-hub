import { PrismaClient } from '@/generated/client-weekly-v5';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaSchemaRevision?: string };
const schemaRevision = 'student-reports-order-v3';

if (process.env.NODE_ENV !== 'production' && globalForPrisma.prismaSchemaRevision !== schemaRevision) {
  const staleClient = globalForPrisma.prisma;
  globalForPrisma.prisma = new PrismaClient();
  globalForPrisma.prismaSchemaRevision = schemaRevision;
  void staleClient?.$disconnect().catch(() => undefined);
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaRevision = schemaRevision;
}
