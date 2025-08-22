import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ADMINS, guard, money } from "./utils.js";
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const user = guard(); if(!user) throw new Error("sem login");
const isAdmin = !!user.admin || ADMINS.includes(user.matricula);

const lista = document.getElementById("lista");
const totaisTop = document.getElementById("totaisTop");

async function carregar(){
  lista.innerHTML = ""; totaisTop.innerHTML="";
  const dt = document.getElementById("filtroData").value;
  const meus = document.getElementById("meusApenas").value==="1";
  const dia = dt? new Date(dt).toISOString().slice(0,10) : null;

  let qy = collection(db,"relatorios");
  const conds=[];
  if(dia) conds.push(where("dia","==",dia));
  if(meus && !isAdmin) conds.push(where("recebedor","==",user.matricula));
  if(conds.length){
    // build chained query
    qy = query(qy, ...conds);
  }
  const snap = await getDocs(qy);
  // agrupar por caixaId
  const byCaixa = {};
  snap.forEach(d=>{
    const v = { id:d.id, ...d.data() };
    const key = v.caixaId || "semCaixa";
    if(!byCaixa[key]) byCaixa[key]=[];
    byCaixa[key].push(v);
  });

  let totalBruto=0, totalSangria=0, totalLiquido=0;

  for(const [cxId, items] of Object.entries(byCaixa)){
    const abast = items.filter(i=>i.tipo==="abastecimento");
    const sangs = items.filter(i=>i.tipo==="sangria");
    const somaAb = abast.reduce((s,i)=>s+(i.valor||0),0);
    const somaSg = sangs.filter(s=>s.aprovado).reduce((s,i)=>s+(i.valor||0),0);
    const liquido = somaAb - somaSg;
    totalBruto += somaAb; totalSangria += somaSg; totalLiquido += liquido;

    const bloco = document.createElement("div");
    bloco.className="card";
    const cab = items[0];
    bloco.innerHTML = `
      <div class="kpi">
        <div class="pill">Caixa: ${cxId}</div>
        <div class="pill">Data: ${cab?.dataBR||""}</div>
        <div class="pill">Matrícula: ${cab?.recebedor||cab?.solicitante||""}</div>
        <div class="pill">Bruto: ${money(somaAb)}</div>
        <div class="pill">Sangria: ${money(somaSg)}</div>
        <div class="pill">Líquido: ${money(liquido)}</div>
      </div>
      <table class="table">
        <thead><tr><th>Tipo</th><th>Validador</th><th>Prefixo</th><th>Bordos</th><th>Valor</th><th>Motorista</th><th>Recebedor</th><th>Motivo/Obs</th><th>Ações</th></tr></thead>
        <tbody>
          ${items.map(row=>`
            <tr>
              <td>${row.tipo}</td>
              <td>${row.validador||"-"}</td>
              <td>${row.prefixo||"-"}</td>
              <td>${row.bordos||"-"}</td>
              <td>${money(row.valor||0)}</td>
              <td>${row.motorista||"-"}</td>
              <td>${row.recebedor||row.solicitante||"-"}</td>
              <td>${row.motivo||row.obs||"-"}</td>
              <td>
                ${isAdmin && row.tipo==="abastecimento" ? `<button class='btn ghost btn-sm' data-edit='${row.id}'>Editar</button> <button class='btn ghost btn-sm' data-del='${row.id}'>Excluir</button>`:""}
                ${row.tipo==="sangria" ? `
                  <label class='pill'>Aprovar <input type='checkbox' data-aprovar='${row.id}' ${row.aprovado?'checked':''}></label>
                `:""}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    lista.appendChild(bloco);
  }

  totaisTop.innerHTML = `
    <div class="pill">TOTAL BRUTO: ${money(totalBruto)}</div>
    <div class="pill">TOTAL SANGRIA: ${money(totalSangria)}</div>
    <div class="pill">TOTAL LÍQUIDO: ${money(totalLiquido)}</div>
  `;
}

document.getElementById("aplicarFiltro").addEventListener("click", carregar);
document.getElementById("exportCsv").addEventListener("click", ()=>{
  const texto = document.getElementById("lista").innerText.replace(/\t|\n+/g, "\n");
  const blob = new Blob([texto], {type:"text/csv;charset=utf-8;"});
  const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="relatorios.csv"; a.click();
});
document.getElementById("printPdf").addEventListener("click", ()=>{ window.print(); });

// Delegação para editar/excluir/aprovar
document.addEventListener("click", async (e)=>{
  const btn = e.target.closest("[data-edit],[data-del]");
  if(btn && btn.dataset.edit){
    const id=btn.dataset.edit;
    const novo=prompt("Novo valor (R$):");
    if(!novo) return;
    await updateDoc(doc(db,"relatorios",id), { valor: Number(novo) });
    alert("Atualizado."); carregar();
  }else if(btn && btn.dataset.del){
    const id=btn.dataset.del;
    if(confirm("Excluir lançamento?")){
      await deleteDoc(doc(db,"relatorios",id)); alert("Excluído."); carregar();
    }
  }
  const chk = e.target.closest("[data-aprovar]");
  if(chk){
    const id = chk.getAttribute("data-aprovar");
    const ok = e.target.checked;
    await updateDoc(doc(db,"relatorios",id), { aprovado: !!ok });
    alert("Sangria atualizada.");
    carregar();
  }
});

carregar();
