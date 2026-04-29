import { prisma } from "../db/prisma";
import { Request, Response } from "express";

export async function getMetrics(req: Request, res: Response) {

 const total = await prisma.feedback.count();

 const positive = await prisma.feedback.count({
  where: { rating: "Correct" }
 });

 const negative = await prisma.feedback.count({
  where: { rating: "Needs Improvement" }
 });

 const satisfaction = total === 0 ? 0 : positive / total;

 res.json({
  total,
  positive,
  negative,
  satisfaction
 });

}