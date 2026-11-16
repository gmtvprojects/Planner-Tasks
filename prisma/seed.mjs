// Cria um usuário de desenvolvimento local. Uso: npm run seed
import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const email = "dev@planner.local";
const password = "planner123";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const hash = await bcrypt.hash(password, 12);
await client.query(
  `insert into "User" (id, email, name, "passwordHash", "isAdmin")
   values ($1, $2, $3, $4, true)
   on conflict (email) do update set "passwordHash" = excluded."passwordHash", "isAdmin" = true`,
  ["seed-dev-user", email, "Dev", hash],
);
await client.end();
console.log(`Usuário de desenvolvimento: ${email} / ${password}`);
