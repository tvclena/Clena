import {getSupabase} from './supabase-client.js';
export const db=await getSupabase();
export const $=id=>document.getElementById(id);
export const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const slugFromUrl=()=>{const q=new URLSearchParams(location.search).get('slug');if(q)return q;const p=location.pathname.split('/').filter(Boolean);return p.at(-1)?.replace(/\.html$/,'')||''};
export function theme(p,a){document.documentElement.style.setProperty('--primary',p||'#2563eb');document.documentElement.style.setProperty('--accent',a||'#0f172a')}
export function toast(t){const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),2600)}
export function wa(phone,text){return `https://wa.me/${String(phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(text)}`}
