import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";
import { readBudgets } from "./_budgets.mjs";
import { budgetSale } from "./_budget-core.mjs";
const rank = (rows) => Object.entries(rows.reduce((all,row)=>{all[row[3] || "Sin asignar"]=(all[row[3] || "Sin asignar"]||0)+1;return all;},{})).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
export default async (request) => {
  const user = currentUser(request); if (!user) return reply(401,{error:"Sesión no válida."});
  try {
    const sheets=getSheets();
    const [result, budgets] = await Promise.all([sheets.spreadsheets.values.get({spreadsheetId,range:"Ventas!A2:F"}), readBudgets(sheets)]);
    const existing = (result.data.values||[]).map(row=>({id:row[0],leadId:row[1],nombre:row[2],vendedora:row[3],fecha:row[4],nota:row[5]||""}));
    const allSales = [...new Map([...existing, ...budgets.entries.filter(e=>e.budget.status==="Aprobado").map(e=>budgetSale(e.budget))].map(s=>[s.id,s])).values()];
    const sales = allSales.filter(s=>user.role==="admin" || String(s.vendedora).trim().toLowerCase()===String(user.seller).trim().toLowerCase()).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
    return reply(200,{total:sales.length,sales:sales.slice(0,100),bySeller:rank(allSales.map(s=>[s.id,s.leadId,s.nombre,s.vendedora]))});
  } catch(error){ console.error("Sales error",error);return reply(500,{error:"No se pudieron cargar las ventas."}); }
};
