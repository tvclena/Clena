import { supabase } from './supabase-client.js';

const $ = (id) => document.getElementById(id);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const esc = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const uid = () => crypto.randomUUID();

const state = {
  user: null,
  profile: null,
  business: null,
  services: [],
  resources: [],
  schedules: [],
  blocks: [],
  customers: [],
  appointments: [],
  pendingLogo: null,
  pendingCover: null
};

const defaultBusiness = {
  name: '', business_type: 'service', description: '', whatsapp: '', instagram: '', phone: '', email: '', address: '',
  primary_color: '#2563eb', timezone: 'America/Sao_Paulo', slot_interval: 15, min_notice_minutes: 60, max_advance_days: 60,
  buffer_minutes: 0, cancellation_hours: 24, max_per_customer_day: 0, auto_confirm: true, waitlist_enabled: false,
  reschedule_enabled: true, manual_approval: false, require_cpf: false, require_terms: false, cancellation_policy: '', terms_text: '',
  payment_mode: 'none', deposit_percentage: 30, deposit_fixed: 0, payment_deadline_minutes: 30, refund_policy: 'manual',
  pay_pix: true, pix_key: '', pix_receiver: '', pay_card_online: false, pay_on_site: true, require_receipt: false,
  notify_confirmation: true, notify_reminder: true, reminder_hours: 24, notification_channel: 'whatsapp', notify_payment: true,
  notify_aftercare: false, confirmation_message: 'Olá, {cliente}! Seu agendamento para {servico} foi recebido para {data} às {hora}.',
  reminder_message: 'Olá, {cliente}! Lembrete do seu agendamento de {servico} amanhã às {hora}.',
  slug: '', is_published: false, show_prices: true, show_resources: true, allow_any_resource: true, logo_url: '', cover_url: ''
};

const weekdays = [
  ['monday','Segunda-feira'],['tuesday','Terça-feira'],['wednesday','Quarta-feira'],['thursday','Quinta-feira'],
  ['friday','Sexta-feira'],['saturday','Sábado'],['sunday','Domingo']
];

function toast(message, type = 'ok') {
  const el = document.createElement('div'); el.className = `toast ${type === 'error' ? 'error' : ''}`; el.textContent = message;
  $('toastRegion').appendChild(el); setTimeout(() => el.remove(), 3200);
}

function setSection(name) {
  qsa('.editor-section').forEach((el) => el.classList.toggle('is-active', el.id === `section-${name}`));
  qsa('.nav-item[data-section]').forEach((el) => el.classList.toggle('is-active', el.dataset.section === name));
  const active = document.querySelector(`.nav-item[data-section="${name}"] span`);
  $('pageTitle').textContent = active?.textContent || 'Editor';
  document.querySelector('.sidebar')?.classList.remove('is-open');
}

function bindNavigation() {
  qsa('[data-section]').forEach((btn) => btn.addEventListener('click', () => setSection(btn.dataset.section)));
  qsa('[data-go]').forEach((btn) => btn.addEventListener('click', () => setSection(btn.dataset.go)));
  $('mobileMenu').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('is-open'));
}

async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = './index.html'; return false; }
  state.user = session.user;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
  state.profile = profile;
  $('profileInitial').textContent = (profile?.store_name || state.user.email || 'C').charAt(0).toUpperCase();
  return true;
}

async function loadAll() {
  const userId = state.user.id;
  const [businessRes, servicesRes, resourcesRes, schedulesRes, blocksRes, customersRes, appointmentsRes] = await Promise.all([
    supabase.from('scheduling_businesses').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('scheduling_services').select('*').eq('user_id', userId).order('sort_order'),
    supabase.from('scheduling_resources').select('*').eq('user_id', userId).order('name'),
    supabase.from('scheduling_weekly_hours').select('*').eq('user_id', userId),
    supabase.from('scheduling_blocks').select('*').eq('user_id', userId).order('starts_at'),
    supabase.from('scheduling_customers').select('*').eq('user_id', userId).order('name'),
    supabase.from('scheduling_appointments').select('*, scheduling_services(name), scheduling_resources(name), scheduling_customers(name,phone)').eq('user_id', userId).order('starts_at', { ascending: false }).limit(300)
  ]);
  for (const res of [businessRes, servicesRes, resourcesRes, schedulesRes, blocksRes, customersRes, appointmentsRes]) {
    if (res.error) console.error(res.error);
  }
  state.business = { ...defaultBusiness, ...(businessRes.data || {}), user_id: userId };
  state.services = servicesRes.data || [];
  state.resources = resourcesRes.data || [];
  state.schedules = schedulesRes.data || [];
  state.blocks = blocksRes.data || [];
  state.customers = customersRes.data || [];
  state.appointments = appointmentsRes.data || [];
  if (!state.schedules.length) state.schedules = weekdays.map(([day]) => ({ id: uid(), user_id: userId, weekday: day, is_open: !['sunday'].includes(day), start_time: '08:00', end_time: '18:00', break_start: '', break_end: '' }));
}

function fillBusiness() {
  const b = state.business;
  const map = {
    businessName:'name', businessType:'business_type', businessDescription:'description', businessWhatsapp:'whatsapp', businessInstagram:'instagram',
    businessPhone:'phone', businessEmail:'email', businessAddress:'address', primaryColor:'primary_color', timezone:'timezone', slotInterval:'slot_interval',
    minNotice:'min_notice_minutes', maxAdvanceDays:'max_advance_days', bufferMinutes:'buffer_minutes', cancellationHours:'cancellation_hours',
    maxPerCustomerDay:'max_per_customer_day', autoConfirm:'auto_confirm', waitlistEnabled:'waitlist_enabled', rescheduleEnabled:'reschedule_enabled',
    manualApproval:'manual_approval', requireCpf:'require_cpf', requireTerms:'require_terms', cancellationPolicy:'cancellation_policy', termsText:'terms_text',
    depositPercentage:'deposit_percentage', depositFixed:'deposit_fixed', paymentDeadlineMinutes:'payment_deadline_minutes', refundPolicy:'refund_policy',
    payPix:'pay_pix', pixKey:'pix_key', pixReceiver:'pix_receiver', payCardOnline:'pay_card_online', payOnSite:'pay_on_site', requireReceipt:'require_receipt',
    notifyConfirmation:'notify_confirmation', notifyReminder:'notify_reminder', reminderHours:'reminder_hours', notificationChannel:'notification_channel',
    notifyPayment:'notify_payment', notifyAftercare:'notify_aftercare', confirmationMessage:'confirmation_message', reminderMessage:'reminder_message',
    publicSlug:'slug', isPublished:'is_published', showPrices:'show_prices', showResources:'show_resources', allowAnyResource:'allow_any_resource'
  };
  Object.entries(map).forEach(([id,key]) => { const el = $(id); if (!el) return; if (el.type === 'checkbox') el.checked = !!b[key]; else el.value = b[key] ?? ''; });
  qsa('input[name="paymentMode"]').forEach((el) => el.checked = el.value === b.payment_mode);
  updateMediaPreview();
}

function collectBusiness() {
  const get = (id) => $(id)?.value ?? '';
  const checked = (id) => !!$(id)?.checked;
  return {
    ...state.business, user_id: state.user.id, name:get('businessName').trim(), business_type:get('businessType'), description:get('businessDescription').trim(),
    whatsapp:get('businessWhatsapp').trim(), instagram:get('businessInstagram').trim(), phone:get('businessPhone').trim(), email:get('businessEmail').trim(),
    address:get('businessAddress').trim(), primary_color:get('primaryColor'), timezone:get('timezone'), slot_interval:Number(get('slotInterval') || 15),
    min_notice_minutes:Number(get('minNotice') || 0), max_advance_days:Number(get('maxAdvanceDays') || 60), buffer_minutes:Number(get('bufferMinutes') || 0),
    cancellation_hours:Number(get('cancellationHours') || 0), max_per_customer_day:Number(get('maxPerCustomerDay') || 0), auto_confirm:checked('autoConfirm'),
    waitlist_enabled:checked('waitlistEnabled'), reschedule_enabled:checked('rescheduleEnabled'), manual_approval:checked('manualApproval'), require_cpf:checked('requireCpf'),
    require_terms:checked('requireTerms'), cancellation_policy:get('cancellationPolicy'), terms_text:get('termsText'),
    payment_mode:document.querySelector('input[name="paymentMode"]:checked')?.value || 'none', deposit_percentage:Number(get('depositPercentage') || 0),
    deposit_fixed:Number(get('depositFixed') || 0), payment_deadline_minutes:Number(get('paymentDeadlineMinutes') || 30), refund_policy:get('refundPolicy'),
    pay_pix:checked('payPix'), pix_key:get('pixKey'), pix_receiver:get('pixReceiver'), pay_card_online:checked('payCardOnline'), pay_on_site:checked('payOnSite'),
    require_receipt:checked('requireReceipt'), notify_confirmation:checked('notifyConfirmation'), notify_reminder:checked('notifyReminder'), reminder_hours:Number(get('reminderHours') || 24),
    notification_channel:get('notificationChannel'), notify_payment:checked('notifyPayment'), notify_aftercare:checked('notifyAftercare'), confirmation_message:get('confirmationMessage'),
    reminder_message:get('reminderMessage'), slug:slugify(get('publicSlug')), is_published:checked('isPublished'), show_prices:checked('showPrices'), show_resources:checked('showResources'),
    allow_any_resource:checked('allowAnyResource')
  };
}

function slugify(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80); }

function updateMediaPreview() {
  const logo = state.pendingLogo ? URL.createObjectURL(state.pendingLogo) : state.business.logo_url;
  const cover = state.pendingCover ? URL.createObjectURL(state.pendingCover) : state.business.cover_url;
  $('logoPreview').style.backgroundImage = logo ? `url("${logo}")` : '';
  $('logoPreview').innerHTML = logo ? '' : '<i class="ri-store-2-line"></i><b>Logo</b>';
  $('coverPreview').style.backgroundImage = cover ? `url("${cover}")` : '';
  $('coverPreview').innerHTML = cover ? '' : '<i class="ri-image-add-line"></i><b>Adicionar capa</b><small>Recomendado: 1600 × 600</small>';
}

async function uploadImage(file, kind) {
  if (!file) return state.business[`${kind}_url`] || '';
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${state.user.id}/scheduling/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('scheduling-media').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from('scheduling-media').getPublicUrl(path).data.publicUrl;
}

async function saveAll() {
  try {
    $('saveAllButton').disabled = true;
    const business = collectBusiness();
    business.logo_url = await uploadImage(state.pendingLogo, 'logo');
    business.cover_url = await uploadImage(state.pendingCover, 'cover');
    const { data, error } = await supabase.from('scheduling_businesses').upsert(business, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    state.business = data; state.pendingLogo = null; state.pendingCover = null;
    const schedulePayload = state.schedules.map(({id, ...r}) => ({ ...r, user_id: state.user.id }));
    await supabase.from('scheduling_weekly_hours').delete().eq('user_id', state.user.id);
    if (schedulePayload.length) { const { error: se } = await supabase.from('scheduling_weekly_hours').insert(schedulePayload); if (se) throw se; }
    await loadAll(); renderAll(); toast('Configurações salvas com sucesso.');
  } catch (err) { console.error(err); toast(err.message || 'Erro ao salvar.', 'error'); }
  finally { $('saveAllButton').disabled = false; }
}

function renderAll() {
  fillBusiness(); renderStats(); renderServices(); renderResources(); renderSchedule(); renderBlocks(); renderCustomers(); renderAppointments(); renderResourceFilter(); renderPreview();
  $('sidebarName').textContent = state.business.name || state.profile?.store_name || 'Meu negócio';
  $('sidebarStatus').textContent = state.business.is_published ? 'Publicado' : 'Rascunho';
  document.documentElement.style.setProperty('--primary', state.business.primary_color || '#2563eb');
}

function renderStats() {
  $('statServices').textContent = state.services.length; $('navServiceCount').textContent = state.services.length;
  $('statResources').textContent = state.resources.length; $('statAppointments').textContent = state.appointments.length;
  $('statPendingPayments').textContent = state.appointments.filter(a => ['pending','partial'].includes(a.payment_status)).length;
  const checks = [!!state.business.name, state.services.length>0, state.resources.length>0, state.schedules.some(s=>s.is_open), !!state.business.slug, state.business.payment_mode==='none'||state.business.pay_pix||state.business.pay_card_online||state.business.pay_on_site];
  const labels = ['Dados do negócio','Serviço cadastrado','Profissional ou recurso','Horários configurados','Endereço público','Pagamento definido'];
  const done = checks.filter(Boolean).length, percent = Math.round(done/checks.length*100);
  $('setupPercent').textContent = `${percent}%`; $('setupBar').style.width = `${percent}%`;
  $('setupChecklist').innerHTML = labels.map((l,i)=>`<div class="check-item ${checks[i]?'done':''}"><i class="${checks[i]?'ri-checkbox-circle-fill':'ri-checkbox-blank-circle-line'}"></i><span>${l}</span></div>`).join('');
  const recent = state.appointments.slice(0,5);
  $('recentAppointments').className = recent.length ? 'card-list compact' : 'empty-state';
  $('recentAppointments').innerHTML = recent.length ? recent.map(a=>`<div class="item-card"><div class="thumb"><i class="ri-calendar-event-line"></i></div><div class="item-main"><h4>${esc(a.scheduling_customers?.name || a.customer_name || 'Cliente')}</h4><small>${formatDateTime(a.starts_at)} · ${esc(a.scheduling_services?.name || '')}</small></div></div>`).join('') : '<i class="ri-calendar-todo-line"></i><p>Nenhum agendamento ainda.</p>';
}

function renderServices() {
  const term = $('serviceSearch').value.toLowerCase(), filter = $('serviceStatusFilter').value;
  const list = state.services.filter(s => (!term || `${s.name} ${s.description}`.toLowerCase().includes(term)) && (filter==='all'||(filter==='active'?s.is_active:!s.is_active)));
  $('serviceList').innerHTML = list.length ? list.map(s=>`<article class="item-card"><div class="thumb" ${s.image_url?`style="background-image:url('${esc(s.image_url)}')"`:''}>${s.image_url?'':'<i class="ri-service-line"></i>'}</div><div class="item-main"><h4>${esc(s.name)}</h4><p>${esc(s.description || 'Sem descrição')}</p><small>${s.duration_minutes} min · ${money(s.price)} · Capacidade ${s.capacity || 1}</small></div><span class="badge ${s.is_active?'':'off'}">${s.is_active?'ATIVO':'INATIVO'}</span><div class="item-actions"><button data-edit-service="${s.id}"><i class="ri-pencil-line"></i></button><button data-delete-service="${s.id}"><i class="ri-delete-bin-line"></i></button></div></article>`).join('') : '<div class="empty-state"><i class="ri-service-line"></i><p>Nenhum serviço encontrado.</p></div>';
  qsa('[data-edit-service]').forEach(b=>b.onclick=()=>openServiceModal(state.services.find(s=>s.id===b.dataset.editService)));
  qsa('[data-delete-service]').forEach(b=>b.onclick=()=>deleteRow('scheduling_services',b.dataset.deleteService));
}

function renderResources() {
  $('resourceList').innerHTML = state.resources.length ? state.resources.map(r=>`<article class="item-card"><div class="thumb" ${r.image_url?`style="background-image:url('${esc(r.image_url)}')"`:''}>${r.image_url?'':`<i class="${r.resource_type==='professional'?'ri-user-star-line':'ri-building-line'}"></i>`}</div><div class="item-main"><h4>${esc(r.name)}</h4><p>${esc(r.title || resourceTypeLabel(r.resource_type))}</p><small>Capacidade: ${r.capacity || 1}${r.email?` · ${esc(r.email)}`:''}</small></div><span class="badge ${r.is_active?'':'off'}">${r.is_active?'ATIVO':'INATIVO'}</span><div class="item-actions"><button data-edit-resource="${r.id}"><i class="ri-pencil-line"></i></button><button data-delete-resource="${r.id}"><i class="ri-delete-bin-line"></i></button></div></article>`).join('') : '<div class="empty-state"><i class="ri-team-line"></i><p>Nenhum profissional ou recurso cadastrado.</p></div>';
  qsa('[data-edit-resource]').forEach(b=>b.onclick=()=>openResourceModal(state.resources.find(r=>r.id===b.dataset.editResource)));
  qsa('[data-delete-resource]').forEach(b=>b.onclick=()=>deleteRow('scheduling_resources',b.dataset.deleteResource));
}
function resourceTypeLabel(v){return {professional:'Profissional',table:'Mesa',room:'Sala',equipment:'Equipamento',unit:'Unidade',other:'Outro'}[v]||'Recurso';}

function renderSchedule() {
  $('weeklySchedule').innerHTML = weekdays.map(([day,label])=>{const s=state.schedules.find(x=>x.weekday===day)||{};return `<div class="day-row" data-day="${day}"><strong>${label}</strong><label><input class="day-open" type="checkbox" ${s.is_open?'checked':''}> Aberto</label><div class="day-times"><input class="day-start" type="time" value="${s.start_time||'08:00'}"><input class="day-end" type="time" value="${s.end_time||'18:00'}"><input class="break-start" type="time" value="${s.break_start||''}" title="Início do intervalo"><input class="break-end" type="time" value="${s.break_end||''}" title="Fim do intervalo"></div></div>`}).join('');
  qsa('.day-row').forEach(row=>qsa('input',row).forEach(inp=>inp.onchange=()=>{const s=state.schedules.find(x=>x.weekday===row.dataset.day);s.is_open=row.querySelector('.day-open').checked;s.start_time=row.querySelector('.day-start').value;s.end_time=row.querySelector('.day-end').value;s.break_start=row.querySelector('.break-start').value||null;s.break_end=row.querySelector('.break-end').value||null;}));
}

function renderBlocks() {
  $('blockList').innerHTML = state.blocks.length ? state.blocks.map(b=>`<article class="item-card"><div class="thumb"><i class="ri-calendar-close-line"></i></div><div class="item-main"><h4>${esc(b.title || 'Bloqueio')}</h4><small>${formatDateTime(b.starts_at)} até ${formatDateTime(b.ends_at)}</small></div><div class="item-actions"><button data-delete-block="${b.id}"><i class="ri-delete-bin-line"></i></button></div></article>`).join('') : '<div class="empty-state"><i class="ri-calendar-close-line"></i><p>Nenhum bloqueio cadastrado.</p></div>';
  qsa('[data-delete-block]').forEach(b=>b.onclick=()=>deleteRow('scheduling_blocks',b.dataset.deleteBlock));
}

function renderCustomers() {
  const term=$('customerSearch').value.toLowerCase(); const list=state.customers.filter(c=>!term||`${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(term));
  $('customerList').innerHTML = `<table class="data-table"><thead><tr><th>Cliente</th><th>Contato</th><th>Agendamentos</th><th>Faltas</th><th>Status</th><th></th></tr></thead><tbody>${list.map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.phone||'—')}<br><small>${esc(c.email||'')}</small></td><td>${c.total_appointments||0}</td><td>${c.no_show_count||0}</td><td><span class="badge ${c.is_blocked?'off':''}">${c.is_blocked?'BLOQUEADO':'ATIVO'}</span></td><td><button class="icon-btn" data-edit-customer="${c.id}"><i class="ri-pencil-line"></i></button></td></tr>`).join('')}</tbody></table>`;
  qsa('[data-edit-customer]').forEach(b=>b.onclick=()=>openCustomerModal(state.customers.find(c=>c.id===b.dataset.editCustomer)));
}

function renderResourceFilter(){ $('appointmentResource').innerHTML='<option value="all">Todos os recursos</option>'+state.resources.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join(''); }

function renderAppointments() {
  const date=$('appointmentDate').value,status=$('appointmentStatus').value,res=$('appointmentResource').value;
  const list=state.appointments.filter(a=>(!date||a.starts_at?.slice(0,10)===date)&&(status==='all'||a.status===status)&&(res==='all'||a.resource_id===res));
  $('appointmentList').innerHTML=list.length?list.map(a=>`<article class="appointment-card"><div class="appointment-time"><strong>${new Date(a.starts_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</strong><small>${new Date(a.starts_at).toLocaleDateString('pt-BR')}</small></div><div class="appointment-meta"><h4>${esc(a.scheduling_customers?.name||a.customer_name||'Cliente')}</h4><p>${esc(a.scheduling_services?.name||'Serviço')} · ${esc(a.scheduling_resources?.name||'Sem recurso')}</p><small>${statusLabel(a.status)} · ${paymentLabel(a.payment_status)} · ${money(a.total_amount)}</small></div><div class="item-actions"><button data-edit-appointment="${a.id}"><i class="ri-pencil-line"></i></button></div></article>`).join(''):'<div class="empty-state"><i class="ri-calendar-event-line"></i><p>Nenhum agendamento neste filtro.</p></div>';
  qsa('[data-edit-appointment]').forEach(b=>b.onclick=()=>openAppointmentModal(state.appointments.find(a=>a.id===b.dataset.editAppointment)));
}
function statusLabel(v){return {pending:'Pendente',confirmed:'Confirmado',completed:'Concluído',cancelled:'Cancelado',no_show:'Não compareceu'}[v]||v;}
function paymentLabel(v){return {not_required:'Sem cobrança',pending:'Pagamento pendente',partial:'Sinal pago',paid:'Pago',refunded:'Reembolsado'}[v]||v||'Sem cobrança';}
function formatDateTime(v){return v?new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';}

function renderPreview() {
  const b=collectBusiness(); const services=state.services.filter(s=>s.is_active).slice(0,5);
  const logo = state.pendingLogo ? URL.createObjectURL(state.pendingLogo) : b.logo_url; const cover=state.pendingCover?URL.createObjectURL(state.pendingCover):b.cover_url;
  const html=`<div class="preview-cover" ${cover?`style="background-image:url('${cover}')"`:''}></div><div class="preview-brand"><div class="preview-logo" ${logo?`style="background-image:url('${logo}')"`:''}>${logo?'':'<i class="ri-calendar-check-line"></i>'}</div><h3>${esc(b.name||'Seu negócio')}</h3><p>${esc(b.description||'Escolha um serviço e reserve seu horário.')}</p></div><div>${services.map(s=>`<div class="preview-service"><strong>${esc(s.name)}</strong><small>${s.duration_minutes} min${b.show_prices?` · ${money(s.price)}`:''}</small></div>`).join('')||'<div class="empty-state"><p>Cadastre seus serviços.</p></div>'}</div>`;
  $('publicPreview').innerHTML=html; $('drawerPreview').innerHTML=html;
}

function openModal(title,kicker,body){$('modalTitle').textContent=title;$('modalKicker').textContent=kicker;$('modalBody').innerHTML=body;$('modal').classList.remove('is-hidden');}
function closeModal(){$('modal').classList.add('is-hidden');}

function openServiceModal(item={}) {
  openModal(item.id?'Editar serviço':'Novo serviço','SERVIÇO',`<form id="serviceForm" class="form-stack"><div class="form-grid"><label class="field full"><span>Nome</span><input id="mServiceName" value="${esc(item.name||'')}" required></label><label class="field full"><span>Descrição</span><textarea id="mServiceDescription" rows="3">${esc(item.description||'')}</textarea></label><label class="field"><span>Duração</span><input id="mServiceDuration" type="number" min="5" value="${item.duration_minutes||60}"></label><label class="field"><span>Preço</span><input id="mServicePrice" type="number" step="0.01" min="0" value="${item.price||0}"></label><label class="field"><span>Capacidade por horário</span><input id="mServiceCapacity" type="number" min="1" value="${item.capacity||1}"></label><label class="field"><span>Modalidade</span><select id="mServiceLocation"><option value="onsite" ${item.location_type==='onsite'?'selected':''}>No estabelecimento</option><option value="online" ${item.location_type==='online'?'selected':''}>Online</option><option value="customer" ${item.location_type==='customer'?'selected':''}>No endereço do cliente</option><option value="hybrid" ${item.location_type==='hybrid'?'selected':''}>Híbrido</option></select></label><label class="field"><span>Preço antecipado próprio</span><select id="mServicePayment"><option value="inherit">Usar regra geral</option><option value="none">Sem pagamento</option><option value="full">Integral</option><option value="percentage">Percentual</option><option value="fixed">Sinal fixo</option></select></label><label class="field"><span>Valor/percentual</span><input id="mServiceDeposit" type="number" step="0.01" min="0" value="${item.deposit_value||0}"></label><label class="toggle-row full"><span><b>Serviço ativo</b></span><input id="mServiceActive" type="checkbox" ${item.is_active!==false?'checked':''}></label><label class="toggle-row full"><span><b>Permitir escolha de recurso</b></span><input id="mServiceResourceChoice" type="checkbox" ${item.allow_resource_choice!==false?'checked':''}></label></div><div class="modal-footer"><button type="button" class="secondary-btn" data-close-modal>Cancelar</button><button class="primary-btn">Salvar serviço</button></div></form>`);
  $('mServicePayment').value=item.payment_mode||'inherit';
  $('serviceForm').onsubmit=async e=>{e.preventDefault();const payload={id:item.id||uid(),user_id:state.user.id,name:$('mServiceName').value.trim(),description:$('mServiceDescription').value.trim(),duration_minutes:Number($('mServiceDuration').value),price:Number($('mServicePrice').value),capacity:Number($('mServiceCapacity').value),location_type:$('mServiceLocation').value,payment_mode:$('mServicePayment').value,deposit_value:Number($('mServiceDeposit').value),is_active:$('mServiceActive').checked,allow_resource_choice:$('mServiceResourceChoice').checked,sort_order:item.sort_order??state.services.length};const {error}=await supabase.from('scheduling_services').upsert(payload);if(error)return toast(error.message,'error');closeModal();await loadAll();renderAll();toast('Serviço salvo.');};
}

function openResourceModal(item={}) {
  openModal(item.id?'Editar recurso':'Novo recurso','RECURSO',`<form id="resourceForm" class="form-stack"><div class="form-grid"><label class="field"><span>Tipo</span><select id="mResourceType"><option value="professional">Profissional</option><option value="table">Mesa</option><option value="room">Sala</option><option value="equipment">Equipamento</option><option value="unit">Unidade</option><option value="other">Outro</option></select></label><label class="field"><span>Nome</span><input id="mResourceName" value="${esc(item.name||'')}" required></label><label class="field"><span>Cargo/descrição</span><input id="mResourceTitle" value="${esc(item.title||'')}"></label><label class="field"><span>Capacidade</span><input id="mResourceCapacity" type="number" min="1" value="${item.capacity||1}"></label><label class="field"><span>E-mail</span><input id="mResourceEmail" type="email" value="${esc(item.email||'')}"></label><label class="field"><span>Telefone</span><input id="mResourcePhone" value="${esc(item.phone||'')}"></label><label class="field full"><span>Observações</span><textarea id="mResourceNotes" rows="3">${esc(item.notes||'')}</textarea></label><label class="toggle-row full"><span><b>Ativo</b></span><input id="mResourceActive" type="checkbox" ${item.is_active!==false?'checked':''}></label></div><div class="modal-footer"><button type="button" class="secondary-btn" data-close-modal>Cancelar</button><button class="primary-btn">Salvar recurso</button></div></form>`);
  $('mResourceType').value=item.resource_type||'professional';
  $('resourceForm').onsubmit=async e=>{e.preventDefault();const payload={id:item.id||uid(),user_id:state.user.id,resource_type:$('mResourceType').value,name:$('mResourceName').value.trim(),title:$('mResourceTitle').value.trim(),capacity:Number($('mResourceCapacity').value),email:$('mResourceEmail').value.trim(),phone:$('mResourcePhone').value.trim(),notes:$('mResourceNotes').value.trim(),is_active:$('mResourceActive').checked};const {error}=await supabase.from('scheduling_resources').upsert(payload);if(error)return toast(error.message,'error');closeModal();await loadAll();renderAll();toast('Recurso salvo.');};
}

function openBlockModal(){openModal('Bloquear período','DISPONIBILIDADE',`<form id="blockForm" class="form-stack"><div class="form-grid"><label class="field full"><span>Motivo</span><input id="mBlockTitle" placeholder="Feriado, manutenção, folga..."></label><label class="field"><span>Início</span><input id="mBlockStart" type="datetime-local" required></label><label class="field"><span>Fim</span><input id="mBlockEnd" type="datetime-local" required></label><label class="field full"><span>Recurso específico</span><select id="mBlockResource"><option value="">Todo o negócio</option>${state.resources.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></label></div><div class="modal-footer"><button type="button" class="secondary-btn" data-close-modal>Cancelar</button><button class="primary-btn">Criar bloqueio</button></div></form>`);$('blockForm').onsubmit=async e=>{e.preventDefault();const {error}=await supabase.from('scheduling_blocks').insert({user_id:state.user.id,title:$('mBlockTitle').value,starts_at:new Date($('mBlockStart').value).toISOString(),ends_at:new Date($('mBlockEnd').value).toISOString(),resource_id:$('mBlockResource').value||null});if(error)return toast(error.message,'error');closeModal();await loadAll();renderAll();toast('Período bloqueado.');};}

function openCustomerModal(item={}){openModal(item.id?'Editar cliente':'Novo cliente','CLIENTE',`<form id="customerForm" class="form-stack"><div class="form-grid"><label class="field"><span>Nome</span><input id="mCustomerName" value="${esc(item.name||'')}" required></label><label class="field"><span>Telefone</span><input id="mCustomerPhone" value="${esc(item.phone||'')}"></label><label class="field"><span>E-mail</span><input id="mCustomerEmail" type="email" value="${esc(item.email||'')}"></label><label class="field"><span>CPF</span><input id="mCustomerCpf" value="${esc(item.cpf||'')}"></label><label class="field full"><span>Observações internas</span><textarea id="mCustomerNotes" rows="4">${esc(item.notes||'')}</textarea></label><label class="toggle-row full"><span><b>Cliente bloqueado</b><small>Impede novos agendamentos online.</small></span><input id="mCustomerBlocked" type="checkbox" ${item.is_blocked?'checked':''}></label></div><div class="modal-footer"><button type="button" class="secondary-btn" data-close-modal>Cancelar</button><button class="primary-btn">Salvar cliente</button></div></form>`);$('customerForm').onsubmit=async e=>{e.preventDefault();const payload={id:item.id||uid(),user_id:state.user.id,name:$('mCustomerName').value.trim(),phone:$('mCustomerPhone').value.trim(),email:$('mCustomerEmail').value.trim(),cpf:$('mCustomerCpf').value.trim(),notes:$('mCustomerNotes').value.trim(),is_blocked:$('mCustomerBlocked').checked,total_appointments:item.total_appointments||0,no_show_count:item.no_show_count||0};const {error}=await supabase.from('scheduling_customers').upsert(payload);if(error)return toast(error.message,'error');closeModal();await loadAll();renderAll();toast('Cliente salvo.');};}

function openAppointmentModal(item={}){openModal(item.id?'Editar agendamento':'Novo agendamento','AGENDA',`<form id="appointmentForm" class="form-stack"><div class="form-grid"><label class="field"><span>Cliente existente</span><select id="mAppointmentCustomer"><option value="">Cadastrar pelo nome abaixo</option>${state.customers.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.phone||'')}</option>`).join('')}</select></label><label class="field"><span>Nome avulso</span><input id="mAppointmentCustomerName" value="${esc(item.customer_name||'')}"></label><label class="field"><span>Serviço</span><select id="mAppointmentService" required>${state.services.filter(s=>s.is_active).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label class="field"><span>Profissional/recurso</span><select id="mAppointmentResource"><option value="">Sem recurso</option>${state.resources.filter(r=>r.is_active).map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></label><label class="field"><span>Início</span><input id="mAppointmentStart" type="datetime-local" required></label><label class="field"><span>Status</span><select id="mAppointmentStatus"><option value="pending">Pendente</option><option value="confirmed">Confirmado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option><option value="no_show">Não compareceu</option></select></label><label class="field"><span>Status do pagamento</span><select id="mAppointmentPaymentStatus"><option value="not_required">Sem cobrança</option><option value="pending">Pendente</option><option value="partial">Sinal pago</option><option value="paid">Pago</option><option value="refunded">Reembolsado</option></select></label><label class="field"><span>Total</span><input id="mAppointmentTotal" type="number" step="0.01" min="0" value="${item.total_amount||0}"></label><label class="field full"><span>Observações</span><textarea id="mAppointmentNotes" rows="3">${esc(item.notes||'')}</textarea></label></div><div class="modal-footer"><button type="button" class="secondary-btn" data-close-modal>Cancelar</button><button class="primary-btn">Salvar agendamento</button></div></form>`);
  $('mAppointmentCustomer').value=item.customer_id||'';$('mAppointmentService').value=item.service_id||state.services[0]?.id||'';$('mAppointmentResource').value=item.resource_id||'';$('mAppointmentStatus').value=item.status||'confirmed';$('mAppointmentPaymentStatus').value=item.payment_status||'not_required';$('mAppointmentStart').value=item.starts_at?new Date(new Date(item.starts_at).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  $('appointmentForm').onsubmit=async e=>{e.preventDefault();const service=state.services.find(s=>s.id===$('mAppointmentService').value);const start=new Date($('mAppointmentStart').value);const payload={id:item.id||uid(),user_id:state.user.id,customer_id:$('mAppointmentCustomer').value||null,customer_name:$('mAppointmentCustomerName').value.trim(),service_id:$('mAppointmentService').value,resource_id:$('mAppointmentResource').value||null,starts_at:start.toISOString(),ends_at:new Date(start.getTime()+(service?.duration_minutes||60)*60000).toISOString(),status:$('mAppointmentStatus').value,payment_status:$('mAppointmentPaymentStatus').value,total_amount:Number($('mAppointmentTotal').value),notes:$('mAppointmentNotes').value.trim(),source:item.source||'admin'};const {error}=await supabase.from('scheduling_appointments').upsert(payload);if(error)return toast(error.message,'error');closeModal();await loadAll();renderAll();toast('Agendamento salvo.');};}

async function deleteRow(table,id){if(!confirm('Excluir este registro?'))return;const {error}=await supabase.from(table).delete().eq('id',id).eq('user_id',state.user.id);if(error)return toast(error.message,'error');await loadAll();renderAll();toast('Registro excluído.');}

function bindEvents(){
  bindNavigation(); $('saveAllButton').onclick=saveAll; $('newServiceButton').onclick=()=>openServiceModal(); $('newResourceButton').onclick=()=>openResourceModal(); $('addBlockButton').onclick=openBlockModal; $('newCustomerButton').onclick=()=>openCustomerModal(); $('newAppointmentButton').onclick=()=>openAppointmentModal();
  $('serviceSearch').oninput=renderServices; $('serviceStatusFilter').onchange=renderServices; $('customerSearch').oninput=renderCustomers; $('appointmentDate').onchange=renderAppointments; $('appointmentStatus').onchange=renderAppointments; $('appointmentResource').onchange=renderAppointments;
  $('copyMondayButton').onclick=()=>{const m=state.schedules.find(s=>s.weekday==='monday');state.schedules.forEach(s=>Object.assign(s,{is_open:m.is_open,start_time:m.start_time,end_time:m.end_time,break_start:m.break_start,break_end:m.break_end}));renderSchedule();toast('Horário de segunda copiado.');};
  $('logoInput').onchange=e=>{state.pendingLogo=e.target.files[0]||null;updateMediaPreview();renderPreview();}; $('coverInput').onchange=e=>{state.pendingCover=e.target.files[0]||null;updateMediaPreview();renderPreview();};
  $('publicSlug').oninput=e=>{e.target.value=slugify(e.target.value);renderPreview();}; qsa('input,select,textarea',document).forEach(el=>el.addEventListener('input',()=>{if(!el.closest('#modal'))renderPreview();}));
  qsa('[data-close-modal]').forEach(el=>el.onclick=closeModal); $('modal').addEventListener('click',e=>{if(e.target.matches('[data-close-modal]'))closeModal();});
  $('previewButton').onclick=()=>{$('previewDrawer').classList.remove('is-hidden');renderPreview();}; qsa('[data-close-preview]').forEach(el=>el.onclick=()=>$('previewDrawer').classList.add('is-hidden'));
  $('profileButton').onclick=()=>$('profileMenu').classList.toggle('is-hidden'); $('logoutButton').onclick=async()=>{await supabase.auth.signOut();location.href='./index.html';};
  $('copyPublicLink').onclick=async()=>{const link=`${location.origin}/agendar/${slugify($('publicSlug').value)}`;await navigator.clipboard.writeText(link);toast('Link copiado.');};
}

async function init(){try{if(!await requireAuth())return;await loadAll();bindEvents();renderAll();$('pageLoader').classList.add('is-hidden');$('app').classList.remove('is-hidden');}catch(err){console.error(err);toast(err.message||'Erro ao abrir editor.','error');}}
init();
