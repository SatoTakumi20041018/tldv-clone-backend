import { PrismaClient } from "@prisma/client";
import { initDb } from "./initDb";

// In Vercel, copy the seed DB to /tmp before Prisma tries to open it
initDb();

const prisma = new PrismaClient();

export default prisma;
