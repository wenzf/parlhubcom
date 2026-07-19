// /app/lib/std/json.ts

export function parseJSON(jsonString: string | unknown): object | null {
    if (typeof jsonString !== "string") {
        return null
    }
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return null
    }
}