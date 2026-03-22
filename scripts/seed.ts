// Seed script — run with: npx tsx scripts/seed.ts
import "dotenv/config";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: string;
  affiliation?: string;
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

async function createUser(u: SeedUser) {
  // Sign up
  const signupRes = await fetch(`${APP_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: u.name, email: u.email, password: u.password }),
  });

  if (!signupRes.ok) {
    console.log(`  SKIP ${u.email} (already exists or error)`);
    return null;
  }

  const data = await signupRes.json();
  console.log(`  OK   ${u.email} → ${u.role}`);

  return data.user?.id || data.id;
}

async function updateRole(email: string, role: string, affiliation?: string) {
  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  await sql`UPDATE "user" SET role = ${role}, affiliation = ${affiliation || null}, updated_at = NOW() WHERE email = ${email}`;
}

async function createSubmissions(authorEmail: string) {
  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  const [author] = await sql`SELECT id FROM "user" WHERE email = ${authorEmail}`;
  if (!author) return;

  const papers = [
    {
      title: "การประยุกต์ใช้ Deep Learning สำหรับการวิเคราะห์ภาพถ่ายดาวเทียม",
      abstract: "งานวิจัยนี้นำเสนอแนวทางการใช้ Deep Learning โดยเฉพาะ Convolutional Neural Networks (CNN) ในการวิเคราะห์และจำแนกภาพถ่ายดาวเทียมเพื่อตรวจจับการเปลี่ยนแปลงของพื้นที่ป่าไม้ในประเทศไทย ผลการทดลองพบว่าโมเดลที่พัฒนาขึ้นมีความแม่นยำสูงถึง 94.5% ในการจำแนกพื้นที่ป่าไม้",
      keywords: "Deep Learning, Satellite Image, CNN, Forest Detection",
      status: "SUBMITTED",
    },
    {
      title: "ระบบตรวจจับมลพิษทางอากาศแบบ Real-time ด้วย IoT และ Machine Learning",
      abstract: "การพัฒนาระบบ IoT Sensor Network ร่วมกับ Machine Learning สำหรับการตรวจวัดและพยากรณ์คุณภาพอากาศแบบ Real-time ในพื้นที่กรุงเทพมหานคร โดยใช้ LSTM Neural Network ในการพยากรณ์ค่า PM2.5 ล่วงหน้า 24 ชั่วโมง",
      keywords: "IoT, Air Quality, PM2.5, LSTM, Machine Learning",
      status: "UNDER_REVIEW",
    },
    {
      title: "การศึกษาประสิทธิภาพของ Quantum Computing ในการแก้ปัญหา Optimization",
      abstract: "เปรียบเทียบประสิทธิภาพของ Quantum Annealing และ Classical Computing ในการแก้ปัญหา Combinatorial Optimization ขนาดใหญ่ พบว่า Quantum Computing มีข้อได้เปรียบในปัญหาที่มีขนาดมากกว่า 100 ตัวแปร",
      keywords: "Quantum Computing, Optimization, Quantum Annealing",
      status: "DRAFT",
    },
  ];

  for (const paper of papers) {
    await sql`INSERT INTO submissions (id, author_id, title, abstract, keywords, status, submitted_at, created_at, updated_at)
      VALUES (gen_random_uuid(), ${author.id}, ${paper.title}, ${paper.abstract}, ${paper.keywords}, ${paper.status}, ${paper.status !== "DRAFT" ? new Date().toISOString() : null}, NOW(), NOW())`;
    console.log(`  Paper: "${paper.title.substring(0, 40)}..." → ${paper.status}`);
  }
}

async function createReviewAssignments() {
  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  // Get the UNDER_REVIEW submission
  const [submission] = await sql`SELECT id FROM submissions WHERE status = 'UNDER_REVIEW' LIMIT 1`;
  if (!submission) return;

  // Get reviewers
  const reviewers = await sql`SELECT id FROM "user" WHERE role = 'REVIEWER'`;

  for (const reviewer of reviewers) {
    await sql`INSERT INTO review_assignments (id, submission_id, reviewer_id, status, assigned_at, due_date)
      VALUES (gen_random_uuid(), ${submission.id}, ${reviewer.id}, 'PENDING', NOW(), ${new Date(Date.now() + 14 * 86400000).toISOString()})`;
    console.log(`  Assigned reviewer ${reviewer.id} to submission`);
  }
}

async function createNotifications() {
  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  const users = await sql`SELECT id, role FROM "user"`;

  for (const u of users) {
    await sql`INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
      VALUES (gen_random_uuid(), ${u.id}, 'SYSTEM', 'ยินดีต้อนรับสู่ DPSTCon 2026', 'ระบบพร้อมใช้งานแล้ว กรุณาตรวจสอบข้อมูลของท่าน', false, NOW())`;
  }
  console.log(`  Created ${users.length} welcome notifications`);
}

async function createTracks() {
  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  const tracks = [
    { name: "Computer Science", description: "วิทยาการคอมพิวเตอร์และเทคโนโลยีสารสนเทศ" },
    { name: "Mathematics", description: "คณิตศาสตร์และสถิติ" },
    { name: "Physics", description: "ฟิสิกส์และดาราศาสตร์" },
    { name: "Chemistry", description: "เคมีและวิทยาศาสตร์วัสดุ" },
    { name: "Biology", description: "ชีววิทยาและเทคโนโลยีชีวภาพ" },
  ];

  for (const t of tracks) {
    await sql`INSERT INTO tracks (id, name, description) VALUES (gen_random_uuid(), ${t.name}, ${t.description})`;
  }
  console.log(`  Created ${tracks.length} tracks`);
}

async function main() {
  console.log("\n=== Seeding DPSTCon Database ===\n");

  console.log("1. Creating users...");
  for (const u of USERS) {
    await createUser(u);
  }

  console.log("\n2. Updating roles...");
  for (const u of USERS) {
    await updateRole(u.email, u.role, u.affiliation);
    console.log(`  ${u.email} → ${u.role}`);
  }

  console.log("\n3. Creating tracks...");
  await createTracks();

  console.log("\n4. Creating submissions for author1...");
  await createSubmissions("author1@dpstcon.org");

  console.log("\n5. Creating review assignments...");
  await createReviewAssignments();

  console.log("\n6. Creating notifications...");
  await createNotifications();

  console.log("\n=== Seed Complete ===\n");
  console.log("Test accounts:");
  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│ Role          │ Email                │ Password        │");
  console.log("├─────────────────────────────────────────────────────────┤");
  for (const u of USERS) {
    console.log(`│ ${u.role.padEnd(13)} │ ${u.email.padEnd(20)} │ ${u.password.padEnd(15)} │`);
  }
  console.log("└─────────────────────────────────────────────────────────┘");
}

main().catch(console.error);
