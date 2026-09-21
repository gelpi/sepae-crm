import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";

const amount = (value) => Number(String(value || "").replace(/[^0-9]/g, ""));
const block = (rows, start) => [8, 16, 24].map((hours, offset) => {
  const row = rows[start + offset] || [];
  return { hours, base:amount(row[1]), discounts:{ 15:amount(row[3]), 20:amount(row[4]), 25:amount(row[5]) } };
});

export default async (request) => {
  if (!currentUser(request)) return reply(401, { error:"Sesión no válida." });
  try {
    const sheets = getSheets();
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range:"Calculadora!A1:F40" });
    const rows = result.data.values || [];
    return reply(200, {
      internacion:{ under55:block(rows, 4), over55:block(rows, 12) },
      convalecencia:{ under55:block(rows, 25), over55:block(rows, 32) },
      updatedAt:"Precios vigentes según Calculadora"
    });
  } catch (error) { console.error("Calculator error", error); return reply(500, { error:"No se pudieron cargar los precios del cotizador." }); }
};
