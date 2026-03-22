// Direct DB seed — run with: npx tsx scripts/seed-direct.ts
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { scrypt, randomBytes } from "crypto";

const sql = neon(process.env.DATABASE_URL!);

function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(salt + ":" + key.toString("hex"));
    });
  });
}

function genId() {
  return randomBytes(16).toString("hex");
}

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: string;
  affiliation: string;
}

const USERS: SeedUser[] = [
  { name: "Admin DPSTCon", email: "admin@dpstcon.org", password: "admin1234", role: "ADMIN", affiliation: "DPSTCon" },
  { name: "ดร.สมชาย ประธาน", email: "chair@dpstcon.org", password: "chair1234", role: "PROGRAM_CHAIR", affiliation: "จุฬาลงกรณ์มหาวิทยาลัย" },
  { name: "ผศ.ดร.วิชัย ทบทวน", email: "reviewer1@dpstcon.org", password: "review1234", role: "REVIEWER", affiliation: "มหาวิทยาลัยมหิดล" },
  { name: "รศ.ดร.สุภาพร ทบทวน", email: "reviewer2@dpstcon.org", password: "review1234", role: "REVIEWER", affiliation: "มหาวิทยาลัยเกษตรศาสตร์" },
  { name: "อ.ดร.ประเสริฐ กรรมการ", email: "committee@dpstcon.org", password: "comm1234", role: "COMMITTEE", affiliation: "มหาวิทยาลัยธรรมศาสตร์" },
  { name: "นายพงศ์ภัค นักศึกษา", email: "author1@dpstcon.org", password: "author1234", role: "AUTHOR", affiliation: "จุฬาลงกรณ์มหาวิทยาลัย" },
  { name: "นางสาวณัฐวดี นักศึกษา", email: "author2@dpstcon.org", password: "author1234", role: "AUTHOR", affiliation: "มหาวิทยาลัยมหิดล" },
];

async function main() {
  console.log("\n=== Seeding DPSTCon Database (Direct) ===\n");

  // 1. Create users + accounts
  console.log("1. Creating users...");
  const userIds: Record<string, string> = {};

  for (const u of USERS) {
    const userId = genId();
    const accountId = genId();
    const salt = randomBytes(16).toString("hex");
    const hashedPw = await hashPassword(u.password, salt);

    await sql`INSERT INTO "user" (id, name, email, email_verified, role, affiliation, created_at, updated_at)
      VALUES (${userId}, ${u.name}, ${u.email}, true, ${u.role}, ${u.affiliation}, NOW(), NOW())
      ON CONFLICT (email) DO NOTHING`;

    await sql`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
      VALUES (${accountId}, ${userId}, 'credential', ${userId}, ${hashedPw}, NOW(), NOW())
      ON CONFLICT DO NOTHING`;

    userIds[u.email] = userId;
    console.log(`  ${u.role.padEnd(13)} ${u.email}`);
  }

  // 2. Create tracks
  console.log("\n2. Creating tracks...");
  const trackNames = [
    { name: "Computer Science", desc: "วิทยาการคอมพิวเตอร์และเทคโนโลยีสารสนเทศ" },
    { name: "Mathematics", desc: "คณิตศาสตร์และสถิติ" },
    { name: "Physics", desc: "ฟิสิกส์และดาราศาสตร์" },
    { name: "Chemistry", desc: "เคมีและวิทยาศาสตร์วัสดุ" },
    { name: "Biology", desc: "ชีววิทยาและเทคโนโลยีชีวภาพ" },
  ];
  for (const t of trackNames) {
    await sql`INSERT INTO tracks (id, name, description) VALUES (gen_random_uuid(), ${t.name}, ${t.desc})`;
  }
  console.log(`  Created ${trackNames.length} tracks`);

  // 3. Get track IDs
  const [csTrack] = await sql`SELECT id FROM tracks WHERE name = 'Computer Science'`;

  // 4. Create submissions
  console.log("\n3. Creating submissions...");
  const authorId = userIds["author1@dpstcon.org"];
  const author2Id = userIds["author2@dpstcon.org"];

  const papers = [
    {
      authorId,
      title: "การประยุกต์ใช้ Deep Learning สำหรับการวิเคราะห์ภาพถ่ายดาวเทียม",
      abstract: "งานวิจัยนี้นำเสนอแนวทางการใช้ Deep Learning โดยเฉพาะ Convolutional Neural Networks (CNN) ในการวิเคราะห์และจำแนกภาพถ่ายดาวเทียมเพื่อตรวจจับการเปลี่ยนแปลงของพื้นที่ป่าไม้ในประเทศไทย ผลการทดลองพบว่าโมเดลที่พัฒนาขึ้นมีความแม่นยำสูงถึง 94.5%",
      keywords: "Deep Learning, Satellite Image, CNN, Forest Detection",
      status: "UNDER_REVIEW",
      trackId: csTrack?.id,
    },
    {
      authorId,
      title: "ระบบตรวจจับมลพิษทางอากาศแบบ Real-time ด้วย IoT และ Machine Learning",
      abstract: "การพัฒนาระบบ IoT Sensor Network ร่วมกับ Machine Learning สำหรับการตรวจวัดและพยากรณ์คุณภาพอากาศแบบ Real-time ในพื้นที่กรุงเทพมหานคร โดยใช้ LSTM Neural Network ในการพยากรณ์ค่า PM2.5 ล่วงหน้า 24 ชั่วโมง",
      keywords: "IoT, Air Quality, PM2.5, LSTM, Machine Learning",
      status: "SUBMITTED",
      trackId: csTrack?.id,
    },
    {
      authorId,
      title: "การศึกษาประสิทธิภาพของ Quantum Computing ในการแก้ปัญหา Optimization",
      abstract: "เปรียบเทียบประสิทธิภาพของ Quantum Annealing และ Classical Computing ในการแก้ปัญหา Combinatorial Optimization",
      keywords: "Quantum Computing, Optimization, Quantum Annealing",
      status: "DRAFT",
      trackId: null,
    },
    {
      authorId: author2Id,
      title: "การพัฒนาวัคซีน mRNA สำหรับโรคติดเชื้อไวรัสโคโรนา สายพันธุ์ใหม่",
      abstract: "งานวิจัยนี้ศึกษาการออกแบบและพัฒนาวัคซีน mRNA ที่มีประสิทธิภาพสูงในการกระตุ้นภูมิคุ้มกันต่อโรค COVID-19 สายพันธุ์ใหม่ที่พบในปี 2026",
      keywords: "mRNA Vaccine, COVID-19, Immunology",
      status: "ACCEPTED",
      trackId: null,
    },
  ];

  const submissionIds: string[] = [];
  for (const p of papers) {
    const [sub] = await sql`INSERT INTO submissions (id, author_id, title, abstract, keywords, status, track_id, submitted_at, created_at, updated_at)
      VALUES (gen_random_uuid(), ${p.authorId}, ${p.title}, ${p.abstract}, ${p.keywords}, ${p.status}, ${p.trackId}, ${p.status !== "DRAFT" ? new Date().toISOString() : null}, NOW(), NOW())
      RETURNING id`;
    submissionIds.push(sub.id);
    console.log(`  ${p.status.padEnd(18)} "${p.title.substring(0, 50)}..."`);
  }

  // 5. Create review assignments for UNDER_REVIEW paper
  console.log("\n4. Creating review assignments...");
  const reviewerIds = [userIds["reviewer1@dpstcon.org"], userIds["reviewer2@dpstcon.org"]];
  const underReviewId = submissionIds[0]; // first paper is UNDER_REVIEW

  for (const revId of reviewerIds) {
    await sql`INSERT INTO review_assignments (id, submission_id, reviewer_id, status, assigned_at, due_date)
      VALUES (gen_random_uuid(), ${underReviewId}, ${revId}, 'PENDING', NOW(), ${new Date(Date.now() + 14 * 86400000).toISOString()})`;
    console.log(`  Assigned reviewer to "${papers[0].title.substring(0, 40)}..."`);
  }

  // 6. Create a completed review from reviewer1
  console.log("\n5. Creating sample review...");
  const [assignment] = await sql`SELECT id FROM review_assignments WHERE reviewer_id = ${reviewerIds[0]} LIMIT 1`;
  await sql`INSERT INTO reviews (id, submission_id, reviewer_id, assignment_id, score_originality, score_methodology, score_clarity, score_significance, score_overall, confidence, comments_to_author, comments_to_chair, recommendation, completed_at, created_at, updated_at)
    VALUES (gen_random_uuid(), ${underReviewId}, ${reviewerIds[0]}, ${assignment.id}, 8, 7, 9, 8, 8, 4,
    'บทความมีคุณภาพดี มีการนำเสนอผลการทดลองที่ชัดเจน แนะนำให้เพิ่มการเปรียบเทียบกับงานวิจัยที่เกี่ยวข้องมากขึ้น',
    'บทความนี้มีศักยภาพสูง แนะนำให้ตอบรับ',
    'ACCEPT', NOW(), NOW(), NOW())`;

  // Mark assignment as completed
  await sql`UPDATE review_assignments SET status = 'COMPLETED', responded_at = NOW() WHERE id = ${assignment.id}`;
  console.log("  Created review with score 8/10 (ACCEPT)");

  // 7. Create notifications
  console.log("\n6. Creating notifications...");
  for (const [email, uid] of Object.entries(userIds)) {
    await sql`INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
      VALUES (gen_random_uuid(), ${uid}, 'SYSTEM', 'ยินดีต้อนรับสู่ DPSTCon 2026', 'ระบบพร้อมใช้งานแล้ว กรุณาตรวจสอบข้อมูลของท่าน', false, NOW())`;
  }

  // Extra notifications for specific users
  await sql`INSERT INTO notifications (id, user_id, type, title, message, is_read, link_url, created_at)
    VALUES (gen_random_uuid(), ${reviewerIds[0]}, 'ASSIGNMENT', 'ได้รับมอบหมายรีวิวบทความใหม่', 'กรุณาตรวจสอบบทความ "การประยุกต์ใช้ Deep Learning..."', false, '/reviews', NOW())`;

  await sql`INSERT INTO notifications (id, user_id, type, title, message, is_read, link_url, created_at)
    VALUES (gen_random_uuid(), ${authorId}, 'SYSTEM', 'บทความของคุณอยู่ระหว่างรีวิว', 'บทความ "การประยุกต์ใช้ Deep Learning..." กำลังถูกพิจารณา', false, '/submissions', NOW())`;

  console.log("  Created notifications for all users");

  console.log("\n=== Seed Complete ===\n");
  console.log("Test accounts:");
  console.log("┌──────────────────────────────────────────────────────────────┐");
  console.log("│ Role            │ Email                  │ Password         │");
  console.log("├──────────────────────────────────────────────────────────────┤");
  for (const u of USERS) {
    console.log(`│ ${u.role.padEnd(15)} │ ${u.email.padEnd(22)} │ ${u.password.padEnd(16)} │`);
  }
  console.log("└──────────────────────────────────────────────────────────────┘");
  console.log("\nData created:");
  console.log("  - 7 users (5 roles)");
  console.log("  - 5 tracks");
  console.log("  - 4 submissions (DRAFT, SUBMITTED, UNDER_REVIEW, ACCEPTED)");
  console.log("  - 2 review assignments + 1 completed review");
  console.log("  - Notifications for all users");
}

main().catch(console.error);
