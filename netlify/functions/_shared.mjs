import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { google } from "googleapis";

const spreadsheetId = process.env.GOOGLE_SHEET_ID;

export function reply(statusCode, body) {
  return new Response(JSON.stringify(body), { status: statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function credentials() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error("Google credentials not configured");
  return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

export function getSheets() {
  if (!spreadsheetId) throw new Error("Google Sheet not configured");
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}

export { spreadsheetId };

export function passwordMatches(password, savedHash) {
  const [algorithm, salt, expected] = String(savedHash).split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function encode(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
export function createToken(user) {
  if (!process.env.AUTH_SECRET) throw new Error("Authentication secret not configured");
  const payload = encode({ sub: user.id, username: user.username, role: user.role, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 });
  const head = encode({ alg: "HS256", typ: "JWT" });
  const signature = createHmac("sha256", process.env.AUTH_SECRET).update(`${head}.${payload}`).digest("base64url");
  return `${head}.${payload}.${signature}`;
}

export function currentUser(event) {
  const authorization = typeof event.headers?.get === "function" ? event.headers.get("authorization") : event.headers?.authorization;
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token || !process.env.AUTH_SECRET) return null;
  const [head, payload, signature] = token.split(".");
  const expected = createHmac("sha256", process.env.AUTH_SECRET).update(`${head}.${payload}`).digest("base64url");
  if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try { const user = JSON.parse(Buffer.from(payload, "base64url").toString()); return user.exp > Date.now() / 1000 ? user : null; } catch { return null; }
}
