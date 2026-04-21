import { logger } from "@/server/logger";
import { ADMIN_CONTACT_EMAIL } from "@/lib/constants";

const HTML_PAGE = (email: string) => `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>DPSTCon — ยกเลิกการรับอีเมล</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 560px; margin: 4rem auto; padding: 1.5rem; color: #1f2937; }
  h1 { color: #f97316; font-size: 1.4rem; }
  .box { background: #f8fafc; border-left: 4px solid #f97316; padding: 1rem 1.25rem; border-radius: 8px; margin-top: 1rem; }
  code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <h1>DPSTCon — รับเรื่องการยกเลิกอีเมลแล้ว</h1>
  <p>ระบบได้รับคำขอยกเลิกการรับอีเมลจาก <code>${email.replace(/[<>"&]/g, "")}</code> เรียบร้อยแล้ว</p>
  <div class="box">
    <p style="margin: 0;">หมายเหตุ: อีเมลของระบบ DPSTCon เป็นอีเมลแจ้งสถานะบทความและคำเชิญรับรองที่จำเป็น
    หากท่านเป็นอาจารย์ที่ปรึกษาที่ยังมีนิสิต/นักศึกษาในระบบ การยกเลิกอาจทำให้ท่านพลาดคำขอรับรองสำคัญ</p>
    <p style="margin: 0.5rem 0 0;">หากต้องการความช่วยเหลือ กรุณาติดต่อ <a href="mailto:${ADMIN_CONTACT_EMAIL}">${ADMIN_CONTACT_EMAIL}</a></p>
  </div>
</body>
</html>`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email") || "";

  if (email) {
    logger.info("Unsubscribe request received", { email });
  }

  return new Response(HTML_PAGE(email), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// RFC 8058 one-click unsubscribe
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email") || "";

  if (email) {
    logger.info("One-click unsubscribe", { email });
  }

  return new Response(null, { status: 200 });
}
