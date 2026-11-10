import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { google } from "googleapis";

process.env.GOOGLE_SHEET_ID = "test-sheet";
process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "{}";
process.env.AUTH_SECRET = "test-secret-not-used-in-production";
const { createToken } = await import("../netlify/functions/_shared.mjs");
const { default: budgets } = await import("../netlify/functions/budgets.mjs");
const { default: publicHandler } = await import("../netlify/functions/budget-public.mjs");
const { default: sales } = await import("../netlify/functions/sales.mjs");
const { default: contacts } = await import("../netlify/functions/contacts.mjs");
const { default: createContact } = await import("../netlify/functions/contact-create.mjs");
const { default: updateContact } = await import("../netlify/functions/contact-update.mjs");
const { quoteOptions, validDay } = await import("../netlify/functions/_budget-core.mjs");

function memorySheets() {
  const tables = new Map([
    ["Respuestas de formulario 1", [["Fecha","Vendedora"], ["2026-11-10", "Ana", "Cliente Prueba", "099123456", "12345678", "No", "Web", "Comentario privado", "Tibio", "", "Vergara", "1990-02-03", "Dirección privada", "privado@example.com", "2026-12-01", "lead-1"]]],
    ["Ventas", [["ID","Contacto","Nombre","Vendedora","Fecha","Nota"], ["old-sale","other-lead","Venta anterior","Ana","2026-01-01",""]]],
    ["Calculadora", [["INTERNACION"],["ANTES DE 55 AÑOS"],["8","1315"],["16","2298"],["24","3197"],["DESPUES DE 55 AÑOS"],["8","1507"],["16","2529"],["24","3579"],["CONVALECENCIA"],["ANTES DE 55 AÑOS"],["8","882"],["16","1663"],["24","2420"],["DESPUES DE 55 AÑOS"],["8","946"],["16","1857"],["24","2650"]]]
  ]);
  const ids=new Map([["Respuestas de formulario 1",1],["Ventas",2],["Calculadora",3]]);
  const col=s=>Array.from(s).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
  function range(value) { const [name,r]=value.split("!"); const m=r.match(/^([A-Z]+)(\d*)?(?::([A-Z]+)(\d*)?)?$/);return {name,c:col(m[1]),row:Number(m[2]||1)-1,end:m[4]?Number(m[4]):tables.get(name).length,ec:col(m[3]||m[1])+1}; }
  const spreadsheets={
    get:async()=>({data:{sheets:[...ids].map(([title,sheetId])=>({properties:{title,sheetId}}))}}),
    values:{
      get:async({range:r})=>{const x=range(r);return {data:{values:tables.get(x.name).slice(x.row,x.end).map(row=>row.slice(x.c,x.ec))}};},
      append:async({range:r,requestBody})=>{const name=r.split("!")[0];tables.get(name).push(...structuredClone(requestBody.values));return {data:{}};},
      update:async({range:r,requestBody})=>{const x=range(r),table=tables.get(x.name);requestBody.values.forEach((v,i)=>{table[x.row+i]||=[];v.forEach((cell,j)=>table[x.row+i][x.c+j]=cell);});return {data:{}};}
    },
    batchUpdate:async({requestBody})=>{
      for(const r of requestBody.requests){
        if(r.addSheet){const name=r.addSheet.properties.title;assert.ok(!tables.has(name));tables.set(name,[]);ids.set(name,ids.size+1);}
        if(r.updateCells){const {start,rows}=r.updateCells;const name=[...ids].find(([,id])=>id===start.sheetId)[0];const table=tables.get(name);rows.forEach((row,i)=>{table[start.rowIndex+i]||=[];row.values.forEach((cell,j)=>table[start.rowIndex+i][start.columnIndex+j]=cell.userEnteredValue.stringValue);});}
      }
      return {data:{}};
    }
  };
  return {spreadsheets,tables};
}
const tokens={Ana:createToken({id:"ana",username:"ana",role:"seller",seller:"Ana"}),Bea:createToken({id:"bea",username:"bea",role:"seller",seller:"Bea"}),admin:createToken({id:"admin",username:"admin",role:"admin"})};
async function call(handler,who,body,query="") { const r=await handler(new Request(`https://crm.test/.netlify/functions/budgets${query}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${tokens[who]||""}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})}));return {status:r.status,data:await r.json()}; }
const input={age:50,coverage:"iac",family:"",debit:true,validUntil:"2020-01-01",contactId:2,options:[{hours:16,convalescence:false},{hours:16,convalescence:true}]};

test("presupuesto: permisos, snapshot, vigencia informativa y una sola venta por aprobación",async()=>{
  const db=memorySheets();google.sheets=()=>db;
  assert.equal((await call(budgets,"",undefined)).status,401);
  assert.equal((await call(budgets,"Ana",undefined)).data.budgets.length,0);
  assert.equal((await call(contacts,"Ana",undefined)).data.contacts.length,1,"contactos sigue funcionando antes de crear la nueva pestaña");
  assert.equal((await call(sales,"Ana",undefined)).data.total,1,"ventas anteriores siguen disponibles");
  assert.equal((await call(budgets,"Bea",{...input,id:randomUUID(),action:"create"})).status,404);
  const id=randomUUID();
  const created=await call(budgets,"Ana",{...input,id,action:"create"});
  assert.equal(created.status,201);assert.equal(created.data.budget.status,"Borrador");
  assert.equal(created.data.budget.options[0].firstMonths,1379);
  assert.equal(created.data.budget.options[1].firstMonths,2377);
  assert.equal(created.data.budget.shareKey,null);
  await call(budgets,"Ana",{...input,id,action:"create"});
  assert.equal(db.tables.get("Presupuestos").length,2,"reintento no duplica el presupuesto");
  assert.equal((await call(budgets,"Bea",{id,action:"emit"})).status,404);
  assert.equal((await call(budgets,"Bea",undefined)).data.budgets.length,0);
  assert.equal((await call(budgets,"admin",undefined)).data.budgets.length,1);
  const emitted=await call(budgets,"Ana",{id,action:"emit"});
  const b=emitted.data.budget;assert.equal(b.status,"Emitido");
  const open=key=>publicHandler(new Request(`https://crm.test/?id=${id}`,{headers:{"X-Budget-Key":key}}));
  assert.equal((await open("incorrecta")).status,404);
  const publicResult=await open(b.shareKey);assert.equal(publicResult.status,200,"fecha pasada no bloquea el enlace");
  const publicData=(await publicResult.json()).budget;
  for(const field of ["phone","document","email","address","history","seller","conditions","leadId"]) assert.ok(!(field in publicData) && !(field in publicData.customer),`no filtra ${field}`);
  db.tables.get("Calculadora")[3][1]="9999";
  const frozen=(await call(budgets,"Ana",undefined)).data.budgets[0];assert.equal(frozen.options[0].monthly,1838);
  assert.equal((await call(budgets,"Ana",{...input,id,action:"edit"})).status,400);
  assert.equal((await call(budgets,"Ana",{id,action:"approve",selectedOption:"invalid",saleDate:"2026-11-10"})).status,400);
  await call(budgets,"Ana",{id,action:"status",status:"Vencido"});
  const approvals=await Promise.all([call(budgets,"Ana",{id,action:"approve",selectedOption:"16-base",saleDate:"2026-11-10"}),call(budgets,"Ana",{id,action:"approve",selectedOption:"16-base",saleDate:"2026-11-10"})]);
  assert.ok(approvals.every(r=>r.status===200));
  await Promise.all([call(budgets,"Ana",{id,action:"approve",selectedOption:"16-base",saleDate:"2026-11-10"}),call(budgets,"Ana",{id,action:"approve",selectedOption:"16-base",saleDate:"2026-11-10"})]);
  const result=await call(sales,"Ana");assert.equal(result.data.total,2,"venta anterior + una aprobación");
  assert.equal(db.tables.get("Respuestas de formulario 1")[1][5],"Sí");
  assert.equal(db.tables.get("Respuestas de formulario 1")[1][14],"2026-12-01","conserva seguimiento existente");
  const leadList=await call(contacts,"Ana");assert.equal(leadList.data.contacts[0].tieneVentas,true);
  assert.equal((await call(budgets,"Ana",{id,action:"status",status:"Cancelado"})).status,400,"venta aprobada no se cancela silenciosamente");
  const second=(await call(budgets,"Ana",{...input,id:randomUUID(),action:"create"})).data.budget;
  const secondEmitted=(await call(budgets,"Ana",{id:second.id,action:"emit"})).data.budget;
  await call(budgets,"Ana",{id:second.id,action:"status",status:"Cancelado"});
  assert.equal((await publicHandler(new Request(`https://crm.test/?id=${second.id}`,{headers:{"X-Budget-Key":secondEmitted.shareKey}}))).status,404);
});

test("valida fechas, descuentos excluyentes y precios de los seis planes",()=>{
  assert.equal(validDay("2026-02-30"),false);assert.equal(validDay("2026-11-10"),true);
  const calc={internacion:{under55:[8,16,24].map(hours=>({hours,base:1000}))},convalecencia:{under55:[8,16,24].map(hours=>({hours,base:500}))}};
  const options=quoteOptions(calc,{...input,coverage:"msp",family:"pareja",options:[{hours:8,convalescence:true}]});
  assert.equal(options[0].discount,15,"institución excluye descuento familiar");assert.equal(options[0].monthly,1275);assert.equal(options[0].firstMonths,957);
  assert.throws(()=>quoteOptions(calc,{...input,options:[]}));
});

test("alta y edición exigen teléfono o dirección sin duplicados por teléfonos vacíos",async()=>{
  const db=memorySheets();google.sheets=()=>db;
  const base={name:"Persona de prueba",phone:"",address:"",document:"",locality:"Vergara"};
  assert.equal((await call(createContact,"Ana",base)).status,400);
  assert.equal((await call(createContact,"Ana",{...base,address:"   "})).status,400);
  assert.equal((await call(createContact,"Ana",{...base,phone:"123",address:"Calle 123"})).status,400);
  assert.equal((await call(createContact,"Ana",{...base,phone:"Sin teléfono",address:"Calle 123"})).status,400);
  assert.equal((await call(createContact,"Ana",{...base,address:"  Calle 123  "})).status,201);
  assert.equal((await call(createContact,"Ana",{...base,name:"Otra persona",address:"Calle 456"})).status,201);
  assert.equal(db.tables.get("Respuestas de formulario 1")[2][3],"");
  assert.equal(db.tables.get("Respuestas de formulario 1")[2][12],"Calle 123");
  assert.equal((await call(createContact,"Ana",{...base,phone:"099123456"})).status,409,"mantiene detección de teléfonos repetidos");
  assert.equal((await call(updateContact,"Ana",{...base,id:2})).status,400);
  assert.equal((await call(updateContact,"Ana",{...base,id:2,phone:"abc",address:"Calle 123"})).status,400);
  assert.equal((await call(updateContact,"Ana",{...base,id:2,address:"Calle nueva"})).status,200);
  assert.equal(db.tables.get("Respuestas de formulario 1")[1][3],"");
  assert.equal(db.tables.get("Respuestas de formulario 1")[1][12],"Calle nueva");
  assert.equal((await call(updateContact,"Ana",{...base,id:2,phone:"+598 99 234 567"})).status,200);
  assert.equal(db.tables.get("Respuestas de formulario 1")[1][3],"59899234567");
});
