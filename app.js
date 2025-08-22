let currentUser = null;
let userDoc = null;
let caixaAtual = null; // documento de caixa aberto

const adminMatriculas = ['4144','70029','6266'];

document.addEventListener('DOMContentLoaded', async () => {
  firebase.auth().onAuthStateChanged(async (user)=>{
    if(!user){ location.href='login.html'; return; }
    currentUser = user;
    // carregar doc do usuário
    const uref = db.collection('usuarios').doc(user.uid);
    const snap = await uref.get();
    if(!snap.exists){
      // criar automaticamente (garante coleção)
      await uref.set({ uid:user.uid, matricula: user.email.split('@')[0], nome:'', papel: adminMatriculas.includes(user.email.split('@')[0])?'admin':'user', createdAt: firebase.firestore.FieldValue.serverTimestamp() }, {merge:true});
    }
    userDoc = (await uref.get()).data();

    // badge
    const badge = document.getElementById('userBadge');
    const texto = `${userDoc.nome || 'Sem Nome'} • ${userDoc.matricula}`;
    badge.textContent = texto;
    if((userDoc.papel||'user')==='admin'){ badge.classList.add('gold'); }

    // mostra botões topo
    document.getElementById('changePwd').onclick = changePassword;
    document.getElementById('logout').onclick = ()=> firebase.auth().signOut().then(()=>location.href='login.html');

    // menu
    const drawer = document.getElementById('drawer');
    document.getElementById('menuBtn').onclick = ()=> drawer.classList.toggle('hidden');
    drawer.querySelector('[data-view="abastecimento"]').onclick = (e)=>{e.preventDefault(); showView('abastecimento'); drawer.classList.add('hidden')};
    drawer.querySelector('[data-view="relatorios"]').onclick = (e)=>{e.preventDefault(); location.href='#relatorios'; showView('relatorios'); drawer.classList.add('hidden')};

    // preencher matrícula recebedor automaticamente
    document.querySelector('#absForm [name="matRecebedor"]').value = userDoc.matricula;

    // listeners
    document.querySelector('#absForm [name="qtd"]').addEventListener('input', e=>{
      const qtd = Number(e.target.value||0);
      document.querySelector('#absForm [name="valor"]').value = (qtd*5).toFixed(2);
    });

    document.getElementById('openBox').onclick = abrirCaixa;
    document.getElementById('closeBox').onclick = fecharCaixa;
    document.getElementById('exportCSV').onclick = exportarCSV;
    document.getElementById('printReport').onclick = ()=> window.print();
    document.getElementById('filtroData').value = hojeStr();
    document.getElementById('filtroData').addEventListener('change', carregarRelatorios);

    document.getElementById('absForm').addEventListener('submit', salvarAbastecimento);
    document.getElementById('sangriaForm').addEventListener('submit', solicitarSangria);

    await checarCaixa();
    if(location.hash==='#relatorios'){ showView('relatorios'); } else { showView('abastecimento'); }
    await carregarRelatorios();
  });
});

function showView(view){
  document.getElementById('abastecimentoView').classList.add('hidden');
  document.getElementById('relatoriosView').classList.add('hidden');
  if(view==='relatorios') document.getElementById('relatoriosView').classList.remove('hidden');
  if(view==='abastecimento') document.getElementById('abastecimentoView').classList.remove('hidden');
}

async function changePassword(){
  const nova = prompt('Nova senha (mínimo 6 caracteres):');
  if(!nova) return;
  try{
    await currentUser.updatePassword(nova);
    alert('Senha atualizada.');
  }catch(e){ alert(traduzErro(e)); }
}

async function checarCaixa(){
  const status = document.getElementById('boxStatus');
  const boxOpenBtn = document.getElementById('openBox');
  const boxCloseBtn = document.getElementById('closeBox');
  // procura caixa aberto do usuário
  const q = await db.collection('caixas')
    .where('uid','==',currentUser.uid)
    .where('status','==','aberto')
    .limit(1).get();
  if(!q.empty){
    caixaAtual = { id: q.docs[0].id, ...q.docs[0].data() };
    status.textContent = `Caixa aberto em ${new Date(caixaAtual.abertoEm.seconds*1000).toLocaleString('pt-BR')}`;
    boxOpenBtn.disabled = true;
    boxCloseBtn.disabled = false;
    document.getElementById('abastecimentoView').classList.remove('hidden');
  } else {
    caixaAtual = null;
    status.textContent = 'Nenhum caixa aberto.';
    boxOpenBtn.disabled = false;
    boxCloseBtn.disabled = true;
    // esconder abastecimento até abrir caixa
    document.getElementById('abastecimentoView').classList.add('hidden');
  }
}

async function abrirCaixa(){
  try{
    const doc = await db.collection('caixas').add({
      uid: currentUser.uid,
      matricula: userDoc.matricula,
      nome: userDoc.nome||'',
      status:'aberto',
      abertoEm: firebase.firestore.FieldValue.serverTimestamp(),
      sangrias:[],
      totalSangriaAprovada:0
    });
    caixaAtual = { id: doc.id };
    await checarCaixa();
  }catch(e){ alert(traduzErro(e)); }
}

async function fecharCaixa(){
  if(!caixaAtual){ alert('Nenhum caixa aberto.'); return; }
  try{
    // calcula totais
    const absSnap = await db.collection('caixas').doc(caixaAtual.id).collection('abastecimentos').get();
    let total = 0;
    absSnap.forEach(d=> total += (d.data().valor||0) );
    const caixaDoc = await db.collection('caixas').doc(caixaAtual.id).get();
    const sangriaAprovada = caixaDoc.data().totalSangriaAprovada||0;
    await db.collection('caixas').doc(caixaAtual.id).set({
      status:'fechado',
      fechadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      totalRecebido: total,
      totalPosSangria: total - sangriaAprovada
    },{merge:true});
    alert('Caixa fechado.');
    caixaAtual = null;
    await checarCaixa();
    await carregarRelatorios();
  }catch(e){ alert(traduzErro(e)); }
}

async function salvarAbastecimento(e){
  e.preventDefault();
  if(!caixaAtual){ alert('Abra um caixa antes de lançar.'); return; }
  const f = e.target;
  const validador = f.validador.value;
  const qtd = Number(f.qtd.value);
  const valor = Number(f.valor.value);
  const prefixo = '55' + f.prefixo.value;
  const data = f.data.value || hojeStr();
  const matMotorista = f.matMotorista.value.trim();
  const matRecebedor = f.matRecebedor.value.trim();
  const createdAt = new Date();
  try{
    const ref = db.collection('caixas').doc(caixaAtual.id).collection('abastecimentos');
    const docRef = await ref.add({ validador,qtd,valor,prefixo,data,matMotorista,matRecebedor,uid:currentUser.uid,createdAt });
    // garante coleção relatorios/dia/matricula
    const diaId = data;
    const relRef = db.collection('relatorios').doc(diaId).collection('porMatricula').doc(userDoc.matricula);
    await db.runTransaction(async (tx)=>{
      const snap = await tx.get(relRef);
      const base = snap.exists ? snap.data() : { total:0, totalPosSangria:0, sangriaAprovada:0, matricula:userDoc.matricula, nome:userDoc.nome||'', itens:0 };
      base.total += valor;
      base.totalPosSangria = base.total - (base.sangriaAprovada||0);
      base.itens += 1;
      tx.set(relRef, base, {merge:true});
    });
    document.getElementById('absMsg').textContent = 'Salvo com sucesso. Imprimindo...';
    imprimirRecibo({ validador, prefixo, qtd, valor, matMotorista, matRecebedor });
    f.reset();
    document.querySelector('#absForm [name="valor"]').value = '';
    document.querySelector('#absForm [name="matRecebedor"]').value = userDoc.matricula;
    await carregarRelatorios();
  }catch(e){ alert(traduzErro(e)); }
}

function imprimirRecibo({validador,prefixo,qtd,valor,matMotorista,matRecebedor}){
  const frame = document.getElementById('printFrame').contentWindow || document.getElementById('printFrame');
  const html = `<!doctype html><html><head><meta charset="utf-8">
  <style>
  body{margin:0}
  .receipt{width:80mm;margin:0 auto;font-family:monospace;font-size:12px;color:#000;background:#fff;padding:6mm}
  .receipt h1{text-align:center;font-size:14px;margin:0 0 8px 0}
  .line{display:flex;justify-content:space-between;margin:6px 0}
  .sign{margin-top:14px}
  </style></head><body onload="window.print(); setTimeout(()=>window.close&&window.close(), 300);">
  <div class="receipt">
    <h1>RECIBO DE PAGAMENTO MANUAL</h1>
    <div class="line"><strong>Tipo de validador:</strong><span>${validador}</span></div>
    <div class="line"><strong>PREFIXO:</strong><span>${prefixo}</span></div>
    <div class="line"><strong>QUANTIDADE BORDOS:</strong><span>${qtd}</span></div>
    <div class="line"><strong>VALOR:</strong><span>R$ ${valor.toFixed(2)}</span></div>
    <div class="line"><strong>MATRICULA MOTORISTA:</strong><span>${matMotorista}</span></div>
    <div class="line"><strong>MATRICULA RECEBEDOR:</strong><span>${matRecebedor}</span></div>
    <div class="sign">ASSINATURA RECEBEDOR: _____________________</div>
  </div>
  </body></html>`;
  const doc = document.getElementById('printFrame').contentDocument;
  doc.open(); doc.write(html); doc.close();
}

async function solicitarSangria(e){
  e.preventDefault();
  if(!caixaAtual){ alert('Abra um caixa antes de sangrar.'); return; }
  const f = e.target;
  const valor = Number(f.valor.value);
  const motivo = f.motivo.value;
  const registro = { valor, motivo, aprovado:false, uid: currentUser.uid, nome:userDoc.nome||'', matricula:userDoc.matricula, criadoEm: new Date() };
  try{
    const boxRef = db.collection('caixas').doc(caixaAtual.id);
    await boxRef.update({ sangrias: firebase.firestore.FieldValue.arrayUnion(registro) });
    document.getElementById('sangriaMsg').textContent = 'Sangria solicitada, aguardando aprovação do admin.';
    f.reset();
    await carregarRelatorios();
  }catch(e){ alert(traduzErro(e)); }
}

async function carregarRelatorios(){
  const dataFiltro = document.getElementById('filtroData').value || hojeStr();
  const cont = document.getElementById('relatoriosContainer');
  cont.innerHTML = '<div class="msg">Carregando...</div>';
  try{
    const isAdmin = (userDoc.papel||'user')==='admin';
    let caixasSnap;
    if(isAdmin){
      // todos os caixas da data
      const start = new Date(dataFiltro+"T00:00:00");
      const end = new Date(dataFiltro+"T23:59:59");
      caixasSnap = await db.collection('caixas')
        .where('abertoEm','>=', start)
        .get();
      // filtro por data nos abastecimentos mais abaixo
    }else{
      caixasSnap = await db.collection('caixas').where('uid','==',currentUser.uid).get();
    }

    // Montar estrutura por caixa
    const rows = [];
    let totalDia = 0;
    const sections = [];

    for(const doc of caixasSnap.docs){
      const cx = { id: doc.id, ...doc.data() };
      // carregar abastecimentos da data filtrada
      const absSnap = await db.collection('caixas').doc(cx.id).collection('abastecimentos')
        .where('data','==', dataFiltro).get();
      if(absSnap.empty) continue; // não tem lançamentos nesse dia
      let subtotal = 0;
      const itens = [];
      absSnap.forEach(d=>{
        const it = d.data(); subtotal += (it.valor||0);
        itens.push(`<tr>
          <td>${new Date(it.createdAt.seconds*1000).toLocaleTimeString('pt-BR')}</td>
          <td>${it.validador}</td><td>${it.prefixo}</td><td>${it.qtd}</td><td>R$ ${Number(it.valor).toFixed(2)}</td><td>${it.matMotorista}</td>
          ${isAdmin?`<td><button class="btn small outline" onclick="editarAbastecimento('${cx.id}','${d.id}')">Editar</button> <button class="btn small danger" onclick="excluirAbastecimento('${cx.id}','${d.id}')">Excluir</button></td>`:''}
        </tr>`);
      });
      totalDia += subtotal;

      // sangrias
      const sangrias = (cx.sangrias||[]).filter(s=> dataStr(new Date(s.criadoEm.seconds*1000))===dataFiltro );
      const sangriaHtml = sangrias.map((s,idx)=>{
        return `<div class="kv">
          <div>#${idx+1} Sangria: R$ ${Number(s.valor).toFixed(2)} • ${s.motivo}</div>
          <div>${isAdmin?`Aprovar <input type="checkbox" ${s.aprovado?'checked':''} onchange="aprovarSangria('${cx.id}', ${idx}, this.checked)">`: (s.aprovado?'Aprovada':'Pendente')}</div>
        </div>`;
      }).join('');

      const sangriaAprovada = sangrias.filter(s=>s.aprovado).reduce((a,b)=>a+Number(b.valor||0),0);
      const posSangria = subtotal - sangriaAprovada;

      sections.push(`<details class="card" ${cx.status==='fechado'?'':'open'}>
        <summary><strong>Abertura caixa:</strong> ${cx.abertoEm?.toDate?cx.abertoEm.toDate().toLocaleString('pt-BR'):''} • 
                 <strong>Fechamento caixa:</strong> ${cx.fechadoEm?.toDate?cx.fechadoEm.toDate().toLocaleString('pt-BR'):'—'} • 
                 <strong>Matrícula:</strong> ${cx.matricula}</summary>
        <table class="table">
          <thead><tr><th>Hora</th><th>Validador</th><th>Prefixo</th><th>Bordos</th><th>Valor</th><th>Motorista</th>${isAdmin?'<th>Ações</th>':''}</tr></thead>
          <tbody>
            ${itens.join('')}
          </tbody>
        </table>
        <div class="kv"><strong>Total do caixa:</strong><span>R$ ${subtotal.toFixed(2)}</span></div>
        ${sangrias.length?`<div class="kv"><strong>Valor sangria aprovado:</strong><span>R$ ${sangriaAprovada.toFixed(2)}</span></div>`:''}
        ${sangrias.length?`<div class="kv"><strong>Valor pós sangria:</strong><span>R$ ${posSangria.toFixed(2)}</span></div>`:''}
        ${sangriaHtml}
      </details>`);
    }

    cont.innerHTML = `
      <div class="card sub">
        <div class="kv"><strong>Total do dia (antes de sangrias):</strong><span>R$ ${totalDia.toFixed(2)}</span></div>
      </div>
      ${sections.join('') || '<div class="msg">Sem lançamentos para a data.</div>'}
    `;
  }catch(e){
    cont.innerHTML = '<div class="msg">Erro ao carregar relatórios: '+traduzErro(e)+'</div>';
  }
}

async function aprovarSangria(caixaId, idx, aprovado){
  const ref = db.collection('caixas').doc(caixaId);
  const doc = await ref.get();
  const arr = doc.data().sangrias||[];
  if(!arr[idx]) return;
  arr[idx].aprovado = aprovado;
  await ref.update({ sangrias: arr, totalSangriaAprovada: arr.filter(s=>s.aprovado).reduce((a,b)=>a+Number(b.valor||0),0) });
  await carregarRelatorios();
}

async function editarAbastecimento(caixaId, absId){
  const ref = db.collection('caixas').doc(caixaId).collection('abastecimentos').doc(absId);
  const snap = await ref.get();
  const it = snap.data();
  const novoQtd = Number(prompt('Quantidade de bordos:', it.qtd));
  if(!novoQtd || novoQtd<=0) return;
  const novoValor = novoQtd * 5;
  await ref.update({ qtd: novoQtd, valor: novoValor });
  await carregarRelatorios();
}
async function excluirAbastecimento(caixaId, absId){
  if(!confirm('Excluir este lançamento?')) return;
  await db.collection('caixas').doc(caixaId).collection('abastecimentos').doc(absId).delete();
  await carregarRelatorios();
}

async function exportarCSV(){
  const dataFiltro = document.getElementById('filtroData').value || hojeStr();
  const isAdmin = (userDoc.papel||'user')==='admin';
  let linhas = ['Data,Hora,Matrícula,Validador,Prefixo,Bordos,Valor'];
  let caixasSnap;
  if(isAdmin){
    caixasSnap = await db.collection('caixas').get();
  }else{
    caixasSnap = await db.collection('caixas').where('uid','==',currentUser.uid).get();
  }
  for(const doc of caixasSnap.docs){
    const cx = doc.data();
    const absSnap = await db.collection('caixas').doc(doc.id).collection('abastecimentos').where('data','==',dataFiltro).get();
    absSnap.forEach(d=>{
      const it = d.data();
      const hora = it.createdAt?.seconds? new Date(it.createdAt.seconds*1000).toLocaleTimeString('pt-BR') : '';
      linhas.push([it.data || dataFiltro, hora, cx.matricula, it.validador, it.prefixo, it.qtd, it.valor].join(','));
    });
  }
  const csv = linhas.join('\\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `relatorio_${dataFiltro}.csv`; a.click();
  URL.revokeObjectURL(url);
}
