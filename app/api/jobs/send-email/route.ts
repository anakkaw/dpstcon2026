import { queueEmail } from "@/server/email";

function verifyCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { to, subject, html, text } = await req.json();
    await queueEmail({ to, subject, html, text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[send-email] Error:", error);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
