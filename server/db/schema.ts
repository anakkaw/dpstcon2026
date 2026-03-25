import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
  "ADMIN",
  "PROGRAM_CHAIR",
  "REVIEWER",
  "COMMITTEE",
  "AUTHOR",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "DRAFT",
  "ADVISOR_APPROVAL_PENDING",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUIRED",
  "REBUTTAL",
  "ACCEPTED",
  "REJECTED",
  "DESK_REJECTED",
  "CAMERA_READY_PENDING",
  "CAMERA_READY_SUBMITTED",
  "WITHDRAWN",
]);

export const advisorApprovalStatusEnum = pgEnum("advisor_approval_status", [
  "NOT_REQUESTED",
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const fileKindEnum = pgEnum("file_kind", [
  "MANUSCRIPT",
  "SUPPLEMENTARY",
  "CAMERA_READY",
]);

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "COMPLETED",
  "OVERDUE",
]);

export const reviewRecommendationEnum = pgEnum("review_recommendation", [
  "ACCEPT",
  "REVISE",
  "REJECT",
]);

export const decisionOutcomeEnum = pgEnum("decision_outcome", [
  "ACCEPT",
  "REJECT",
  "CONDITIONAL_ACCEPT",
  "DESK_REJECT",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "ASSIGNMENT",
  "REVIEW_REMINDER",
  "DECISION",
  "REBUTTAL",
  "SYSTEM",
]);

export const bidPreferenceEnum = pgEnum("bid_preference", [
  "EAGER",
  "WILLING",
  "NEUTRAL",
  "NOT_PREFERRED",
  "CONFLICT",
]);

export const discussionVisibilityEnum = pgEnum("discussion_visibility", [
  "REVIEWERS_ONLY",
  "AUTHOR_VISIBLE",
  "CHAIRS_ONLY",
]);

export const presentationTypeEnum = pgEnum("presentation_type", [
  "POSTER",
  "ORAL",
]);

export const presentationAssignmentStatusEnum = pgEnum(
  "presentation_assignment_status",
  ["PENDING", "SCHEDULED", "COMPLETED"]
);

export const outgoingEmailStatusEnum = pgEnum("outgoing_email_status", [
  "PENDING",
  "SENT",
  "FAILED",
]);

// ─── Better Auth Tables ──────────────────────────────────────

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    role: roleEnum("role").default("AUTHOR").notNull(),
    nameEn: varchar("name_en", { length: 255 }),
    affiliation: varchar("affiliation", { length: 500 }),
    bio: text("bio"),
    // Bilingual name fields
    prefixTh: varchar("prefix_th", { length: 50 }),
    prefixEn: varchar("prefix_en", { length: 50 }),
    firstNameTh: varchar("first_name_th", { length: 255 }),
    lastNameTh: varchar("last_name_th", { length: 255 }),
    firstNameEn: varchar("first_name_en", { length: 255 }),
    lastNameEn: varchar("last_name_en", { length: 255 }),
    // Invite-only fields
    inviteToken: varchar("invite_token", { length: 255 }),
    inviteExpiresAt: timestamp("invite_expires_at"),
    isActive: boolean("is_active").notNull().default(false),
  },
  (table) => [index("user_invite_token_idx").on(table.inviteToken)]
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Application Tables (Single Conference) ──────────────────

// Conference settings — single row, key-value
export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tracks = pgTable("tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  headUserId: text("head_user_id").references(() => user.id),
});

export const trackMembers = pgTable(
  "track_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .references(() => tracks.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    role: roleEnum("role").notNull(), // REVIEWER or COMMITTEE
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    index("track_members_track_idx").on(table.trackId),
    index("track_members_user_idx").on(table.userId),
  ]
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    role: roleEnum("role").notNull(),
    trackId: uuid("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_roles_user_idx").on(table.userId),
    index("user_roles_role_idx").on(table.role),
  ]
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id")
      .references(() => user.id)
      .notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    titleEn: varchar("title_en", { length: 500 }),
    abstract: text("abstract"),
    abstractEn: text("abstract_en"),
    keywords: varchar("keywords", { length: 500 }),
    keywordsEn: varchar("keywords_en", { length: 500 }),
    status: submissionStatusEnum("status").default("DRAFT").notNull(),
    fileUrl: varchar("file_url", { length: 1000 }),
    cameraReadyUrl: varchar("camera_ready_url", { length: 1000 }),
    trackId: uuid("track_id").references(() => tracks.id),
    advisorEmail: varchar("advisor_email", { length: 255 }),
    advisorName: varchar("advisor_name", { length: 255 }),
    advisorApprovalStatus: advisorApprovalStatusEnum(
      "advisor_approval_status"
    ).default("NOT_REQUESTED"),
    advisorApprovalToken: varchar("advisor_approval_token", { length: 255 }),
    advisorApprovalAt: timestamp("advisor_approval_at"),
    rebuttalText: text("rebuttal_text"),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("submissions_status_idx").on(table.status),
    index("submissions_author_idx").on(table.authorId),
    index("submissions_track_idx").on(table.trackId),
    index("submissions_advisor_token_idx").on(table.advisorApprovalToken),
  ]
);

export const coAuthors = pgTable(
  "co_authors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .references(() => submissions.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    affiliation: varchar("affiliation", { length: 500 }),
    orderIndex: integer("order_index").default(0),
  },
  (table) => [index("co_authors_submission_idx").on(table.submissionId)]
);

export const reviewAssignments = pgTable(
  "review_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .references(() => submissions.id, { onDelete: "cascade" })
      .notNull(),
    reviewerId: text("reviewer_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    status: assignmentStatusEnum("status").default("PENDING").notNull(),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    respondedAt: timestamp("responded_at"),
    dueDate: timestamp("due_date"),
  },
  (table) => [
    index("review_assignments_submission_idx").on(table.submissionId),
    index("review_assignments_reviewer_status_idx").on(
      table.reviewerId,
      table.status
    ),
  ]
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .references(() => submissions.id, { onDelete: "cascade" })
      .notNull(),
    reviewerId: text("reviewer_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    assignmentId: uuid("assignment_id").references(() => reviewAssignments.id, { onDelete: "set null" }),
    commentsToAuthor: text("comments_to_author"),
    commentsToChair: text("comments_to_chair"),
    recommendation: reviewRecommendationEnum("recommendation"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("reviews_submission_idx").on(table.submissionId),
    index("reviews_reviewer_idx").on(table.reviewerId),
  ]
);

export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .references(() => submissions.id, { onDelete: "cascade" })
      .notNull(),
    decidedBy: text("decided_by")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    outcome: decisionOutcomeEnum("outcome").notNull(),
    comments: text("comments"),
    conditions: text("conditions"),
    decidedAt: timestamp("decided_at").defaultNow().notNull(),
  },
  (table) => [index("decisions_submission_idx").on(table.submissionId)]
);

export const conflicts = pgTable(
  "conflicts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .references(() => submissions.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("conflicts_submission_idx").on(table.submissionId),
    index("conflicts_user_idx").on(table.userId),
    uniqueIndex("conflicts_submission_user_unique").on(table.submissionId, table.userId),
  ]
);

export const bids = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .references(() => submissions.id, { onDelete: "cascade" })
      .notNull(),
    reviewerId: text("reviewer_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    preference: bidPreferenceEnum("preference").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("bids_submission_idx").on(table.submissionId),
    index("bids_reviewer_idx").on(table.reviewerId),
    uniqueIndex("bids_submission_reviewer_unique").on(table.submissionId, table.reviewerId),
  ]
);

export const discussions = pgTable(
  "discussions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .references(() => submissions.id, { onDelete: "cascade" })
      .notNull(),
    authorId: text("author_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    message: text("message").notNull(),
    visibility: discussionVisibilityEnum("visibility")
      .default("REVIEWERS_ONLY")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("discussions_submission_idx").on(table.submissionId)]
);

export const storedFiles = pgTable(
  "stored_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originalName: varchar("original_name", { length: 500 }).notNull(),
    storedKey: varchar("stored_key", { length: 1000 }).notNull().unique(),
    r2Url: varchar("r2_url", { length: 1000 }),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    size: integer("size").notNull(),
    kind: fileKindEnum("kind").notNull(),
    submissionId: uuid("submission_id").references(() => submissions.id),
    uploadedById: text("uploaded_by_id").references(() => user.id),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (table) => [index("stored_files_submission_idx").on(table.submissionId)]
);

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  fileKey: varchar("file_key", { length: 1000 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message"),
    isRead: boolean("is_read").default(false).notNull(),
    linkUrl: varchar("link_url", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_read_idx").on(table.userId, table.isRead),
  ]
);

export const presentationAssignments = pgTable(
  "presentation_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .references(() => submissions.id, { onDelete: "cascade" })
      .notNull(),
    type: presentationTypeEnum("type").notNull(),
    status: presentationAssignmentStatusEnum("status")
      .default("PENDING")
      .notNull(),
    scheduledAt: timestamp("scheduled_at"),
    room: varchar("room", { length: 100 }),
    duration: integer("duration"),
  },
  (table) => [
    index("presentation_status_idx").on(table.status),
    index("presentation_submission_idx").on(table.submissionId),
  ]
);

export const presentationCommitteeAssignments = pgTable(
  "presentation_committee_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    presentationId: uuid("presentation_id")
      .references(() => presentationAssignments.id, { onDelete: "cascade" })
      .notNull(),
    judgeId: text("judge_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [index("pres_committee_judge_idx").on(table.judgeId)]
);

export const presentationCriteria = pgTable("presentation_criteria", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  maxScore: integer("max_score").default(10).notNull(),
  weight: integer("weight").default(1).notNull(),
});

export const presentationEvaluations = pgTable(
  "presentation_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    presentationId: uuid("presentation_id")
      .references(() => presentationAssignments.id, { onDelete: "cascade" })
      .notNull(),
    judgeId: text("judge_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    scores: jsonb("scores"),
    comments: text("comments"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("pres_evaluations_presentation_idx").on(table.presentationId),
    index("pres_evaluations_judge_idx").on(table.judgeId),
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => user.id),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_entity_idx").on(table.entityType, table.entityId),
    index("audit_actor_idx").on(table.actorId),
    index("audit_created_at_idx").on(table.createdAt),
  ]
);

export const outgoingEmails = pgTable(
  "outgoing_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    to: varchar("to", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    html: text("html").notNull(),
    status: outgoingEmailStatusEnum("status").default("PENDING").notNull(),
    sentAt: timestamp("sent_at"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("outgoing_email_status_idx").on(table.status, table.createdAt),
  ]
);

// ─── Relations ───────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  submissions: many(submissions),
  reviews: many(reviews),
  reviewAssignments: many(reviewAssignments),
  notifications: many(notifications),
  userRoles: many(userRoles),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  head: one(user, { fields: [tracks.headUserId], references: [user.id] }),
  submissions: many(submissions),
  members: many(trackMembers),
}));

export const trackMembersRelations = relations(trackMembers, ({ one }) => ({
  track: one(tracks, { fields: [trackMembers.trackId], references: [tracks.id] }),
  user: one(user, { fields: [trackMembers.userId], references: [user.id] }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(user, { fields: [userRoles.userId], references: [user.id] }),
  track: one(tracks, { fields: [userRoles.trackId], references: [tracks.id] }),
}));

export const submissionsRelations = relations(
  submissions,
  ({ one, many }) => ({
    author: one(user, {
      fields: [submissions.authorId],
      references: [user.id],
    }),
    track: one(tracks, {
      fields: [submissions.trackId],
      references: [tracks.id],
    }),
    reviews: many(reviews),
    coAuthors: many(coAuthors),
    reviewAssignments: many(reviewAssignments),
    discussions: many(discussions),
    files: many(storedFiles),
  })
);

export const coAuthorsRelations = relations(coAuthors, ({ one }) => ({
  submission: one(submissions, {
    fields: [coAuthors.submissionId],
    references: [submissions.id],
  }),
}));

export const reviewAssignmentsRelations = relations(
  reviewAssignments,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [reviewAssignments.submissionId],
      references: [submissions.id],
    }),
    reviewer: one(user, {
      fields: [reviewAssignments.reviewerId],
      references: [user.id],
    }),
  })
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  submission: one(submissions, {
    fields: [reviews.submissionId],
    references: [submissions.id],
  }),
  reviewer: one(user, {
    fields: [reviews.reviewerId],
    references: [user.id],
  }),
  assignment: one(reviewAssignments, {
    fields: [reviews.assignmentId],
    references: [reviewAssignments.id],
  }),
}));

export const discussionsRelations = relations(discussions, ({ one }) => ({
  submission: one(submissions, {
    fields: [discussions.submissionId],
    references: [submissions.id],
  }),
  author: one(user, {
    fields: [discussions.authorId],
    references: [user.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id],
  }),
}));

export const presentationAssignmentsRelations = relations(
  presentationAssignments,
  ({ one, many }) => ({
    submission: one(submissions, {
      fields: [presentationAssignments.submissionId],
      references: [submissions.id],
    }),
    committeeAssignments: many(presentationCommitteeAssignments),
    evaluations: many(presentationEvaluations),
  })
);

export const presentationCommitteeRelations = relations(
  presentationCommitteeAssignments,
  ({ one }) => ({
    presentation: one(presentationAssignments, {
      fields: [presentationCommitteeAssignments.presentationId],
      references: [presentationAssignments.id],
    }),
    judge: one(user, {
      fields: [presentationCommitteeAssignments.judgeId],
      references: [user.id],
    }),
  })
);

export const presentationEvaluationsRelations = relations(
  presentationEvaluations,
  ({ one }) => ({
    presentation: one(presentationAssignments, {
      fields: [presentationEvaluations.presentationId],
      references: [presentationAssignments.id],
    }),
    judge: one(user, {
      fields: [presentationEvaluations.judgeId],
      references: [user.id],
    }),
  })
);

export const bidsRelations = relations(bids, ({ one }) => ({
  submission: one(submissions, {
    fields: [bids.submissionId],
    references: [submissions.id],
  }),
  reviewer: one(user, {
    fields: [bids.reviewerId],
    references: [user.id],
  }),
}));

export const conflictsRelations = relations(conflicts, ({ one }) => ({
  submission: one(submissions, {
    fields: [conflicts.submissionId],
    references: [submissions.id],
  }),
  user: one(user, {
    fields: [conflicts.userId],
    references: [user.id],
  }),
}));

export const storedFilesRelations = relations(storedFiles, ({ one }) => ({
  submission: one(submissions, {
    fields: [storedFiles.submissionId],
    references: [submissions.id],
  }),
  uploadedBy: one(user, {
    fields: [storedFiles.uploadedById],
    references: [user.id],
  }),
}));
