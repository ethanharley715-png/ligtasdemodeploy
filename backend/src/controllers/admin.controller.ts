import { prisma } from "../db/prisma";
import { Request, Response } from "express";


export async function submitFeedback(req: Request, res: Response) {
  const { issueId, rating, comment } = req.body ?? {};

  if (typeof issueId !== "string" || issueId.trim() === "") {
    return res.status(400).json({ message: "A valid issueId is required." });
  }

  if (typeof rating !== "string" || rating.trim() === "") {
    return res.status(400).json({ message: "A valid rating is required." });
  }

  if (comment != null && typeof comment !== "string") {
    return res.status(400).json({ message: "Comment must be a string when provided." });
  }

  await prisma.feedback.create({
    data: {
      issueId: issueId.trim(),
      rating: rating.trim(),
      comment: typeof comment === "string" && comment.trim() !== "" ? comment.trim() : null,
    }
  });

  return res.json({ success: true });
}
