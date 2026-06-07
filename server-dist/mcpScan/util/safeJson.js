export function safeParseJsonArray(text) {
    const extracted = extractJson(text);
    if (!extracted) {
        return [];
    }
    try {
        const v = JSON.parse(extracted);
        return Array.isArray(v) ? v : [];
    }
    catch {
        return [];
    }
}
export function safeParseJsonObject(text) {
    const extracted = extractJson(text);
    if (!extracted) {
        return null;
    }
    try {
        const v = JSON.parse(extracted);
        if (!v || typeof v !== 'object' || Array.isArray(v)) {
            return null;
        }
        return v;
    }
    catch {
        return null;
    }
}
function extractJson(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return trimmed;
    }
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
        return fenced[1].trim();
    }
    const firstObj = trimmed.indexOf('{');
    const firstArr = trimmed.indexOf('[');
    const start = firstArr >= 0 && (firstArr < firstObj || firstObj < 0) ? firstArr : firstObj;
    if (start < 0) {
        return null;
    }
    return trimmed.slice(start).trim();
}
