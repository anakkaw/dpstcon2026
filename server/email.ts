import { Resend } from "resend";
import { db } from "@/server/db";
import { outgoingEmails } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// ─── Email Provider (Resend) ─────────────────────────────

const FROM = "DPSTCon <noreply@acadscinu.org>";

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

/** Send email via Resend */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = getResend();
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }

  console.log("[Email] Sent via Resend:", opts.subject, "→", opts.to);
  return data;
}

/** Queue email: save to DB + send immediately. Tracks status in outgoingEmails table. */
export async function queueEmail(opts: {
  to: string;
  subject: string;
  html: string;
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

    console.error("[Email] Failed to send:", opts.subject, "→", opts.to, err);
  }

  return record;
}

// ─── Email Templates ──────────────────────────────────────

export function advisorApprovalEmail(data: {
  advisorName: string;
  studentName: string;
  paperTitle: string;
  approvalUrl: string;
}) {
  return {
    subject: `[DPSTCon] ขอความอนุเคราะห์รับรองบทความ — ${data.paperTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">DPSTCon — ขอรับรองบทความ</h2>
        <p>เรียน ${data.advisorName},</p>
        <p>นักศึกษา <strong>${data.studentName}</strong> ขอความอนุเคราะห์ท่านรับรองบทความ:</p>
        <p style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #f97316;">
          <strong>${data.paperTitle}</strong>
        </p>
        <p>กรุณาคลิกลิงก์ด้านล่างเพื่อดำเนินการ:</p>
        <a href="${data.approvalUrl}" style="display: inline-block; background: #f97316; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          ดำเนินการรับรอง
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System
        </p>
      </div>
    `,
  };
}

export function decisionEmail(data: {
  authorName: string;
  paperTitle: string;
  decision: string;
  comments?: string;
  submissionUrl?: string;
}) {
  const decisionMap: Record<string, { text: string; color: string }> = {
    ACCEPT: { text: "ตอบรับ (Accept)", color: "#22c55e" },
    REJECT: { text: "ปฏิเสธ (Reject)", color: "#ef4444" },
    CONDITIONAL_ACCEPT: { text: "ตอบรับแบบมีเงื่อนไข (Conditional Accept)", color: "#f59e0b" },
    DESK_REJECT: { text: "ปฏิเสธ (Desk Reject)", color: "#ef4444" },
  };
  const info = decisionMap[data.decision] || { text: data.decision, color: "#6b7280" };

  return {
    subject: `[DPSTCon] ผลการพิจารณาบทความ — ${data.paperTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">DPSTCon — ผลการพิจารณาบทความ</h2>
        <p>เรียน ${data.authorName},</p>
        <p>ขอแจ้งผลการพิจารณาบทความ <strong>${data.paperTitle}</strong>:</p>
        <p style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid ${info.color}; font-size: 16px;">
          <strong style="color: ${info.color};">${info.text}</strong>
        </p>
        ${data.comments ? `
        <div style="margin-top: 16px;">
          <p style="font-weight: bold; margin-bottom: 4px;">ความคิดเห็นจาก Committee:</p>
          <p style="background: #f8fafc; padding: 12px; border-radius: 8px; white-space: pre-wrap;">${data.comments}</p>
        </div>
        ` : ""}
        ${data.submissionUrl ? `
        <p style="margin-top: 16px;">
          <a href="${data.submissionUrl}" style="display: inline-block; background: #f97316; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            ดูรายละเอียดบทความ
          </a>
        </p>
        ` : ""}
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System
        </p>
      </div>
    `,
  };
}

export function inviteEmail(data: {
  userName: string;
  activationUrl: string;
  expiresInHours: number;
}) {
  return {
    subject: `[DPSTCon] เชิญเข้าร่วมระบบ — กรุณาตั้งรหัสผ่าน`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">DPSTCon — เชิญเข้าร่วมระบบ</h2>
        <p>เรียน ${escapeHtml(data.userName)},</p>
        <p>คุณได้รับเชิญให้เข้าร่วมระบบ DPSTCon Conference Management System</p>
        <p>กรุณาคลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านและเปิดใช้งานบัญชี:</p>
        <a href="${data.activationUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          ตั้งรหัสผ่านและเปิดใช้งาน
        </a>
        <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
          ลิงก์นี้จะหมดอายุใน ${data.expiresInHours} ชั่วโมง
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System
        </p>
      </div>
    `,
  };
}

/** Escape HTML to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function reviewAssignmentEmail(data: {
  reviewerName: string;
  paperTitle: string;
  dueDate?: string;
  loginUrl: string;
}) {
  return {
    subject: `[DPSTCon] คุณได้รับมอบหมายให้รีวิวบทความ — ${data.paperTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">DPSTCon — มอบหมายรีวิวบทความ</h2>
        <p>เรียน ${data.reviewerName},</p>
        <p>คุณได้รับมอบหมายให้รีวิวบทความ:</p>
        <p style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <strong>${data.paperTitle}</strong>
        </p>
        ${data.dueDate ? `<p>กรุณาส่งผลรีวิวภายในวันที่ <strong>${data.dueDate}</strong></p>` : ""}
        <a href="${data.loginUrl}" style="display: inline-block; background: #f97316; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          เข้าสู่ระบบเพื่อรีวิว
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          อีเมลนี้ส่งจากระบบ DPSTCon Conference Management System
        </p>
      </div>
    `,
  };
}
