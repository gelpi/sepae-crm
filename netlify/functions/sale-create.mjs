import { randomUUID } from "node:crypto";
import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";

export default async (request) => {
  const user = currentUser(request); if (!user) return reply(401, { error:"Sesión no válida." });
  try {
    const body = await request.json(); const rowNumber = Number(body.id); const saleDate = String(body.saleDate || "");
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) return reply(400, { error:"Elegí una fecha de venta válida." });
    const sheets = getSheets(); const read = await sheets.spreadsheets.values.get({ spreadsheetId, range:`Respuestas de formulario 1!A${rowNumber}:P${rowNumber}` }); const row = read.data.values?.[0];
    if (!row) return reply(404, { error:"Contacto no encontrado." });
    if (user.role !== "admin" && String(row[1]).trim().toLowerCase() !== String(user.seller).trim().toLowerCase()) return reply(403, { error:"No podés registrar una venta de este contacto." });
    if (!row[15]) return reply(400, { error:"Este lead todavía no tiene ID CRM. Recargá e intentá nuevamente." });
    const note = String(body.note || "").trim(); const seller = row[1] || user.seller || user.username;
    await sheets.spreadsheets.values.append({ spreadsheetId, range:"Ventas!A:F", valueInputOption:"USER_ENTERED", insertDataOption:"INSERT_ROWS", requestBody:{ values:[[randomUUID(), row[15], row[2] || "Sin nombre", seller, saleDate, note]] } });
    const values = Array.from({ length:16 }, (_, index) => row[index] || "");
    values[5] = values[5] || "Sí";
    values[7] = `${row[7] || ""}${row[7] ? "\n\n" : ""}Venta registrada el ${saleDate}.${note ? ` ${note}` : ""}\n${new Date().toLocaleDateString("es-UY")}`;
    await sheets.spreadsheets.values.update({ spreadsheetId, range:`Respuestas de formulario 1!A${rowNumber}:P${rowNumber}`, valueInputOption:"USER_ENTERED", requestBody:{ values:[values] } });
    return reply(201, { ok:true });
  } catch (error) { console.error("Sale create error", error); return reply(500, { error:"No se pudo registrar la venta." }); }
};
