function truncateDeep(obj: any, depth = 0): any {
  if (depth > 5) return '[Max Depth Reached]';
  if (typeof obj === 'string')
    return obj.length > 500 ? obj.substring(0, 500) + '\n... [truncated]' : obj;
  if (Array.isArray(obj)) return obj.map((v) => truncateDeep(v, depth + 1));
  if (obj && typeof obj === 'object') {
    const res: any = {};
    for (const key in obj) res[key] = truncateDeep(obj[key], depth + 1);
    return res;
  }
  return obj;
}

export function safeStringify(input: any): string | null {
  if (!input) return null;
  try {
    return JSON.stringify(truncateDeep(input), null, 2);
  } catch {
    return 'Error stringifying input';
  }
}
