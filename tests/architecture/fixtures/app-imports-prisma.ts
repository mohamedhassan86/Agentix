/**
 * Forbidden fixture: App importing Prisma directly
 */
// @ts-nocheck
import { PrismaClient } from "@prisma/client";

export const forbidden = new PrismaClient();
