// import "dotenv/config";
// import { PrismaPg } from "@prisma/adapter-pg";
// import { PrismaClient } from "../lib/generated/prisma/client";

// const connectionString = `${process.env.DATABASE_URL}`;

// const adapter = new PrismaPg({ connectionString });
// const prisma = new PrismaClient({ adapter });

// export { prisma };

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import net from "net";

if (net.setDefaultAutoSelectFamilyAttemptTimeout) {
  net.setDefaultAutoSelectFamilyAttemptTimeout(10000);
}

// CRITICAL for local Node.js environments (like Express on Fedora)
if (typeof window === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const connectionString = `${process.env.DATABASE_URL}`;

// Use the specialized Neon adapter instead of PrismaPg
const adapter = new PrismaNeon({ connectionString });

// Use your custom generated client
export const prisma = new PrismaClient({ adapter });
