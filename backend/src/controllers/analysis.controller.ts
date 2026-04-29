/* istanbul ignore file */
import { Request, Response } from "express";
import { runAnalysis } from "../services/analysis.service";

export async function analyseReport(req: Request, res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const report = req.body;

    req.on("close", () => {
        console.log("Client disconnected");
    });

    try {
        const issues = await runAnalysis(report, (processed: any, total) => {
            const percent = Math.round((processed / total) * 100);

            res.write(`data: ${JSON.stringify({ progress: percent })}\n\n`);
        });

        res.write(`data: ${JSON.stringify({ done: true, issues })}\n\n`);
        res.end();

    } catch (err) {
        console.error(err);
        res.write(`data: ${JSON.stringify({ error: "Analysis failed" })}\n\n`);
        res.end();
    }
}