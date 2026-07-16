import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";
const rank = (values) => Object.entries(values).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
export default async (request) => {
  const user = currentUser(request); if (!user) return reply(401, { error: "Sesión no válida." }); if (user.role !== "admin") return reply(403, { error: "Acceso exclusivo de administración." });
  try {
    const sheets = getSheets(); const data = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Respuestas de formulario 1!A2:J" }); const rows = (data.data.values || []).filter((row) => !row[9]);
    const count = (column, fallback) => rows.reduce((acc, row) => { const key = row[column] || fallback; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
    const complete = rows.filter((row) => row[2] && row[3] && row[6] && row[7] && row[8]).length;
    return reply(200, { total: rows.length, complete, phone: rows.filter((row) => row[3]).length, unclassified: rows.filter((row) => !row[8]).length, sellers: rank(count(1, "Sin asignar")), origins: rank(count(6, "Sin origen")).slice(0, 6), types: rank(count(8, "Sin clasificar")).slice(0, 6) });
  } catch (error) { console.error("Dashboard error", error); return reply(500, { error: "No se pudo cargar el dashboard." }); }
};
