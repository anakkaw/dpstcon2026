import { OpenAPIHono } from "@hono/zod-openapi";
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
import { activateRoutes } from "./routes/activate";
import { emailLogRoutes } from "./routes/email-logs";

const app = new OpenAPIHono().basePath("/api");

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
app.route("/activate", activateRoutes);
app.route("/email-logs", emailLogRoutes);

app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

export { app };
export type AppType = typeof app;
