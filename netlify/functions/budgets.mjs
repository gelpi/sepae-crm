import { randomUUID } from "node:crypto";
import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";
import { loadCalculator } from "./calculator.mjs";
import { budgetMetadata, readBudgets, budgetRow, cells } from "./_budgets.mjs";
import { ownsBudget, quoteOptions, shareKey, validDay } from "./_budget-core.mjs";

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const decorated = budget => ({ ...budget, shareKey: budget.status === "Borrador" || budget.status === "Cancelado" ? null : shareKey(budget.id) });
const customerSnapshot = row => ({ name: row[2] || "Sin nombre", phone: row[3] || "", document: row[4] || "", member: row[5] || "", origin: row[6] || "", locality: row[10] || "", birthDate: row[11] || "", address: row[12] || "", email: row[13] || "" });
export default async request => {
  const user = currentUser(request);
  if (!user) return reply(401, { error: "Sesión no válida." });
  if (!["GET", "POST"].includes(request.method)) return reply(405, { error: "Método no permitido." });
  try {
    const sheets = getSheets();
    const { sheet, entries } = await readBudgets(sheets);
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const leadRow = Number(params.get("contact"));
      let leadId = "";
      if (Number.isInteger(leadRow) && leadRow >= 2) {
        const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: `Respuestas de formulario 1!A${leadRow}:P${leadRow}` });
        const row = result.data.values?.[0];
        if (!row || (user.role !== "admin" && String(row[1]).trim().toLowerCase() !== String(user.seller).trim().toLowerCase())) throw fail("Contacto no disponible.", 404);
        leadId = row[15] || "sin-id";
      }
      return reply(200, { budgets: entries.map(e => e.budget).filter(b => ownsBudget(user, b) && (!leadId || b.leadId === leadId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(decorated) });
    }
    const body = await request.json();
    if (body.action === "create") {
      if (!/^[0-9a-f-]{36}$/.test(body.id || "")) throw fail("Identificador de presupuesto inválido.");
      const existing = entries.find(e => e.budget.id === body.id);
      if (existing) {
        if (!ownsBudget(user, existing.budget)) throw fail("Presupuesto no disponible.", 404);
        return reply(200, { budget: decorated(existing.budget) });
      }
      const rowNumber = Number(body.contactId);
      if (!Number.isInteger(rowNumber) || rowNumber < 2) throw fail("Elegí un contacto.");
      if (!validDay(body.validUntil)) throw fail("Elegí una vigencia válida.");
      const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: `Respuestas de formulario 1!A${rowNumber}:P${rowNumber}` });
      const row = result.data.values?.[0];
      if (!row || row[9]) throw fail("Contacto no disponible.", 404);
      if (user.role !== "admin" && String(row[1]).trim().toLowerCase() !== String(user.seller).trim().toLowerCase()) throw fail("Contacto no disponible.", 404);
      const options = quoteOptions(await loadCalculator(sheets), body);
      if (!row[15]) {
        row[15] = randomUUID();
        await sheets.spreadsheets.values.update({ spreadsheetId, range: `Respuestas de formulario 1!P${rowNumber}`, valueInputOption: "RAW", requestBody: { values: [[row[15]]] } });
      }
      const budget = { id: body.id, leadId: row[15], seller: row[1] || user.seller || user.username, status: "Borrador", createdAt: new Date().toISOString(), validUntil: body.validUntil, customer: { name: row[2] || "Sin nombre", phone: row[3] || "", document: row[4] || "", member: row[5] || "", origin: row[6] || "", locality: row[10] || "", birthDate: row[11] || "", address: row[12] || "", email: row[13] || "" }, conditions: { age: Number(body.age), coverage: body.coverage, family: body.coverage === "ninguna" ? body.family || "" : "", debit: body.debit === true }, options, history: [{ status: "Borrador", at: new Date().toISOString(), by: user.username }] };
      await budgetMetadata(sheets, true);
      await sheets.spreadsheets.values.append({ spreadsheetId, range: "Presupuestos!A:H", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: [budgetRow(budget)] } });
      return reply(201, { budget: decorated(budget) });
    }
    const entry = entries.find(e => e.budget.id === body.id && ownsBudget(user, e.budget));
    if (!entry) throw fail("Presupuesto no disponible.", 404);
    const budget = structuredClone(entry.budget);
    const requests = [];
    if (body.action === "edit") {
      if (budget.status !== "Borrador") throw fail("Solo se pueden editar los borradores.");
      if (!validDay(body.validUntil)) throw fail("Elegí una vigencia válida.");
      budget.validUntil = body.validUntil;
      budget.options = quoteOptions(await loadCalculator(sheets), body);
      budget.conditions = { age: Number(body.age), coverage: body.coverage, family: body.coverage === "ninguna" ? body.family || "" : "", debit: body.debit === true };
    } else if (body.action === "emit") {
      if (budget.status !== "Borrador") throw fail("El presupuesto ya fue emitido.");
      const contacts = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Respuestas de formulario 1!A2:P" });
      const row = (contacts.data.values || []).find(row => row[15] === budget.leadId);
      if (!row || row[9]) throw fail("El contacto no está disponible para emitir el presupuesto.");
      if (user.role !== "admin" && String(row[1]).trim().toLowerCase() !== String(user.seller).trim().toLowerCase()) throw fail("El contacto ya no está asignado a tu cartera.", 403);
      budget.customer = customerSnapshot(row);
      budget.options = quoteOptions(await loadCalculator(sheets), { ...budget.conditions, options: budget.options });
      budget.status = "Emitido";
      budget.issuedAt = new Date().toISOString();
    } else if (body.action === "approve") {
      // La venta se deriva de esta fila aprobada: no se agrega otra fila al reintentar.
      if (budget.status === "Aprobado") return reply(200, { budget: decorated(budget) });
      if (!["Emitido", "Vencido"].includes(budget.status)) throw fail("Primero emití el presupuesto para aprobarlo.");
      if (!validDay(body.saleDate) || !budget.options.some(o => o.id === body.selectedOption)) throw fail("Elegí la alternativa aceptada y una fecha de venta válida.");
      const contacts = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Respuestas de formulario 1!A2:P" });
      const index = (contacts.data.values || []).findIndex(row => row[15] === budget.leadId);
      const row = contacts.data.values?.[index];
      if (index < 0 || row[9]) throw fail("El contacto no está disponible para registrar la venta.");
      if (user.role !== "admin" && String(row[1]).trim().toLowerCase() !== String(user.seller).trim().toLowerCase()) throw fail("El contacto ya no está asignado a tu cartera.", 403);
      const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
      const contactSheet = metadata.data.sheets.find(s => s.properties.title === "Respuestas de formulario 1").properties.sheetId;
      const note = `${row[7] || ""}${row[7] ? "\n\n" : ""}Venta por presupuesto ${budget.id}. Alternativa: ${body.selectedOption}. Fecha: ${body.saleDate}.`;
      requests.push({ updateCells: { start: { sheetId: contactSheet, rowIndex: index + 1, columnIndex: 5 }, rows: [{ values: cells(["Sí"]) }], fields: "userEnteredValue" } }, { updateCells: { start: { sheetId: contactSheet, rowIndex: index + 1, columnIndex: 7 }, rows: [{ values: cells([note]) }], fields: "userEnteredValue" } });
      budget.status = "Aprobado";
      budget.selectedOption = body.selectedOption;
      budget.saleDate = body.saleDate;
    } else if (body.action === "status") {
      const allowed = { Borrador: ["Cancelado"], Emitido: ["Cancelado", "Vencido"], Vencido: ["Emitido", "Cancelado"] };
      if (!allowed[budget.status]?.includes(body.status)) throw fail("Ese cambio de estado no está disponible.");
      budget.status = body.status;
    } else throw fail("Acción no válida.");
    budget.history.push({ status: budget.status, action: body.action, at: new Date().toISOString(), by: user.username });
    requests.push({ updateCells: { start: { sheetId: sheet.sheetId, rowIndex: entry.rowNumber - 1, columnIndex: 0 }, rows: [{ values: cells(budgetRow(budget)) }], fields: "userEnteredValue" } });
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    return reply(200, { budget: decorated(budget) });
  } catch (error) {
    console.error("Budgets error", error.message);
    return reply(error.status || 400, { error: error.status || !error.response ? error.message : "No se pudo guardar el presupuesto. Intentá nuevamente." });
  }
};
