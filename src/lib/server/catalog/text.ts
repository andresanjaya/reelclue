import "server-only";

// Unknown entities or broken markup disable text rather than guessing how browser would decode it.
export function cleanText(value: string) {
  const text = value.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi, entity => {
      const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
      const body = entity.slice(1, -1).toLowerCase();
      if (named[body]) return named[body];
      const n = body.startsWith("#x") ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "�";
    }).replace(/\s+/gu, " ").trim();
  if (/[<>�]|&(?:#\w+|[a-z]+);/i.test(text)) return null;
  return text;
}

function normalized(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function sanitizeSynopsis(raw: string | null, titles: readonly string[]) {
  const text = raw === null ? null : cleanText(raw);
  if (!text) return null;
  const names = [...new Set(titles.map(normalized).filter(Boolean))].sort((a, b) => b.length - a.length);
  // ponytail: common/short single-word aliases need human review; disable synopsis, keep other modes.
  if (names.some(name => name.length < 4 || ["the", "and", "home", "love", "life", "her", "it", "us", "up"].includes(name))) return null;
  const segments = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)];
  let norm = "";
  const positions: Array<{ start: number; end: number }> = [];
  for (const part of segments) {
    const piece = part.segment.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ");
    for (const char of piece) {
      if (char === " " && (!norm || norm.endsWith(" "))) continue;
      norm += char;
      for (let i = 0; i < char.length; i++) positions.push({ start: part.index, end: part.index + part.segment.length });
    }
  }
  const ranges: Array<{ start: number; end: number }> = [];
  for (const name of names) {
    let offset = 0;
    while ((offset = norm.indexOf(name, offset)) >= 0) {
      const end = offset + name.length;
      if ((offset === 0 || norm[offset - 1] === " ") && (end === norm.length || norm[end] === " ")) {
        ranges.push({ start: positions[offset].start, end: positions[end - 1].end });
      }
      offset = end;
    }
  }
  const merged: typeof ranges = [];
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  let result = text;
  for (const range of merged.reverse()) result = result.slice(0, range.start) + "[movie]" + result.slice(range.end);
  if (result.length > 600) {
    const prefix = [...result].slice(0, 600).join("");
    const sentence = prefix.lastIndexOf(". ") + 1;
    const boundary = sentence >= 100 ? sentence : prefix.lastIndexOf(" ");
    result = boundary > 0 ? prefix.slice(0, boundary).trim() : "";
  }
  const final = ` ${normalized(result)} `;
  if ([...result].length < 100 || names.some(name => final.includes(` ${name} `))) return null;
  return result;
}
