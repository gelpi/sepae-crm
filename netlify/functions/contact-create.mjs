import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";

const digits = (value) => String(value || "").replace(/\D/g, "");
export default async (request) => {
  const user = currentUser(request);
  if (!user) return reply(401, { error: "Sesión no válida." });
  if (request.method !== "POST") return reply(405, { error: "Método no permitido." });
  try {
    const body = await request.json();
    const name = String(body.name || "").trim(); const phone = digits(body.phone); const document = digits(body.document);
    const seller = user.role === "admin" ? String(body.seller || "").trim() : user.seller;
    if (name.length < 3) return reply(400, { error: "Ingresá nombre y apellido." });
    if (phone.length < 8 || phone.length > 15) return reply(400, { error: "Ingresá un teléfono válido." });
    if (document && (document.length < 6 || document.length > 12)) return reply(400, { error: "La cédula no parece válida." });
    if (!seller) return reply(400, { error: "No se pudo asignar la vendedora." });
    const sheets = getSheets(); const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Respuestas de formulario 1!C2:E" });
    const duplicates = (existing.data.values || []).filter((row) => digits(row[1]) === phone || (document && digits(row[2]) === document));
    if (duplicates.length && !body.confirmDuplicate) return reply(409, { error: "Ya existe un contacto con ese teléfono o cédula.", duplicate: true });
    await sheets.spreadsheets.values.append({ spreadsheetId, range: "Respuestas de formulario 1!A:I", valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [[new Date().toISOString(), seller, name, phone, document, body.member || "", body.origin || "", body.comment || "", body.type || ""]] } });
    return reply(201, { ok: true });
  } catch (error) { console.error("Contact create error", error); return reply(500, { error: "No se pudo guardar el contacto." }); }
};
