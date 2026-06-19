const { PrismaClient } = require('@prisma/client');

// Use the password exactly as provided
const rawPassword = `)F]{D2]3:<)o)h3+`;
const encodedPassword = encodeURIComponent(rawPassword);

console.log("Raw password:", rawPassword);
console.log("Encoded password:", encodedPassword);

// Let's test the pooler connection string with the new project ref
const projectRef = "szpqjiwwektauiqvbzxe";
const poolerUrl = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;
console.log("Pooler connection string:", poolerUrl.replace(encodedPassword, "****"));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: poolerUrl,
    },
  },
});

async function main() {
  console.log("Connecting to direct database...");
  try {
    const result = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
    console.log("Direct connection successful! Tables:", result);
  } catch (err) {
    console.error("Pooler connection failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
