import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ADMINS } from "./utils.js";
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.getElementById("registerBtn").addEventListener("click", async ()=>{
  const matricula = String(document.getElementById("matricula").value.trim());
  const nome = String(document.getElementById("nome").value.trim());
  const senha = String(document.getElementById("senha").value.trim());
  if(!matricula || !nome || !senha){ alert("Preencha todos os campos."); return; }
  const user = { matricula, nome, senha, admin: ADMINS.includes(matricula) };
  try{
    await setDoc(doc(db,"usuarios",matricula), user);
    alert("Cadastro concluído! Agora faça login.");
    location.href="login.html";
  }catch(e){ console.error(e); alert("Erro ao registrar."); }
});
