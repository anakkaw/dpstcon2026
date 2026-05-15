// Seed simple mock presentation committee users by track.
// Run with: npm run seed:mock-committees
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { randomBytes, randomUUID, scrypt } from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const sql = neon(DATABASE_URL);
const MOCK_PASSWORD = process.env.MOCK_COMMITTEE_PASSWORD || "committee1234";

type TrackKey = "math" | "comp" | "chem" | "biol" | "phy";

type MockCommittee = {
  prefixTh: string;
  firstNameTh: string;
  lastNameTh: string;
  prefixEn: string;
  firstNameEn: string;
  lastNameEn: string;
  affiliation: string;
};

const TRACKS: Record<TrackKey, { name: string; description: string; emailPrefix: string }> = {
  math: {
    name: "คณิตศาสตร์และสถิติ",
    description: "Mathematics and Statistics",
    emailPrefix: "math",
  },
  comp: {
    name: "วิทยาการคอมพิวเตอร์",
    description: "Computer Science",
    emailPrefix: "comp",
  },
  chem: {
    name: "เคมี",
    description: "Chemistry",
    emailPrefix: "chem",
  },
  biol: {
    name: "ชีววิทยา",
    description: "Biology",
    emailPrefix: "biol",
  },
  phy: {
    name: "ฟิสิกส์",
    description: "Physics",
    emailPrefix: "phy",
  },
};

function makeMockCommittees(prefix: string, count: number, affiliation: string): MockCommittee[] {
  return Array.from({ length: count }, (_, index) => {
    const name = `${prefix}${index + 1}`;
    return {
      prefixTh: "",
      firstNameTh: name,
      lastNameTh: "",
      prefixEn: "",
      firstNameEn: name,
      lastNameEn: "",
      affiliation,
    };
  });
}

const COMMITTEES: Record<TrackKey, MockCommittee[]> = {
  math: makeMockCommittees("Math", 8, "Mathematics Mock Committee"),
  comp: makeMockCommittees("Comp", 6, "Computer Science Mock Committee"),
  chem: makeMockCommittees("Chem", 6, "Chemistry Mock Committee"),
  biol: makeMockCommittees("Biol", 15, "Biology Mock Committee"),
  phy: makeMockCommittees("Phy", 6, "Physics Mock Committee"),
};

function composeDisplayName(person: MockCommittee) {
  return `${person.prefixTh}${person.firstNameTh}${person.lastNameTh ? ` ${person.lastNameTh}` : ""}`.trim();
}

function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(`${salt}:${key.toString("hex")}`);
    });
  });
}

async function ensureTrack(trackKey: TrackKey): Promise<string> {
  const track = TRACKS[trackKey];
  const [existing] = (await sql`
    SELECT id FROM tracks WHERE name = ${track.name} LIMIT 1
  `) as Array<{ id: string }>;

  if (existing?.id) return existing.id;

  const [created] = (await sql`
    INSERT INTO tracks (id, name, description)
    VALUES (gen_random_uuid(), ${track.name}, ${track.description})
    RETURNING id
  `) as Array<{ id: string }>;
  return created.id;
}

async function ensureCredentialAccount(userId: string) {
  const [existing] = (await sql`
    SELECT id FROM account WHERE user_id = ${userId} AND provider_id = 'credential' LIMIT 1
  `) as Array<{ id: string }>;

  const salt = randomBytes(16).toString("hex");
  const password = await hashPassword(MOCK_PASSWORD, salt);

  if (existing?.id) {
    await sql`
      UPDATE account
      SET password = ${password}, updated_at = NOW()
      WHERE id = ${existing.id}
    `;
    return;
  }

  await sql`
    INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
    VALUES (${randomUUID()}, ${userId}, 'credential', ${userId}, ${password}, NOW(), NOW())
  `;
}

async function upsertCommittee(trackKey: TrackKey, index: number, person: MockCommittee, trackId: string) {
  const track = TRACKS[trackKey];
  const email = `committee.${track.emailPrefix}${String(index + 1).padStart(2, "0")}@dpstcon.org`;
  const name = composeDisplayName(person);

  const [existing] = (await sql`
    SELECT id FROM "user" WHERE email = ${email} LIMIT 1
  `) as Array<{ id: string }>;

  const userId = existing?.id ?? randomUUID();

  if (existing?.id) {
    await sql`
      UPDATE "user"
      SET
        name = ${name},
        role = 'COMMITTEE',
        affiliation = ${person.affiliation},
        prefix_th = ${person.prefixTh},
        first_name_th = ${person.firstNameTh},
        last_name_th = ${person.lastNameTh},
        prefix_en = ${person.prefixEn},
        first_name_en = ${person.firstNameEn},
        last_name_en = ${person.lastNameEn},
        email_verified = true,
        is_active = true,
        updated_at = NOW()
      WHERE id = ${userId}
    `;
  } else {
    await sql`
      INSERT INTO "user" (
        id, name, email, email_verified, role, affiliation,
        prefix_th, first_name_th, last_name_th,
        prefix_en, first_name_en, last_name_en,
        is_active, created_at, updated_at
      )
      VALUES (
        ${userId}, ${name}, ${email}, true, 'COMMITTEE', ${person.affiliation},
        ${person.prefixTh}, ${person.firstNameTh}, ${person.lastNameTh},
        ${person.prefixEn}, ${person.firstNameEn}, ${person.lastNameEn},
        true, NOW(), NOW()
      )
    `;
  }

  await ensureCredentialAccount(userId);

  await sql`
    INSERT INTO user_roles (id, user_id, role, track_id, created_at)
    VALUES (gen_random_uuid(), ${userId}, 'COMMITTEE', ${trackId}, NOW())
    ON CONFLICT DO NOTHING
  `;

  await sql`
    INSERT INTO track_members (id, track_id, user_id, role, added_at)
    VALUES (gen_random_uuid(), ${trackId}, ${userId}, 'COMMITTEE', NOW())
    ON CONFLICT DO NOTHING
  `;

  return { email, name };
}

async function main() {
  console.log("\n=== Seeding mock presentation committees ===\n");
  console.log(`Mock account password: ${MOCK_PASSWORD}`);

  let total = 0;

  for (const trackKey of Object.keys(COMMITTEES) as TrackKey[]) {
    const trackId = await ensureTrack(trackKey);
    const committees = COMMITTEES[trackKey];
    console.log(`\n${TRACKS[trackKey].name} (${committees.length})`);

    for (let index = 0; index < committees.length; index += 1) {
      const result = await upsertCommittee(trackKey, index, committees[index], trackId);
      total += 1;
      console.log(`  ${String(index + 1).padStart(2, "0")}. ${result.name} <${result.email}>`);
    }
  }

  console.log(`\nDone. Upserted ${total} mock committee users.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
