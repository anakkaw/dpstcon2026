import { OpenAPIHono } from "@hono/zod-openapi";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { logger } from "@/server/logger";
import { submissionRoutes } from "./routes/submissions";
import { reviewRoutes } from "./routes/reviews";
import { userRoutes } from "./routes/users";
import { dashboardRoutes } from "./routes/dashboard";
import { notificationRoutes } from "./routes/notifications";
import { advisorApprovalRoutes } from "./routes/advisor-approval";
import { presentationRoutes } from "./routes/presentations";
import { templateRoutes } from "./routes/templates";
import { exportRoutes } from "./routes/exports";
import { trackMemberRoutes } from "./routes/track-members";
import { trackRoutes } from "./routes/tracks";
import { activateRoutes } from "./routes/activate";
import { emailLogRoutes } from "./routes/email-logs";
import { settingsRoutes } from "./routes/settings";

const app = new OpenAPIHono().basePath("/api");

// Request logging
app.use("/*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info("API request", {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration: ms,
  });
});

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  logger.error("Unhandled API error", {
    method: c.req.method,
    path: c.req.path,
    error: err.message,
  });
  return c.json({ error: "Internal server error" }, 500);
});

// CSRF protection — allows same-origin requests only
app.use("/*", csrf({
  origin: (origin) => {
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return origin === new URL(appUrl).origin;
  },
}));

app.route("/submissions", submissionRoutes);
app.route("/reviews", reviewRoutes);
app.route("/users", userRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/notifications", notificationRoutes);
app.route("/advisor-approval", advisorApprovalRoutes);
app.route("/presentations", presentationRoutes);
app.route("/templates", templateRoutes);
app.route("/exports", exportRoutes);
app.route("/track-members", trackMemberRoutes);
app.route("/tracks", trackRoutes);
app.route("/activate", activateRoutes);
app.route("/email-logs", emailLogRoutes);
app.route("/settings", settingsRoutes);

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export { app };
export type AppType = typeof app;
