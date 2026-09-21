import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";

const amount = (value) => Number(String(value || "").replace(/[^0-9]/g, ""));
const text = (row) => row.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

function block(rows, service, age) {
  const serviceStart = rows.findIndex((row) => text(row).includes(service));
  const ageLabel = age === "under55" ? "ANTES DE 55" : "DESPUES DE 55";
  const ageStart = rows.findIndex((row, index) => index >= serviceStart && text(row).includes(ageLabel));
  if (serviceStart < 0 || ageStart < 0) throw new Error(`No se encontraron precios de ${service} (${age}).`);

  const prices = new Map();
  for (let index = ageStart + 1; index < rows.length && prices.size < 3; index += 1) {
    const row = rows[index];
    const hours = Number(row[0]);
    if ([8, 16, 24].includes(hours)) prices.set(hours, { hours, base:amount(row[1]) });
  }
  if (prices.size !== 3) throw new Error(`Faltan precios de ${service} (${age}).`);
  return [8, 16, 24].map((hours) => prices.get(hours));
}

export default async (request) => {
  if (!currentUser(request)) return reply(401, { error:"Sesión no válida." });
  try {
    const sheets = getSheets();
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range:"Calculadora!A1:F40" });
    const rows = result.data.values || [];
    return reply(200, {
      internacion:{ under55:block(rows, "INTERNACION", "under55"), over55:block(rows, "INTERNACION", "over55") },
      convalecencia:{ under55:block(rows, "CONVALECENCIA", "under55"), over55:block(rows, "CONVALECENCIA", "over55") },
      updatedAt:"Precios vigentes según Calculadora"
    });
  } catch (error) { console.error("Calculator error", error); return reply(500, { error:"No se pudieron cargar los precios del cotizador." }); }
};
