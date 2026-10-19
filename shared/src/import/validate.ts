// Gatekeeper for uploaded spreadsheets. Runs in the browser for instant
// feedback and again on the server, which is the check that counts.
//
// A file must be a small, plain-text CSV: right extension, no binary or
// executable content, valid UTF-8, and no script or markup. Nothing in the file
// is ever executed or rendered as HTML, but rejecting it keeps junk out of the
// database and out of the spreadsheets people later open from an export.

export type CsvRejection = "not-csv" | "unsafe";

const ALLOWED_TYPES = new Set([
  "",
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel", // what Windows reports for .csv
]);

// Leading bytes of archives, executables, documents and images.
const BINARY_SIGNATURES: number[][] = [
  [0x50, 0x4b, 0x03, 0x04], // zip / xlsx / docx / jar
  [0x4d, 0x5a], // Windows executable
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0x25, 0x50, 0x44, 0x46], // PDF
  [0xd0, 0xcf, 0x11, 0xe0], // legacy Office
  [0x1f, 0x8b], // gzip
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF
  [0x23, 0x21], // "#!" script
];

const MARKUP = /<\s*\/?\s*(script|iframe|object|embed|svg|html|body|link|meta|style|img|form)\b|<\?(php|xml)|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|\bon[a-z]{3,}\s*=\s*["']|<%/i;

export function checkCsvFile(file: { name: string; type: string }): CsvRejection | null {
  if (!/\.csv$/i.test(file.name)) return "not-csv";
  if (!ALLOWED_TYPES.has(file.type.toLowerCase())) return "not-csv";
  return null;
}

export function checkCsvBytes(bytes: Uint8Array): CsvRejection | null {
  for (const signature of BINARY_SIGNATURES) {
    if (signature.every((byte, index) => bytes[index] === byte)) return "not-csv";
  }
  // NUL and most control characters never appear in a text CSV.
  for (const byte of bytes) {
    if (byte === 0 || (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d)) return "not-csv";
  }
  return null;
}

// Returns the decoded text, or the reason the file was refused.
export function decodeCsv(bytes: Uint8Array): { text: string } | { rejected: CsvRejection } {
  const binary = checkCsvBytes(bytes);
  if (binary) return { rejected: binary };

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { rejected: "not-csv" };
  }
  if (MARKUP.test(text)) return { rejected: "unsafe" };
  return { text };
}
