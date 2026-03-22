import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";

const sql = neon(process.env.DATABASE_URL!);

const users = [
  { email: "admin@dpstcon.org", password: "admin1234" },
  { email: "chair@dpstcon.org", password: "chair1234" },
  { email: "reviewer1@dpstcon.org", password: "review1234" },
  { email: "reviewer2@dpstcon.org", password: "review1234" },
  { email: "committee@dpstcon.org", password: "comm1234" },
  { email: "author1@dpstcon.org", password: "author1234" },
  { email: "author2@dpstcon.org", password: "author1234" },
];

async function main() {
  for (const u of users) {
    const [user] = await sql`SELECT id FROM "user" WHERE email = ${u.email}`;
    if (!user) {
      console.log("SKIP", u.email, "(no user)");
      continue;
    }

    const hashedPw = await hashPassword(u.password);

    // Check if credential account exists
    const [existing] =
      await sql`SELECT id FROM account WHERE user_id = ${user.id} AND provider_id = 'credential'`;

    if (existing) {
      // Update password
      await sql`UPDATE account SET password = ${hashedPw}, updated_at = NOW() WHERE id = ${existing.id}`;
      console.log("UPDATED", u.email);
    } else {
      // Create credential account
      const accountId = crypto.randomUUID().replace(/-/g, "");
      await sql`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (${accountId}, ${user.id}, 'credential', ${user.id}, ${hashedPw}, NOW(), NOW())`;
      console.log("CREATED", u.email);
    }
  }
  console.log("Done!");
}

main().catch(console.error);
