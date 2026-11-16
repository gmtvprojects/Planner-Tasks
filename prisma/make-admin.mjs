// Promove um usuário a administrador. Uso: npm run make-admin -- email@exemplo.com
import "dotenv/config";
import pg from "pg";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Uso: npm run make-admin -- email@exemplo.com");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const res = await client.query(`update "User" set "isAdmin" = true where email = $1`, [email]);
await client.end();
console.log(res.rowCount ? `${email} agora é administrador.` : `Usuário não encontrado: ${email}`);
