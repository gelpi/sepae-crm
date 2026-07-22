import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";
const digits = (value) => String(value || "").replace(/\D/g, "");
export default async (request) => {
  const user = currentUser(request); if (!user) return reply(401, { error: "Sesión no válida." });
  try {
    const body = await request.json(); const rowNumber = Number(body.id);
    if (!Number.isInteger(rowNumber) || rowNumber < 2) return reply(400, { error: "Contacto no válido." });
    const sheets = getSheets(); const read = await sheets.spreadsheets.values.get({ spreadsheetId, range: `Respuestas de formulario 1!A${rowNumber}:J${rowNumber}` }); const row = read.data.values?.[0];
    if (!row) return reply(404, { error: "Contacto no encontrado." });
    if (user.role !== "admin" && String(row[1]).trim().toLowerCase() !== String(user.seller).trim().toLowerCase()) return reply(403, { error: "No podés modificar este contacto." });
    if (body.action === "delete") { await sheets.spreadsheets.values.update({ spreadsheetId, range: `Respuestas de formulario 1!J${rowNumber}`, valueInputOption: "RAW", requestBody: { values: [[new Date().toISOString()]] } }); return reply(200, { ok: true }); }
    if (body.action === "restore" && user.role === "admin") { await sheets.spreadsheets.values.clear({ spreadsheetId, range: `Respuestas de formulario 1!J${rowNumber}` }); return reply(200, { ok: true }); }
    const name = String(body.name || "").trim(), phone = digits(body.phone), document = digits(body.document);
    if (name.length < 3 || phone.length < 8 || phone.length > 15 || (document && (document.length < 6 || document.length > 12))) return reply(400, { error: "Revisá nombre, teléfono y cédula." });
    const values = [[row[0], row[1], name, phone, document, body.member || "", body.origin || "", body.comment || "", body.type === "Sin clasificar" ? "" : body.type || "", row[9] || ""]];
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `Respuestas de formulario 1!A${rowNumber}:J${rowNumber}`, valueInputOption: "USER_ENTERED", requestBody: { values } }); return reply(200, { ok: true });
  } catch (error) { console.error("Contact update error", error); return reply(500, { error: "No se pudo actualizar el contacto." }); }
};
