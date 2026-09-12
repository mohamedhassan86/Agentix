import type { IUnitOfWork } from "@/application/shared/ports/unit-of-work";
import { getPrismaClient } from "./prisma";
import type { PrismaClient } from "../../generated/prisma/client";

export class PrismaUnitOfWork implements IUnitOfWork {
  constructor(private prisma: PrismaClient = getPrismaClient()) {}

  async execute<T>(work: (tx: PrismaClient) => Promise<T>): Promise<T> {
    // Prisma $transaction with callback
    return this.prisma.$transaction(async (tx) => {
      // tx is transaction client, but we need to cast
      return work(tx as unknown as PrismaClient);
    });
  }

  // Simple execute without tx param for compatibility
  async executeSimple<T>(work: () => Promise<T>): Promise<T> {
    return this.execute(() => work());
  }
}
