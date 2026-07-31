// Публичный API библиотеки svc-india
export function formatValue(v: string): string { return v.trim() }
export function parseList(raw: string): string[] { return raw.split(",") }
