import { currentUser, getSheets, reply, spreadsheetId } from "./_shared.mjs";
const rank = (rows) => Object.entries(rows.reduce((all,row)=>{all[row[3] || "Sin asignar"]=(all[row[3] || "Sin asignar"]||0)+1;return all;},{})).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
export default async (request) => {
  const user = currentUser(request); if (!user) return reply(401,{error:"Sesión no válida."});
  try { const sheets=getSheets(); const result=await sheets.spreadsheets.values.get({spreadsheetId,range:"Ventas!A2:F"}); const all=result.data.values||[]; const rows=user.role==="admin"?all:all.filter(row=>String(row[3]).trim().toLowerCase()===String(user.seller).trim().toLowerCase()); const sales=rows.map(row=>({id:row[0],leadId:row[1],nombre:row[2],vendedora:row[3],fecha:row[4],nota:row[5]||""})).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))); return reply(200,{total:sales.length,sales:sales.slice(0,100),bySeller:rank(all)}); } catch(error){ console.error("Sales error",error);return reply(500,{error:"No se pudieron cargar las ventas."}); }
};
