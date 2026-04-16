"use server";

// Review-related server actions have been consolidated into the API routes
// at /api/reviews/reviews and /api/reviews/decisions.
//
// The Hono API endpoints handle:
// - Review submission: POST /api/reviews/reviews
// - Decision making: POST /api/reviews/decisions
// - Assignment management: POST/DELETE /api/reviews/assignments/*
//
// This file is kept as a namespace placeholder. New server actions
// related to reviews should be added here only if they need
// revalidatePath() or other server-action-specific features.
