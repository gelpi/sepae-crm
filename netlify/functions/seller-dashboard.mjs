import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";

const asDay = (value) => {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return local ? `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}` : "";
};
const todayKey = () => {
  const parts = new Intl.DateTimeFormat("en", { timeZone:"America/Montevideo", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date());
  const value = (name) => parts.find((part) => part.type === name)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const rank = (rows, column, fallback) => Object.entries(rows.reduce((acc, row) => { const label = row[column] || fallback; acc[label] = (acc[label] || 0) + 1; return acc; }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

export default async (request) => {
  const user = currentUser(request);
  if (!user) return reply(401, { error:"Sesión no válida." });
  try {
    const sheets = getSheets();
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range:"Respuestas de formulario 1!A2:O" });
    const allRows = (result.data.values || []).map((row, index) => ({ row, id:index + 2 }));
    const visible = allRows.filter(({ row }) => !row[9] && (user.role === "admin" || String(row[1]).trim().toLowerCase() === String(user.seller).trim().toLowerCase()));
    const today = todayKey();
    const toContact = (item) => ({ id:item.id, nombre:item.row[2] || "Sin nombre", telefono:item.row[3] || "Sin teléfono", tipo:item.row[8] || "Sin clasificar", localidad:item.row[10] || "Sin localidad", fecha:asDay(item.row[14]) });
    const pending = visible.filter(({ row }) => asDay(row[14])).map(toContact);
    const overdue = pending.filter((item) => item.fecha < today).sort((a,b) => a.fecha.localeCompare(b.fecha));
    const dueToday = pending.filter((item) => item.fecha === today);
    const upcoming = pending.filter((item) => item.fecha > today).sort((a,b) => a.fecha.localeCompare(b.fecha)).slice(0, 12);
    const birthdayItems = visible.map((item) => ({ ...toContact(item), birth:asDay(item.row[11]) })).filter((item) => item.birth).map((item) => {
      const [, month, day] = item.birth.match(/^\d{4}-(\d{2})-(\d{2})$/) || [];
      if (!month || !day) return null;
      const year = Number(today.slice(0,4)); const candidate = `${year}-${month}-${day}`;
      const next = candidate < today ? `${year + 1}-${month}-${day}` : candidate;
      const diff = Math.round((Date.parse(`${next}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
      return { ...item, daysAway:diff };
    }).filter(Boolean).filter((item) => item.daysAway <= 2).sort((a,b) => a.daysAway - b.daysAway);
    const classified = (term) => visible.filter(({ row }) => String(row[8] || "").toLowerCase() === term).length;
    const unclassified = visible.filter(({ row }) => !row[8] || String(row[8]).toLowerCase() === "sin clasificar").length;
    const noPhone = visible.filter(({ row }) => !row[3]).length;
    const incomplete = visible.filter(({ row }) => !row[3] || !row[6] || !row[10]).length;
    return reply(200, {
      totals:{ total:visible.length, hot:classified("caliente"), warm:classified("tibio"), cold:classified("frío") + classified("frio"), unclassified, noPhone, incomplete },
      localities:rank(visible.map(({ row }) => row), 10, "Sin localidad").slice(0, 7),
      actions:{ overdue, today:dueToday, upcoming },
      birthdays:birthdayItems
    });
  } catch (error) { console.error("Seller dashboard error", error); return reply(500, { error:"No se pudo cargar el dashboard." }); }
};
