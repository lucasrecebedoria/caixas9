import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, setDoc, updateDoc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ADMINS, guard, formatBR, todayKey, money } from "./utils.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const user = guard(); if(!user) throw new Error("sem login");
const isAdmin = !!user.admin || ADMINS.includes(user.matricula);
document.querySelector("#userBadge").textContent = `${user.nome} (${user.matricula})${isAdmin?" • ADMIN":""}`;
document.querySelector("#userBadge").className = `badge ${isAdmin?"gold":"green"}`;

document.getElementById("hoje").textContent = formatBR(new Date());
document.getElementById("matRecebedor").value = user.matricula;
document.getElementById("data").value = formatBR(new Date());

let caixaAtual = null; // {id, ...}

async function carregarCaixaAberto(){
  const qy = query(collection(db,"caixas"), where("matricula","==",user.matricula), where("status","==","aberto"), where("dia","==",todayKey()));
  const snap = await getDocs(qy);
  if(!snap.empty){
    const d = snap.docs[0]; caixaAtual = { id:d.id, ...d.data() };
  }else{
    caixaAtual = null;
  }
  atualizarUI();
}
function atualizarUI(){
  document.getElementById("situacao").textContent = caixaAtual? "Aberto":"Fechado";
  document.getElementById("caixaId").textContent = caixaAtual? caixaAtual.id : "—";
  document.getElementById("abastecerBtn").classList.toggle("hidden", !caixaAtual);
  document.getElementById("abastecimentoCard").style.display = caixaAtual? "block":"none";
}

document.getElementById("openBoxBtn").addEventListener("click", async ()=>{
  if(caixaAtual){ alert("Já há um caixa aberto hoje."); return; }
  const docRef = await addDoc(collection(db,"caixas"), {
    matricula: user.matricula,
    nome: user.nome,
    abertura: serverTimestamp(),
    dia: todayKey(),
    status: "aberto",
    totais: { bruto:0, sangria:0, liquido:0 }
  });
  caixaAtual = { id:docRef.id };
  await carregarCaixaAberto();
  alert("Caixa aberto.");
});

document.getElementById("closeBoxBtn").addEventListener("click", async ()=>{
  if(!caixaAtual){ alert("Nenhum caixa aberto."); return; }
  await updateDoc(doc(db,"caixas",caixaAtual.id), { status:"fechado", fechamento: serverTimestamp() });
  caixaAtual = null;
  atualizarUI();
  alert("Caixa fechado.");
});

document.getElementById("abastecerBtn").addEventListener("click", ()=>{
  document.getElementById("abastecimentoCard").scrollIntoView({behavior:"smooth"});
});

// valor automático
document.getElementById("bordos").addEventListener("input", ()=>{
  const n = Number(document.getElementById("bordos").value)||0;
  document.getElementById("valor").value = (n*5).toFixed(2);
});

// salvar abastecimento + recibo
document.getElementById("formAb").addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!caixaAtual){ alert("Abra o caixa primeiro."); return; }
  const bordos = Number(document.getElementById("bordos").value||0);
  if(bordos<=0){ alert("Informe bordos."); return; }
  const registro = {
    tipo:"abastecimento",
    caixaId: caixaAtual.id,
    dia: todayKey(),
    dataBR: document.getElementById("data").value,
    validador: document.getElementById("validador").value,
    bordos,
    valor: bordos*5,
    prefixo: "55"+ String(document.getElementById("prefixo").value).padStart(3,"0"),
    motorista: document.getElementById("matMotorista").value.trim(),
    recebedor: user.matricula,
    nomeRecebedor: user.nome,
    obs: document.getElementById("obs").value.trim(),
    createdAt: serverTimestamp(),
  };
  try{
    await addDoc(collection(db,"relatorios"), registro);
    // Atualizar totais do caixa
    const cxRef = doc(db,"caixas",caixaAtual.id);
    const cxSnap = await getDoc(cxRef);
    const totais = cxSnap.exists() && cxSnap.data().totais ? cxSnap.data().totais : {bruto:0,sangria:0,liquido:0};
    totais.bruto += registro.valor;
    totais.liquido = totais.bruto - (totais.sangria||0);
    await updateDoc(cxRef, { totais });

    imprimirRecibo(registro);
  }catch(e){
    console.error(e); alert("Erro ao salvar.");
  }
});

// Botão Sangria (solicitar)
document.getElementById("sangriaBtn").addEventListener("click", async ()=>{
  if(!caixaAtual){ alert("Abra o caixa primeiro."); return; }
  const valor = prompt("Valor a ser sangrado (R$):");
  if(!valor) return;
  const motivo = prompt("Motivo da sangria:");
  try{
    await addDoc(collection(db,"relatorios"), {
      tipo:"sangria", aprovado:false, caixaId:caixaAtual.id, dia: todayKey(),
      valor: Number(valor), motivo, solicitante: user.matricula, createdAt: serverTimestamp()
    });
    alert("Sangria solicitada. Aguarde aprovação do admin nos relatórios.");
  }catch(e){ console.error(e); alert("Erro ao solicitar sangria."); }
});

function imprimirRecibo(r){
  const html = `
  <div class="receipt">
    <h1>RECIBO DE PAGAMENTO MANUAL</h1>
    <hr>
    <div>Tipo de validador: ${r.validador}</div>
    <div>PREFIXO: ${r.prefixo}</div>
    <div>QUANTIDADE BORDOS: ${r.bordos}</div>
    <div>VALOR: ${money(r.valor)}</div>
    <div>MATRICULA MOTORISTA: ${r.motorista}</div>
    <div>MATRICULA RECEBEDOR: ${r.recebedor}</div>
    <br>
    <div>ASSINATURA RECEBEDOR: _____________________</div>
    <hr>
  </div>`;
  const w = window.open("","_blank","width=320,height=600");
  w.document.write(`<!doctype html><meta charset='utf-8'><style>${document.querySelector('link[href="styles.css"]')? '': ''}</style>${html}`);
  w.document.close(); w.focus(); w.print(); setTimeout(()=>w.close(), 500);
}

// Alterar senha (apenas Firestore/localStorage)
document.getElementById("changePassBtn").addEventListener("click", async ()=>{
  const nova = prompt("Nova senha:");
  if(!nova) return;
  try{
    await updateDoc(doc(db,"usuarios",user.matricula), { senha:nova });
    user.senha = nova; localStorage.setItem("user", JSON.stringify(user));
    alert("Senha atualizada.");
  }catch(e){ console.error(e); alert("Erro ao atualizar senha."); }
});

document.getElementById("logoutBtn").addEventListener("click", ()=>{
  localStorage.removeItem("user"); location.href="login.html";
});

await carregarCaixaAberto();
