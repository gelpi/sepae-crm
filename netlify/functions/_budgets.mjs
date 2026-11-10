import { spreadsheetId } from "./_shared.mjs";

export const BUDGET_SHEET = "Presupuestos";
export async function budgetMetadata(sheets, create = false) {
  let response = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  let sheet = response.data.sheets?.find(s => s.properties.title === BUDGET_SHEET)?.properties;
  if (!sheet && create) {
    try {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: BUDGET_SHEET, gridProperties: { frozenRowCount: 1, columnCount: 8 } } } }] } });
    } catch (error) {
      response = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
      if (!response.data.sheets?.some(s => s.properties.title === BUDGET_SHEET)) throw error;
    }
    response = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
    sheet = response.data.sheets.find(s => s.properties.title === BUDGET_SHEET).properties;
    await sheets.spreadsheets.values.update({ spreadsheetId, range: "Presupuestos!A1:H1", valueInputOption: "RAW", requestBody: { values: [["ID", "Vendedora", "ID contacto", "Estado", "Creado", "Vigencia", "Alternativa aprobada", "Datos guardados"]] } });
  }
  return sheet;
}
export function budgetRow(b) { return [b.id, b.seller, b.leadId, b.status, b.createdAt, b.validUntil, b.selectedOption || "", JSON.stringify(b)]; }
export function cells(values) { return values.map(value => ({ userEnteredValue: { stringValue: String(value ?? "") } })); }
export async function readBudgets(sheets) {
  const sheet = await budgetMetadata(sheets);
  if (!sheet) return { sheet: null, entries: [] };
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Presupuestos!A2:H" });
  return { sheet, entries: (result.data.values || []).map((row, index) => {
    if (!row[0] || !row[7]) return null;
    try {
      const budget = JSON.parse(row[7]);
      if (!budget.id || !Array.isArray(budget.options) || !budget.customer) return null;
      return { budget, rowNumber: index + 2 };
    } catch { console.error(`Fila de presupuesto inválida: ${index + 2}`); return null; }
  }).filter(Boolean) };
}
