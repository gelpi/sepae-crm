import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";
const rank = (values) => Object.entries(values).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
const dayKey = (value) => {
  const text = String(value || "");
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  return "";
};
export default async (request) => {
  const user = currentUser(request); if (!user) return reply(401, { error: "Sesión no válida." }); if (user.role !== "admin") return reply(403, { error: "Acceso exclusivo de administración." });
  try {
    const params = new URL(request.url).searchParams; const from = params.get("from") || ""; const to = params.get("to") || "";
    const sheets = getSheets(); const data = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Respuestas de formulario 1!A2:O" }); const rows = (data.data.values || []).filter((row) => !row[9]);
    const count = (column, fallback) => rows.reduce((acc, row) => { const key = row[column] || fallback; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
    const complete = rows.filter((row) => row[2] && row[3] && row[6] && row[7] && row[8]).length;
    const selectedRows = rows.filter((row) => { const day = dayKey(row[0]); return (!from || day >= from) && (!to || day <= to); });
    const byDaySeller = {};
    for (const row of selectedRows) { const date = dayKey(row[0]); if (!date) continue; const seller = row[1] || "Sin asignar"; const key = `${date}|${seller}`; byDaySeller[key] = (byDaySeller[key] || 0) + 1; }
    const dailyLoads = Object.entries(byDaySeller).map(([key, value]) => { const [date, seller] = key.split("|"); return { date, seller, value }; }).sort((a, b) => b.date.localeCompare(a.date) || b.value - a.value).slice(0, 30);
    return reply(200, { total: rows.length, complete, phone: rows.filter((row) => row[3]).length, unclassified: rows.filter((row) => !row[8]).length, sellers: rank(count(1, "Sin asignar")), origins: rank(count(6, "Sin origen")).slice(0, 6), types: rank(count(8, "Sin clasificar")).slice(0, 6), dailyLoads, period: { total: selectedRows.length, sellers: rank(selectedRows.reduce((acc, row) => { const seller = row[1] || "Sin asignar"; acc[seller] = (acc[seller] || 0) + 1; return acc; }, {})) } });
  } catch (error) { console.error("Dashboard error", error); return reply(500, { error: "No se pudo cargar el dashboard." }); }
};
