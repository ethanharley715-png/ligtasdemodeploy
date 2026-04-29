export type Section = {
    id: number;
    title: string;
    content: string;
};

export function splitIntoSections(text: string): Section[] {
    const lines = text.split("\n");

    const sections: Section[] = [];
    let current: string[] = [];

    const isRealTitle = (line: string) => {
        const l = line.trim();

        // Must look like: "9. Title" or "9.1. Title"
        if (!/^\d+(\.\d+)*\.\s+.+/.test(l)) return false;

        // Reject TOC lines like "Title19"
        if (/\d{1,3}$/.test(l)) return false;

        return true;
    };

    for (const line of lines) {
        if (isRealTitle(line)) {
            if (current.length) {
                sections.push(buildSection(current, sections.length));
                current = [];
            }
        }
        current.push(line);
    }

    if (current.length) {
        sections.push(buildSection(current, sections.length));
    }

    return sections;
}

function buildSection(lines: string[], index: number): Section {
    const content = lines.join("\n").trim();
    const firstLine = lines[0]?.trim() || "";

    return {
        id: index,
        title: extractTitle(firstLine, index),
        content
    };
}

function extractTitle(firstLine: string, index: number): string {
    if (/^\d+(\.\d+)*\.\s+/.test(firstLine)) {
        return firstLine;
    }
    return `Section ${index + 1}`;
}