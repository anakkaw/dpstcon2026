import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log("Checking DB counts...");
  
  const [presCount] = await sql`SELECT count(*) FROM "presentation_assignments"`;
  const [subCount] = await sql`SELECT count(*) FROM "submissions"`;
  const [userCount] = await sql`SELECT count(*) FROM "user"`;
  const [rolesCount] = await sql`SELECT count(*) FROM "user_roles"`;
  const [evalCount] = await sql`SELECT count(*) FROM "presentation_evaluations"`;
  const [committeeCount] = await sql`SELECT count(*) FROM "presentation_committee_assignments"`;
  const [posterSlotCount] = await sql`SELECT count(*) FROM "poster_slot_judges"`;

  console.log("Presentations:", presCount.count);
  console.log("Submissions:", subCount.count);
  console.log("Users:", userCount.count);
  console.log("User Roles:", rolesCount.count);
  console.log("Evaluations (Scores):", evalCount.count);
  console.log("Committee Assignments:", committeeCount.count);
  console.log("Poster Slot Judges (Draft/Confirmed):", posterSlotCount.count);

  console.log("\nSample track name counts in presentations:");
  const trackPres = await sql`
    SELECT t.name, count(*) 
    FROM presentation_assignments p
    LEFT JOIN submissions s ON p.submission_id = s.id
    LEFT JOIN tracks t ON s.track_id = t.id
    GROUP BY t.name
  `;
  console.table(trackPres);
}

main().catch(console.error);
