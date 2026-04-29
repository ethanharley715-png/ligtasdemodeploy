export function parseJSON(text: string) {
    try {
        return JSON.parse(text);
    } catch {
        console.error("Invalid AI JSON response", {
            responseLength: text.length,
        });
        throw new Error("Invalid AI JSON");
    }
}
