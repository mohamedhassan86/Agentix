/**
 * Forbidden fixture: Application importing Prisma
 */
// @ts-nocheck
import { PrismaClient } from "@prisma/client";

export const forbidden = new PrismaClient();
