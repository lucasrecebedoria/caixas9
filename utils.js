export const ADMINS = ["4144","70029","6266"];

export function getUser(){
  try{ return JSON.parse(localStorage.getItem("user")||"null"); }catch(e){ return null; }
}
export function guard(){
  const u=getUser(); if(!u){ location.href="login.html"; return null; } return u;
}
export function formatBR(d=new Date()){
  return new Intl.DateTimeFormat('pt-BR').format(d);
}
export function todayKey(){
  const d=new Date(); return d.toISOString().slice(0,10); // YYYY-MM-DD
}
export function money(n){ return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
