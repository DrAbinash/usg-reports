import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // 'query' logs every statement WITH its parameters, and this database's
    // parameters are patient names. It also buried the 2026-10-30 incident: one
    // line per column list drowned the actual `P1008 · Socket timeout` that was
    // the whole story. Off unless someone asks for it in a container.
    log: process.env.PRISMA_LOG_QUERIES === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db