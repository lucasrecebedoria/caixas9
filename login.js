import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ADMINS } from "./utils.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.getElementById("loginBtn").addEventListener("click", async ()=>{
  const matricula = String(document.getElementById("matricula").value.trim());
  const senha = String(document.getElementById("senha").value.trim());
  if(!matricula || !senha){ alert("Preencha matrícula e senha."); return; }
  try{
    const snap = await getDoc(doc(db,"usuarios",matricula));
    if(!snap.exists()){ alert("Usuário não encontrado."); return; }
    const u = snap.data();
    if(u.senha !== senha){ alert("Senha incorreta."); return; }
    // badge admin garantida
    u.admin = !!u.admin || ADMINS.includes(matricula);
    localStorage.setItem("user", JSON.stringify(u));
    location.href = "home.html";
  }catch(e){
    console.error(e); alert("Erro ao logar.");
  }
});
