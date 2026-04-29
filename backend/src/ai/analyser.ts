import pLimit from "p-limit";
import { buildPrompt } from "./promptBuilder";
import { safeParse } from "./parser";
import { Issue } from "./types";
import { getAiTextProvider, getProviderMaxCharsPerChunk } from "./providers";
import type { AiTextProvider } from "./providers/types";

type Section = {
  id: number;
  title: string;
  content: string;
};

function mergeSections(sections: Section[], maxChars: number, maxSections = 1): Section[][] {
  const batches: Section[][] = [];
  let currentBatch: Section[] = [];
  let currentSize = 0;

  for (const section of sections) {
    const sectionSize = section.content.length;
    const wouldExceedSize = currentSize + sectionSize > maxChars;
    const wouldExceedCount = currentBatch.length >= maxSections;

    if ((wouldExceedSize || wouldExceedCount) && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [section];
      currentSize = sectionSize;
      continue;
    }

    currentBatch.push(section);
    currentSize += sectionSize;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function buildMergedPrompt(batch: Section[]): string {
  return batch
    .map((section) => `# ${section.title}\n${section.content}`)
    .join("\n\n");
}

async function analyzeBatch(batch: Section[], provider: AiTextProvider): Promise<Issue[]> {
  const prompt = buildPrompt("Multiple Sections Analysis", buildMergedPrompt(batch));

  try {
    const rawResponse = await provider.generate(prompt);
    const parsed = await safeParse(rawResponse);
    return parsed.issues;
  } catch (error) {
    console.warn("[ai-analysis] batch failed", {
      provider: provider.name,
      sectionCount: batch.length,
      error: error instanceof Error ? error.message : "unknown_error",
    });

    if (batch.length === 1) {
      throw error;
    }

    const splitResults = await Promise.all(batch.map((section) => analyzeBatch([section], provider)));
    return splitResults.flat();
  }
}

export async function analyzeSections(
  sections: Section[],
  onProgress?: (issues: Issue[], processed: number, total: number) => void,
) {
  const filteredSections = sections.filter(
    (section) => !/^4\./.test(section.title.trim()) && section.content.trim().length > 0,
  );

  if (filteredSections.length === 0) {
    return { issues: [] };
  }

  const provider = getAiTextProvider();
  const batches = mergeSections(filteredSections, getProviderMaxCharsPerChunk());
  const total = filteredSections.length;
  let processed = 0;
  const results: Issue[] = [];
  const limit = pLimit(1);

  await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        const batchIssues = await analyzeBatch(batch, provider);
        results.push(...batchIssues);
        processed += batch.length;
        onProgress?.(batchIssues, processed, total);
        await new Promise((resolve) => setImmediate(resolve));
      }),
    ),
  );

  return { issues: results };
}
