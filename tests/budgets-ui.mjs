import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";
const { chromium } = await import(process.env.PLAYWRIGHT_PATH ? pathToFileURL(process.env.PLAYWRIGHT_PATH).href : "playwright");
const server=await createServer({server:{host:"127.0.0.1",port:5179,strictPort:true}});await server.listen();
const browser=await chromium.launch({channel:"msedge",headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on("pageerror",e=>errors.push(e.message));
const budget={id:"11111111-1111-4111-8111-111111111111",leadId:"lead-1",seller:"Ana",status:"Emitido",createdAt:"2026-11-10",issuedAt:"2026-11-10",validUntil:"2026-11-25",customer:{name:"Cliente Prueba",locality:"Vergara"},conditions:{age:50,coverage:"iac",debit:true},options:[{id:"16-base",hours:16,convalescence:false,listPrice:2298,monthly:1838,firstMonths:1379,discount:20,debit:true}],history:[{status:"Emitido",at:"2026-11-10",by:"Ana"}],shareKey:"a".repeat(64)};
const contact={id:2,nombre:"Cliente Prueba",telefono:"099123456",tipo:"Tibio",localidad:"Vergara",origen:"Web",comentario:"Historial de prueba",nacimiento:"",socio:"No",crmId:"lead-1"};
await page.addInitScript(()=>{sessionStorage.setItem("sepae_token","test");sessionStorage.setItem("sepae_role","seller");sessionStorage.setItem("sepae_user","Ana");});
await page.route("**/.netlify/functions/**",async route=>{
  const url=new URL(route.request().url()),name=url.pathname.split("/").at(-1);
  let data={};
  if(name==="contacts")data={contacts:[contact],filters:{origins:["Web","Punto saludable"],types:["Sin clasificar","Tibio"],members:["No","Sí"],sellers:["Ana"]},metrics:{total:1}};
  if(name==="seller-dashboard")data={totals:{unclassified:0,noPhone:0,noBirthDate:1,noLocality:0},actions:{overdue:[{id:2,nombre:"Cliente Prueba",fecha:"2026-10-01"}],today:[],upcoming:[]}};
  if(name==="sales")data={total:1,sales:[{id:"s1",nombre:"Cliente Prueba",fecha:"2026-11-10"}]};
  if(name==="budgets"){
    if(route.request().method()==="POST"){
      const body=route.request().postDataJSON();
      if(body.action==="approve"){assert.equal(body.selectedOption,"16-base");budget.status="Aprobado";budget.selectedOption=body.selectedOption;budget.saleDate=body.saleDate;}
      if(body.action==="create")budget.status="Borrador";
      data={budget};
    }else data={budgets:[budget]};
  }
  if(name==="budget-public")data={budget};
  if(name==="calculator"){const plans=[8,16,24].map(hours=>({hours,base:hours===16?2298:1315}));data={internacion:{under55:plans,over55:plans},convalecencia:{under55:plans,over55:plans},updatedAt:"Precios vigentes"};}
  await route.fulfill({contentType:"application/json",body:JSON.stringify(data)});
});
try {
  await page.goto("http://127.0.0.1:5179");
  await page.getByRole("heading",{name:"Tu día comercial"}).waitFor();
  await page.getByRole("button",{name:"Reprogramar"}).waitFor();
  assert.equal(await page.locator("nav button").count(),7);
  for(const button of await page.locator("nav button").all()){const b=await button.boundingBox();assert.ok(b&&b.x>=0&&b.x+b.width<=391,"menú dentro del ancho móvil");}
  await page.locator("nav button").nth(1).click();
  await page.getByRole("heading",{name:"Contactos",exact:true}).waitFor();
  const newBox=await page.getByRole("button",{name:"Nuevo contacto"}).boundingBox(),searchBox=await page.getByPlaceholder("Buscar",{exact:true}).boundingBox();
  assert.ok(newBox.y+newBox.height<searchBox.y,"alta y buscador no se superponen");
  await page.locator(".contact").click();
  await page.getByRole("button",{name:"Ver presupuestos"}).click();
  await page.getByRole("button",{name:/Cliente Prueba.*Emitido/}).click();
  await page.getByRole("button",{name:"Aprobar y registrar venta"}).click();
  await page.getByLabel("Elegí una opción").selectOption("16-base");
  await page.getByRole("button",{name:"Confirmar aprobación y venta"}).click();
  await page.getByText("Presupuesto aprobado y venta registrada.").waitFor();
  await page.locator("nav button").nth(3).click();
  await page.getByLabel("Edad",{exact:true}).fill("50");
  await page.getByLabel("¿Está afiliado a alguna institución?").selectOption("iac");
  await page.getByRole("button",{name:"Crear presupuesto"}).click();
  await page.getByRole("button",{name:/Cliente Prueba.*099123456/}).click();
  await page.getByRole("button",{name:"Guardar borrador"}).click();
  await page.getByRole("heading",{name:"Presupuestos",exact:true}).waitFor();
  // El enlace público funciona sin el menú ni la sesión del CRM.
  budget.status="Emitido";delete budget.selectedOption;delete budget.saleDate;
  await page.goto(`http://127.0.0.1:5179/?presupuesto=${budget.id}#clave=${budget.shareKey}`);
  await page.getByRole("heading",{name:"Cliente Prueba"}).waitFor();
  assert.equal(await page.locator("nav").count(),0);
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Descargar PDF"}).click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/\.pdf$/);
  const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const pdf=Buffer.concat(chunks).toString("ascii");
  assert.ok(pdf.startsWith("%PDF-1.4"));assert.ok(pdf.includes("xref"));assert.ok(pdf.includes("Cliente Prueba"));
  await page.screenshot({path:"tests/budget-mobile-preview.png",fullPage:true});
  assert.deepEqual(errors,[]);
  console.log("UI móvil: navegación, contactos, aprobación, cotizador y PDF verificados.");
} finally { await browser.close();await server.close(); }
