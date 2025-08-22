function traduzErro(err){
  const m = err && err.message ? err.message : String(err);
  if(m.includes('auth/user-not-found')) return 'Usuário não encontrado.';
  if(m.includes('auth/wrong-password')) return 'Senha incorreta.';
  if(m.includes('auth/email-already-in-use')) return 'Matrícula já cadastrada.';
  return 'Erro: ' + m;
}
function hojeStr(){
  const d = new Date(); d.setHours(0,0,0,0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function dataStr(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
