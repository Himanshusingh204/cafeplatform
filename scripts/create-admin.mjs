// Secure admin bootstrap for production.
// Reads ADMIN_EMAIL + ADMIN_PASSWORD from the environment. Never store credentials in source.
//
// Usage:
//   ADMIN_EMAIL=owner@cafe.in ADMIN_PASSWORD='a-strong-password' node scripts/create-admin.mjs
//   (optionally ADMIN_NAME, ADMIN_ROLE=SUPER_ADMIN)

import "dotenv/config";

import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.");
  process.exit(1);
}

if (password.length < 10) {
  console.error("ADMIN_PASSWORD must be at least 10 characters.");
  process.exit(1);
}

const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

const existing = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });

let result;
if (existing) {
  result = await prisma.admin.update({
    where: { id: existing.id },
    data: { passwordHash, isActive: true },
  });
  console.log(`Admin updated: ${email}`);
} else {
  result = await prisma.admin.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name: process.env.ADMIN_NAME ?? "Café Owner",
      role: (process.env.ADMIN_ROLE ?? "SUPER_ADMIN"),
    },
  });
  console.log(`Admin created: ${email}`);
}

console.log(`Role: ${result.role} | Active: ${result.isActive}`);
await prisma.$disconnect();