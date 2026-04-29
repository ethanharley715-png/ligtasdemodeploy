import { prisma } from "../db/prisma";


export async function findSimilarIssues(embedding: number[]) {

    const results = await prisma.$queryRaw`
  SELECT *
  FROM "AiIssue"
  WHERE embedding IS NOT NULL
  ORDER BY embedding <-> ${embedding}
  LIMIT 5
`;

  return results;
}