import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ADMINS, guard, money } from "./utils.js";
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const user = guard(); if(!user) throw new Error("sem login");
const isAdmin = !!user.admin || ADMINS.includes(user.matricula);

async function carregar(){
  const diaIn = document.getElementById("dia").value;
  const matIn = document.getElementById("mat").value.trim();
  const dia = diaIn? new Date(diaIn).toISOString().slice(0,10) : null;

  let qy = collection(db,"relatorios");
  const conds = [];
  if(dia) conds.push(where("dia","==",dia));
  if(matIn) conds.push(where("recebedor","==",matIn));
  if(conds.length) qy = query(qy, ...conds);

  const snap = await getDocs(qy);
  const porMat = {};
  snap.forEach(d=>{
    const r = d.data();
    const key = r.recebedor || r.solicitante || "—";
    if(!porMat[key]) porMat[key] = { bruto:0, sangria:0, itens:[] };
    if(r.tipo==="abastecimento"){
      porMat[key].bruto += r.valor||0;
    }else if(r.tipo==="sangria" && r.aprovado){
      porMat[key].sangria += r.valor||0;
    }
    porMat[key].itens.push(r);
  });

  let html = `<div class='kpi'>`;
  let gBruto=0,gSg=0,gLiq=0;
  for(const [mat,tot] of Object.entries(porMat)){
    const liq = (tot.bruto||0)-(tot.sangria||0);
    gBruto+=tot.bruto; gSg+=tot.sangria; gLiq+=liq;
    html+=`<div class='pill'>Matrícula ${mat}: Bruto ${money(tot.bruto)} • Sangria ${money(tot.sangria)} • Pós ${money(liq)}</div>`;
  }
  html+=`</div><hr/><div class='kpi'><div class='pill'>GERAL • Lançado ${money(gBruto)} • Sangria ${money(gSg)} • Pós ${money(gLiq)}</div></div>`;

  document.getElementById("painel").innerHTML = html;
}
document.getElementById("carregar").addEventListener("click", carregar);
document.getElementById("printResumo").addEventListener("click", ()=>window.print());
