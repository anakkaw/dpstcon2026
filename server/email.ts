import { Resend } from "resend";
import { db } from "@/server/db";
import { outgoingEmails } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/server/logger";

// ─── Email Provider (Resend) ─────────────────────────────

const FROM = "DPSTCon Academic <academic@acadscinu.org>";
const REPLY_TO = "watcharaponga@nu.ac.th";

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function getAppUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

/** Send email via Resend */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const resend = getResend();
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const unsubscribeUrl = `${getAppUrl()}/api/unsubscribe?email=${encodeURIComponent(opts.to)}`;
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    replyTo: REPLY_TO,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }

  logger.info("Email sent", { to: opts.to, subject: opts.subject });
  return data;
}

/** Queue email: save to DB + send immediately. Tracks status in outgoingEmails table. */
export async function queueEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  throwOnFailure?: boolean;
}) {
  // Save to outgoing_emails table
  const [record] = await db
    .insert(outgoingEmails)
    .values({
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      status: "PENDING",
    })
    .returning();

  try {
    await sendEmail(opts);

    // Mark as sent
    await db
      .update(outgoingEmails)
      .set({ status: "SENT", sentAt: new Date() })
      .where(eq(outgoingEmails.id, record.id));
  } catch (err) {
    // Mark as failed
    await db
      .update(outgoingEmails)
      .set({
        status: "FAILED",
        error: err instanceof Error ? err.message : "Unknown error",
      })
      .where(eq(outgoingEmails.id, record.id));

    logger.error("Email send failed", {
      to: opts.to,
      subject: opts.subject,
      error: err instanceof Error ? err.message : "Unknown error",
    });

    if (opts.throwOnFailure) {
      throw err;
    }
  }

  return record;
}

// ─── Helpers ──────────────────────────────────────────────

/** Escape HTML to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Validate and return a safe https URL, or "#" if invalid */
function escapeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return "#";
    return parsed.toString();
  } catch {
    return "#";
  }
}

// ─── Email Templates ──────────────────────────────────────

export function advisorApprovalEmail(data: {
  advisorName: string;
  studentName: string;
  paperTitle: string;
  approvalUrl: string;
}) {
  const safeUrl = escapeUrl(data.approvalUrl);
  return {
    subject: `[DPSTCon] ขอความอนุเคราะห์รับรองบทความ — ${data.paperTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">DPSTCon — ขอรับรองบทความ</h2>
        <p>เรียน ${escapeHtml(data.advisorName)},</p>
        <p>ตามที่ <strong>${escapeHtml(data.studentName)}</strong> นิสิต/นักศึกษาทุน พสวท. ที่อยู่ในความดูแลของท่าน ได้ทำการส่งบทคัดย่อ การประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569 เพื่อความถูกต้องและสมบูรณ์ คณะกรรมการฯจึงขอความอนุเคราะห์ท่านรับรองบทความ:</p>
        <p style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #f97316;">
          <strong>${escapeHtml(data.paperTitle)}</strong>
        </p>
        <p>กรุณาคลิกลิงก์ด้านล่างเพื่อดำเนินการ:</p>
        <a href="${safeUrl}" style="display: inline-block; background: #f97316; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          ดำเนินการรับรอง
        </a>
        <p style="margin-top: 16px; font-size: 13px; color: #374151;">
          ทั้งนี้หากท่านพบปัญหาในการใช้งานกรุณาติดต่อ ผศ.ดร.วัชรพงษ์ อนรรฆเมธี (<a href="mailto:watcharaponga@nu.ac.th">watcharaponga@nu.ac.th</a>)
        </p>
        <p style="margin-top: 8px; font-size: 13px; color: #374151;">ขอแสดงความนับถือ</p>
        <div style="margin-top: 8px; font-size: 13px; color: #374151; line-height: 1.6;">
          <p style="margin: 0; font-weight: bold;">คณะกรรมการฝ่ายวิชาการ</p>
          <p style="margin: 0;">การประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569</p>
          <p style="margin: 0;">คณะวิทยาศาสตร์ มหาวิทยาลัยนเรศวร</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System
        </p>
      </div>
    `,
    text: `เรียน ${data.advisorName},\n\nตามที่ ${data.studentName} นิสิต/นักศึกษาทุน พสวท. ที่อยู่ในความดูแลของท่าน ได้ทำการส่งบทคัดย่อ การประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569 เพื่อความถูกต้องและสมบูรณ์ คณะกรรมการฯจึงขอความอนุเคราะห์ท่านรับรองบทความ:\n"${data.paperTitle}"\n\nกรุณาดำเนินการรับรองที่:\n${safeUrl}\n\nทั้งนี้หากท่านพบปัญหาในการใช้งานกรุณาติดต่อ ผศ.ดร.วัชรพงษ์ อนรรฆเมธี (watcharaponga@nu.ac.th)\n\nขอแสดงความนับถือ\n\nคณะกรรมการฝ่ายวิชาการ\nการประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569\nคณะวิทยาศาสตร์ มหาวิทยาลัยนเรศวร\n---\nอีเมลนี้ส่งจากระบบ DPSTCon Conference Management System`,
  };
}

export function advisorResponseEmail(data: {
  authorName: string;
  advisorName: string;
  paperTitle: string;
  decision: "APPROVED" | "REJECTED";
  comments?: string;
  submissionUrl?: string;
}) {
  const isApproved = data.decision === "APPROVED";
  const statusText = isApproved ? "รับรองแล้ว" : "ปฏิเสธการรับรอง";
  const statusColor = isApproved ? "#22c55e" : "#ef4444";
  const safeUrl = data.submissionUrl ? escapeUrl(data.submissionUrl) : null;

  return {
    subject: `[DPSTCon] อาจารย์ที่ปรึกษา${isApproved ? "รับรอง" : "ปฏิเสธ"}บทความ — ${data.paperTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">DPSTCon — ผลการรับรองจากอาจารย์ที่ปรึกษา</h2>
        <p>เรียน ${escapeHtml(data.authorName)},</p>
        <p>อาจารย์ที่ปรึกษา <strong>${escapeHtml(data.advisorName)}</strong> ได้ดำเนินการรับรองบทความ:</p>
        <p style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #f97316;">
          <strong>${escapeHtml(data.paperTitle)}</strong>
        </p>
        <p style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid ${statusColor}; font-size: 16px; margin-top: 12px;">
          <strong style="color: ${statusColor};">${statusText}</strong>
        </p>
        ${data.comments ? `
        <div style="margin-top: 16px;">
          <p style="font-weight: bold; margin-bottom: 4px;">ความคิดเห็นจากอาจารย์ที่ปรึกษา:</p>
          <p style="background: #f8fafc; padding: 12px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(data.comments)}</p>
        </div>
        ` : ""}
        <p style="margin-top: 16px;">
          ${isApproved
            ? "บทความของคุณจะถูกส่งเข้าสู่กระบวนการพิจารณาต่อไป"
            : "กรุณาแก้ไขบทความตามคำแนะนำของอาจารย์ที่ปรึกษา แล้วส่งใหม่อีกครั้ง"}
        </p>
        ${safeUrl ? `
        <p style="margin-top: 16px;">
          <a href="${safeUrl}" style="display: inline-block; background: #f97316; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            ดูรายละเอียดบทความ
          </a>
        </p>
        ` : ""}
        <div style="margin-top: 16px; font-size: 13px; color: #374151; line-height: 1.6;">
          <p style="margin: 0; font-weight: bold;">คณะกรรมการฝ่ายวิชาการ</p>
          <p style="margin: 0;">การประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569</p>
          <p style="margin: 0;">คณะวิทยาศาสตร์ มหาวิทยาลัยนเรศวร</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System
        </p>
      </div>
    `,
    text: [
      `เรียน ${data.authorName},`,
      ``,
      `อาจารย์ที่ปรึกษา ${data.advisorName} ได้ดำเนินการรับรองบทความ:`,
      `"${data.paperTitle}"`,
      ``,
      `ผล: ${statusText}`,
      data.comments ? `\nความคิดเห็น:\n${data.comments}` : "",
      ``,
      isApproved
        ? "บทความของคุณจะถูกส่งเข้าสู่กระบวนการพิจารณาต่อไป"
        : "กรุณาแก้ไขบทความตามคำแนะนำของอาจารย์ที่ปรึกษา แล้วส่งใหม่อีกครั้ง",
      safeUrl ? `\nดูรายละเอียด: ${safeUrl}` : "",
      ``,
      `คณะกรรมการฝ่ายวิชาการ`,
      `การประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569`,
      `คณะวิทยาศาสตร์ มหาวิทยาลัยนเรศวร`,
      `---`,
      `อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System`,
    ].join("\n"),
  };
}

export function decisionEmail(data: {
  authorName: string;
  paperTitle: string;
  decision: string;
  comments?: string;
  conditions?: string;
  submissionUrl?: string;
}) {
  const decisionMap: Record<string, { text: string; color: string }> = {
    ACCEPT: { text: "ตอบรับ (Accept)", color: "#22c55e" },
    REJECT: { text: "ปฏิเสธ (Reject)", color: "#ef4444" },
    CONDITIONAL_ACCEPT: { text: "ตอบรับแบบมีเงื่อนไข (Conditional Accept)", color: "#f59e0b" },
    DESK_REJECT: { text: "ปฏิเสธ (Desk Reject)", color: "#ef4444" },
  };
  const info = decisionMap[data.decision] || { text: data.decision, color: "#6b7280" };
  const safeUrl = data.submissionUrl ? escapeUrl(data.submissionUrl) : null;

  return {
    subject: `[DPSTCon] ผลการพิจารณาบทความ — ${data.paperTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">DPSTCon — ผลการพิจารณาบทความ</h2>
        <p>เรียน ${escapeHtml(data.authorName)},</p>
        <p>ขอแจ้งผลการพิจารณาบทความ <strong>${escapeHtml(data.paperTitle)}</strong>:</p>
        <p style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid ${info.color}; font-size: 16px;">
          <strong style="color: ${info.color};">${info.text}</strong>
        </p>
        ${data.conditions ? `
        <div style="margin-top: 16px; background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px;">
          <p style="font-weight: bold; color: #92400e; margin: 0 0 8px 0;">⚠️ เงื่อนไขที่ต้องแก้ไขก่อนตอบรับ:</p>
          <p style="color: #78350f; white-space: pre-wrap; margin: 0;">${escapeHtml(data.conditions)}</p>
        </div>
        <p style="margin-top: 12px; font-size: 13px; color: #374151;">
          กรุณาแก้ไขบทความตามเงื่อนไขข้างต้น แล้วส่งใหม่ผ่านระบบภายในกำหนดเวลา
        </p>
        ` : ""}
        ${data.comments ? `
        <div style="margin-top: 16px;">
          <p style="font-weight: bold; margin-bottom: 4px;">ความคิดเห็นจาก Committee:</p>
          <p style="background: #f8fafc; padding: 12px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(data.comments)}</p>
        </div>
        ` : ""}
        ${safeUrl ? `
        <p style="margin-top: 16px;">
          <a href="${safeUrl}" style="display: inline-block; background: #f97316; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            ดูรายละเอียดและส่งบทความแก้ไข
          </a>
        </p>
        ` : ""}
        <div style="margin-top: 16px; font-size: 13px; color: #374151; line-height: 1.6;">
          <p style="margin: 0; font-weight: bold;">คณะกรรมการฝ่ายวิชาการ</p>
          <p style="margin: 0;">การประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569</p>
          <p style="margin: 0;">คณะวิทยาศาสตร์ มหาวิทยาลัยนเรศวร</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System
        </p>
      </div>
    `,
    text: [
      `เรียน ${data.authorName},`,
      ``,
      `ขอแจ้งผลการพิจารณาบทความ "${data.paperTitle}":`,
      ``,
      `ผล: ${info.text}`,
      data.conditions ? `\n⚠️ เงื่อนไขที่ต้องแก้ไขก่อนตอบรับ:\n${data.conditions}\n\nกรุณาแก้ไขบทความตามเงื่อนไขข้างต้น แล้วส่งใหม่ผ่านระบบภายในกำหนดเวลา` : "",
      data.comments ? `\nความคิดเห็นจาก Committee:\n${data.comments}` : "",
      safeUrl ? `\nดูรายละเอียดและส่งบทความแก้ไข: ${safeUrl}` : "",
      ``,
      `คณะกรรมการฝ่ายวิชาการ`,
      `การประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569`,
      `คณะวิทยาศาสตร์ มหาวิทยาลัยนเรศวร`,
      `---`,
      `อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System`,
    ].join("\n"),
  };
}

export function inviteEmail(data: {
  userName: string;
  activationUrl: string;
  expiresInHours: number;
}) {
  const safeUrl = escapeUrl(data.activationUrl);
  return {
    subject: `[DPSTCon] เชิญเข้าร่วมระบบ — กรุณาตั้งรหัสผ่าน`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">DPSTCon2026 — เชิญเข้าร่วมระบบ</h2>
        <p>เรียน ${escapeHtml(data.userName)},</p>
        <p>คุณได้รับเชิญให้เข้าร่วมระบบ DPSTCon Conference Management System</p>
        <p>กรุณาคลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านและเปิดใช้งานบัญชี:</p>
        <a href="${safeUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          ตั้งรหัสผ่านและเปิดใช้งาน
        </a>
        <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
          ลิงก์นี้จะหมดอายุใน ${data.expiresInHours} ชั่วโมง
        </p>
        <p style="margin-top: 16px; font-size: 13px; color: #374151;">
          ทั้งนี้หากพบปัญหาในการใช้งานกรุณาติดต่อ ผศ.ดร.วัชรพงษ์ อนรรฆเมธี (<a href="mailto:watcharaponga@nu.ac.th">watcharaponga@nu.ac.th</a>)
        </p>
        <div style="margin-top: 8px; font-size: 13px; color: #374151; line-height: 1.6;">
          <p style="margin: 0; font-weight: bold;">คณะกรรมการฝ่ายวิชาการ</p>
          <p style="margin: 0;">การประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569</p>
          <p style="margin: 0;">คณะวิทยาศาสตร์ มหาวิทยาลัยนเรศวร</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System
        </p>
      </div>
    `,
    text: `เรียน ${data.userName},\n\nคุณได้รับเชิญให้เข้าร่วมระบบ DPSTCon Conference Management System\n\nกรุณาตั้งรหัสผ่านและเปิดใช้งานบัญชีที่:\n${safeUrl}\n\nลิงก์นี้จะหมดอายุใน ${data.expiresInHours} ชั่วโมง\n\nทั้งนี้หากพบปัญหาในการใช้งานกรุณาติดต่อ ผศ.ดร.วัชรพงษ์ อนรรฆเมธี (watcharaponga@nu.ac.th)\n\nคณะกรรมการฝ่ายวิชาการ\nการประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569\nคณะวิทยาศาสตร์ มหาวิทยาลัยนเรศวร\n---\nอีเมลนี้ส่งจากระบบ DPSTCon Conference Management System`,
  };
}

export function reviewAssignmentEmail(data: {
  reviewerName: string;
  paperTitle: string;
  dueDate?: string;
  loginUrl: string;
}) {
  const safeUrl = escapeUrl(data.loginUrl);
  return {
    subject: `[DPSTCon] คุณได้รับมอบหมายให้รีวิวบทความ — ${data.paperTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">DPSTCon — มอบหมายรีวิวบทความ</h2>
        <p>เรียน ${escapeHtml(data.reviewerName)},</p>
        <p>คุณได้รับมอบหมายให้รีวิวบทความ:</p>
        <p style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <strong>${escapeHtml(data.paperTitle)}</strong>
        </p>
        ${data.dueDate ? `<p>กรุณาส่งผลรีวิวภายในวันที่ <strong>${data.dueDate}</strong></p>` : ""}
        <a href="${safeUrl}" style="display: inline-block; background: #f97316; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          เข้าสู่ระบบเพื่อรีวิว
        </a>
        <p style="margin-top: 16px; font-size: 13px; color: #374151;">
          ทั้งนี้หากท่านพบปัญหาในการใช้งานกรุณาติดต่อ ผศ.ดร.วัชรพงษ์ อนรรฆเมธี (<a href="mailto:watcharaponga@nu.ac.th">watcharaponga@nu.ac.th</a>)
        </p>
        <p style="margin-top: 8px; font-size: 13px; color: #374151;">ขอแสดงความนับถือ</p>
        <div style="margin-top: 8px; font-size: 13px; color: #374151; line-height: 1.6;">
          <p style="margin: 0; font-weight: bold;">คณะกรรมการฝ่ายวิชาการ</p>
          <p style="margin: 0;">การประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569</p>
          <p style="margin: 0;">คณะวิทยาศาสตร์ มหาวิทยาลัยนเรศวร</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System
        </p>
      </div>
    `,
    text: [
      `เรียน ${data.reviewerName},`,
      ``,
      `คุณได้รับมอบหมายให้รีวิวบทความ:`,
      `"${data.paperTitle}"`,
      data.dueDate ? `\nกรุณาส่งผลรีวิวภายในวันที่ ${data.dueDate}` : "",
      ``,
      `เข้าสู่ระบบเพื่อรีวิว: ${safeUrl}`,
      ``,
      `ทั้งนี้หากท่านพบปัญหาในการใช้งานกรุณาติดต่อ ผศ.ดร.วัชรพงษ์ อนรรฆเมธี (watcharaponga@nu.ac.th)`,
      ``,
      `ขอแสดงความนับถือ`,
      ``,
      `คณะกรรมการฝ่ายวิชาการ`,
      `การประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569`,
      `คณะวิทยาศาสตร์ มหาวิทยาลัยนเรศวร`,
      `---`,
      `อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System`,
    ].join("\n"),
  };
}
