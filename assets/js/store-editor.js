console.info('[CLENA] editor com taxas e Mercado Pago seguro — 20260806-1048');
import { getSupabase } from './supabase-client.js';
import { initAppearance, collectAppearance, updateAppearancePreview } from './store-appearance.js';
import { initStoreMediaManager } from './store-media-manager.js';

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { sb:null,user:null,profile:null,store:null,categories:[],products:[],variations:[],deliveryFees:[],mercadoPagoConfig:null,selected:new Set(),pendingImages:{logo:null,banner:null,coverVideo:null,product:null},removeImages:{logo:false,banner:false,coverVideo:false,product:false},layout:'grid',dirty:false,currentSection:'overview',previewUrls:{logo:'',banner:'',coverVideo:''} };
const titles={
  overview:['LOJA','Visão geral','Acompanhe a configuração e acesse rapidamente cada área.'],
  products:['CATÁLOGO','Produtos','Gerencie fotos, preços, estoque, destaques e disponibilidade.'],
  categories:['ORGANIZAÇÃO','Categorias','Defina a ordem e a navegação exibida na loja pública.'],
  appearance:['IDENTIDADE','Aparência','A prévia compacta reproduz a estrutura real da loja publicada.'],
  media:['CONTEÚDO','Banners e galeria','Configure campanhas, posições, transições e mídias da vitrine.'],
  checkout:['VENDAS','Pedidos, pagamento e entrega','Defina como o cliente monta o pedido, escolhe o pagamento e seleciona a entrega.'],
  publish:['PUBLICAÇÃO','Publicação','Controle o endereço público e a disponibilidade da loja.']
};

function toast(message,type='success'){const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;$('toastHost').appendChild(el);setTimeout(()=>el.remove(),3500)}
function setSaving(mode='saved'){const el=$('saveIndicator');el.className=`save-indicator ${mode==='saving'?'saving':mode==='error'?'error':''}`;el.querySelector('b').textContent=mode==='saving'?'Salvando...':mode==='error'?'Erro ao salvar':'Salvo'}
function markDirty(){state.dirty=true;setSaving('saving')}
function money(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0))}
function parseMoney(v){return Number(String(v||'').replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,''))||0}
function slugify(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function randomId(){return crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`}
function ext(file){return (file.name.split('.').pop()||'webp').toLowerCase().replace(/[^a-z0-9]/g,'')}
function validateImage(file){if(!file)return false;if(!['image/png','image/jpeg','image/webp'].includes(file.type)){toast('Use uma imagem PNG, JPG ou WebP.','error');return false}if(file.size>5*1024*1024){toast('A imagem deve ter no máximo 5 MB.','error');return false}return true}
function validateVideo(file){if(!file)return false;if(!['video/mp4','video/webm'].includes(file.type)){toast('Use um vídeo MP4 ou WebM.','error');return false}if(file.size>50*1024*1024){toast('O vídeo deve ter no máximo 50 MB.','error');return false}return true}
function previewLocal(file,target,kind){const url=URL.createObjectURL(file);if(kind==='banner'){target.style.backgroundImage=`url('${url}')`;target.classList.add('has-image')}else{target.innerHTML=`<img src="${url}" alt="Prévia">`}}

async function requireSession(){state.sb=await getSupabase();const {data:{session},error}=await state.sb.auth.getSession();if(error||!session){location.href='./index.html';return false}state.user=session.user;return true}
async function loadData() {
  const uid = state.user.id;

  const [
    { data: profile, error: profileError },
    { data: store, error: storeError },
    { data: categories, error: catError },
    { data: products, error: prodError }
  ] = await Promise.all([
    state.sb
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle(),

    state.sb
      .from('stores')
      .select('*')
      .eq('owner_id', uid)
      .maybeSingle(),

    state.sb
      .from('store_categories')
      .select('*')
      .eq('owner_id', uid)
      .order('position'),

    state.sb
      .from('store_products')
      .select('*')
      .eq('owner_id', uid)
      .order('position')
      .order('created_at', { ascending: false })
  ]);

  if (profileError || storeError || catError || prodError) {
    throw profileError || storeError || catError || prodError;
  }

  state.profile = profile || {};
  state.store = store || await createInitialStore();
  state.categories = categories || [];
  state.products = products || [];

  const productIds = state.products.map((product) => product.id);

  state.variations = [];

  if (productIds.length) {
    const { data, error } = await state.sb
      .from('store_product_variations')
      .select('*')
      .in('product_id', productIds)
      .order('position');

    if (error) throw error;

    state.variations = data || [];
  }

  await reloadDeliveryFees(false);
}
async function createInitialStore(){const name=state.profile?.store_name||state.user.user_metadata?.store_name||'Minha loja';const {data,error}=await state.sb.from('stores').insert({owner_id:state.user.id,name,slug:`${slugify(name)||'minha-loja'}-${state.user.id.slice(0,6)}`}).select().single();if(error)throw error;return data}

function fillUI(){const s=state.store;$('headerStoreName').textContent=s.name||'Minha loja';$('headerEmail').textContent=state.user.email||'';$('storeName').value=s.name||'';$('storeDescription').value=s.description||'';$('descriptionCount').textContent=(s.description||'').length;$('storeWhatsapp').value=s.whatsapp||state.profile?.whatsapp||'';$('storeInstagram').value=s.instagram||'';$('primaryColor').value=s.primary_color||'#2563eb';$('primaryColorText').value=s.primary_color||'#2563eb';$('accentColor').value=s.accent_color||'#0f172a';$('accentColorText').value=s.accent_color||'#0f172a';state.layout=s.product_layout||'grid';$('checkoutMode').value=s.checkout_mode||'whatsapp';$('minimumOrder').value=s.minimum_order?Number(s.minimum_order).toLocaleString('pt-BR',{minimumFractionDigits:2}):'';$('estimatedTime').value=s.estimated_time||'';$('orderNote').value=s.order_note||'';$('paymentPix').checked=!!s.accepts_pix;$('paymentCard').checked=!!s.accepts_card;$('paymentCash').checked=!!s.accepts_cash;$('pixKey').value=s.pix_key||'';$('pixReceiver').value=s.pix_receiver||'';$('storeSlug').value=s.slug||'';$('storePublished').checked=!!s.is_published;
 setImagePreview('logo',s.logo_url);setImagePreview('banner',s.banner_url);$$('#productLayoutChoices .choice').forEach(x=>x.classList.toggle('active',x.dataset.value===state.layout));initAppearance({social_instagram:s.instagram||'',...(s.appearance_settings||{})},s.cover_type||'image');const a=s.appearance_settings||{};[['bannerDisplayMode','banner_display_mode','carousel'],['bannerAutoplayDelay','banner_autoplay_delay',5000],['bannerDefaultHeight','banner_default_height','medium'],['bannerTransition','banner_transition','slide'],['galleryLayout','gallery_layout','grid'],['galleryColumns','gallery_columns',3],['galleryRatio','gallery_ratio','square'],['galleryGap','gallery_gap','medium'],['galleryTitle','gallery_title',''],['gallerySubtitle','gallery_subtitle',''],['galleryPosition','gallery_position','after_products']].forEach(([id,key,def])=>{if($(id))$(id).value=a[key]??def});[['bannerAutoplay','banner_autoplay',true],['bannerLoop','banner_loop',true],['bannerArrows','banner_arrows',true],['bannerDots','banner_dots',true],['bannerPauseInteraction','banner_pause_interaction',true],['galleryLightbox','gallery_lightbox',true],['galleryAutoplay','gallery_autoplay',false],['galleryLoop','gallery_loop',true]].forEach(([id,key,def])=>{if($(id))$(id).checked=a[key]??def});setCoverVideoPreview(s.cover_video_url);renderAll();updateLivePreview()}
function setImagePreview(kind,url){const target=$(kind==='logo'?'logoPreview':'bannerPreview');if(!url){if(kind==='logo')target.innerHTML='<i class="ri-image-add-line"></i>';else{target.style.backgroundImage='';target.classList.remove('has-image')}return}if(kind==='logo')target.innerHTML=`<img src="${escapeHtml(url)}" alt="Logo">`;else{target.style.backgroundImage=`url('${url}')`;target.classList.add('has-image')}}
function setCoverVideoPreview(url){const target=$('coverVideoPreview');if(!target)return;if(!url){target.classList.remove('has-video');target.innerHTML='<i class="ri-video-upload-line"></i><strong>Nenhum vídeo selecionado</strong><small>MP4 ou WebM, até 50 MB. Sem áudio automático.</small>';return}target.classList.add('has-video');target.innerHTML=`<i class="ri-play-circle-fill"></i><strong>Vídeo configurado</strong><small>${escapeHtml(url.split('/').pop()||'Vídeo da capa')}</small>`}
function renderAll(){renderProducts();renderCategories();renderDeliveryFees();updateStats();populateCategorySelects();updatePublicationStatus();updateLivePreview()}
function updateStats(){const p=state.products.length,c=state.categories.length;$('statProducts').textContent=p;$('statCategories').textContent=c;$('navProductCount').textContent=p;$('statStatus').textContent=state.store.is_published?'Publicada':'Rascunho';const checks=[!!state.store.name,!!state.store.description,!!state.store.logo_url||!!state.pendingImages.logo,p>0,c>0,!!state.store.whatsapp,!!state.store.slug];const done=checks.filter(Boolean).length;const percent=Math.round(done/checks.length*100);$('setupPercent').textContent=`${percent}%`;$('progressRing').style.setProperty('--progress',`${percent*3.6}deg`);const items=[['Nome da loja','Identificação principal',checks[0]],['Descrição','Apresentação da marca',checks[1]],['Logo','Imagem da loja',checks[2]],['Produtos','Ao menos um produto',checks[3]],['WhatsApp','Canal de atendimento',checks[5]],['Endereço público','Link personalizado',checks[6]]];$('setupChecklist').innerHTML=items.map(([a,b,d])=>`<div class="check-item ${d?'done':''}"><i class="${d?'ri-check-line':'ri-more-line'}"></i><div><strong>${a}</strong><small>${b}</small></div></div>`).join('')}
function populateCategorySelects(){const options=state.categories.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');const currentFilter=$('productCategoryFilter').value;$('productCategoryFilter').innerHTML=`<option value="">Todas as categorias</option>${options}`;$('productCategoryFilter').value=currentFilter;$('productCategory').innerHTML=`<option value="">Sem categoria</option>${options}`}
function filteredProducts(){const term=$('productSearch').value.trim().toLowerCase(),cat=$('productCategoryFilter').value;return state.products.filter(p=>(!term||`${p.name} ${p.sku||''}`.toLowerCase().includes(term))&&(!cat||p.category_id===cat))}
function renderProducts(){const list=filteredProducts(),body=$('productTableBody');body.innerHTML=list.map(p=>{const cat=state.categories.find(c=>c.id===p.category_id);const sale=p.sale_price&&Number(p.sale_price)<Number(p.price);return `<tr><td><input type="checkbox" data-select-product="${p.id}" ${state.selected.has(p.id)?'checked':''}></td><td><div class="product-cell"><span class="product-thumb">${p.image_url?`<img src="${escapeHtml(p.image_url)}">`:'<i class="ri-image-line"></i>'}</span><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.sku||'Sem SKU')}${p.featured?' • Destaque':''}</small></div></div></td><td>${escapeHtml(cat?.name||'Sem categoria')}</td><td><strong>${sale?money(p.sale_price):money(p.price)}</strong>${sale?`<small style="display:block;color:#94a3b8;text-decoration:line-through">${money(p.price)}</small>`:''}</td><td>${p.stock_mode==='unlimited'?'Ilimitado':p.stock_mode==='out'?'Esgotado':Number(p.stock||0)}</td><td><span class="status-pill ${p.active?'':'off'}">${p.active?'Ativo':'Inativo'}</span></td><td><div class="row-actions"><button title="Editar" data-edit-product="${p.id}"><i class="ri-pencil-line"></i></button><button title="Duplicar" data-duplicate-product="${p.id}"><i class="ri-file-copy-line"></i></button><button title="Excluir" data-delete-product="${p.id}"><i class="ri-delete-bin-line"></i></button></div></td></tr>`}).join('');$('productsEmpty').classList.toggle('is-hidden',state.products.length>0);$('selectAllProducts').checked=list.length>0&&list.every(p=>state.selected.has(p.id));updateBulkBar()}
function updateBulkBar(){$('selectedCount').textContent=state.selected.size;$('bulkBar').classList.toggle('is-hidden',state.selected.size===0)}
function renderCategories(){$('categoryList').innerHTML=state.categories.length?state.categories.map((c,i)=>{const count=state.products.filter(p=>p.category_id===c.id).length;return `<div class="category-item"><span class="category-icon"><i class="${escapeHtml(c.icon||'ri-price-tag-3-line')}"></i></span><div class="category-copy"><strong>${escapeHtml(c.name)}</strong><small>${count} produto(s)${c.description?` • ${escapeHtml(c.description)}`:''}</small></div><div class="category-actions"><button data-category-up="${c.id}" ${i===0?'disabled':''}><i class="ri-arrow-up-line"></i></button><button data-category-down="${c.id}" ${i===state.categories.length-1?'disabled':''}><i class="ri-arrow-down-line"></i></button><button data-edit-category="${c.id}"><i class="ri-pencil-line"></i></button><button data-delete-category="${c.id}"><i class="ri-delete-bin-line"></i></button></div></div>`}).join(''):`<div class="empty-state"><span><i class="ri-folders-line"></i></span><h3>Nenhuma categoria</h3><p>Crie categorias para organizar seus produtos.</p></div>`}
function updatePublicationStatus(){const card=$('publicationStatusCard'),pub=$('storePublished').checked;card.classList.toggle('published',pub);card.querySelector('strong').textContent=pub?'Publicada':'Rascunho';card.querySelector('p').textContent=pub?'A loja estará disponível no endereço público após salvar.':'A loja ainda não está visível publicamente.'}
function getPreviewObjectUrl(kind,file){
 if(!file)return '';
 if(state.previewUrls[kind])URL.revokeObjectURL(state.previewUrls[kind]);
 state.previewUrls[kind]=URL.createObjectURL(file);
 return state.previewUrls[kind];
}
function updateLivePreview(){
 const primary=$('primaryColorText').value||'#2563eb',accent=$('accentColorText').value||'#0f172a';
 let coverPreviewUrl='';
 if(state.pendingImages.banner)coverPreviewUrl=state.previewUrls.banner||getPreviewObjectUrl('banner',state.pendingImages.banner);
 else if(state.store.banner_url&&!state.removeImages.banner)coverPreviewUrl=state.store.banner_url;
 let logoPreviewUrl='';
 if(state.pendingImages.logo)logoPreviewUrl=state.previewUrls.logo||getPreviewObjectUrl('logo',state.pendingImages.logo);
 else if(state.store.logo_url&&!state.removeImages.logo)logoPreviewUrl=state.store.logo_url;
 let coverVideoPreviewUrl='';
 if(state.pendingImages.coverVideo)coverVideoPreviewUrl=state.previewUrls.coverVideo||getPreviewObjectUrl('coverVideo',state.pendingImages.coverVideo);
 updateAppearancePreview({
  primaryColor:primary,accentColor:accent,
  storeName:$('storeName').value||'Minha loja',
  description:$('storeDescription').value||'Sua descrição aparecerá aqui',
  whatsapp:$('storeWhatsapp').value||'',instagram:$('storeInstagram').value||'',
  productLayout:state.layout,coverPreviewUrl,logoPreviewUrl,coverVideoPreviewUrl,
  coverVideoUrl:state.store.cover_video_url||'',
  categories:state.categories,
  products:state.products
 })
}

function navigate(section){
  state.currentSection=section;
  $$('.nav-item').forEach((item)=>{
    item.classList.toggle('active',item.dataset.section===section);
  });
  $$('.editor-section').forEach((item)=>{
    item.classList.toggle('active',item.dataset.editorSection===section);
  });

  const title=titles[section]||titles.overview;
  $('sectionEyebrow').textContent=title[0];
  $('sectionTitle').textContent=title[1];

  const description=$('sectionDescription');
  if(description)description.textContent=title[2]||'';

  $('sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
}
async function upload(file,folder){if(!file)return null;const path=`${state.user.id}/${folder}/${randomId()}.${ext(file)}`;const {error}=await state.sb.storage.from('store-media').upload(path,file,{cacheControl:'3600',upsert:false});if(error)throw error;return state.sb.storage.from('store-media').getPublicUrl(path).data.publicUrl}
async function removeStorageUrl(url){if(!url)return;const marker='/store-media/';const pos=url.indexOf(marker);if(pos<0)return;const path=decodeURIComponent(url.slice(pos+marker.length));await state.sb.storage.from('store-media').remove([path])}
function collectStore(){return {name:$('storeName').value.trim()||'Minha loja',description:$('storeDescription').value.trim()||null,whatsapp:$('storeWhatsapp').value.trim()||null,instagram:$('storeInstagram').value.trim()||null,primary_color:$('primaryColorText').value,accent_color:$('accentColorText').value,product_layout:state.layout,cover_type:collectAppearance().cover_type,appearance_settings:{...collectAppearance(),banner_display_mode:$('bannerDisplayMode')?.value||'carousel',banner_autoplay:$('bannerAutoplay')?.checked??true,banner_autoplay_delay:Number($('bannerAutoplayDelay')?.value||5000),banner_loop:$('bannerLoop')?.checked??true,banner_arrows:$('bannerArrows')?.checked??true,banner_dots:$('bannerDots')?.checked??true,banner_pause_interaction:$('bannerPauseInteraction')?.checked??true,banner_default_height:$('bannerDefaultHeight')?.value||'medium',banner_transition:$('bannerTransition')?.value||'slide',gallery_layout:$('galleryLayout')?.value||'grid',gallery_columns:Number($('galleryColumns')?.value||3),gallery_ratio:$('galleryRatio')?.value||'square',gallery_gap:$('galleryGap')?.value||'medium',gallery_title:$('galleryTitle')?.value.trim()||'',gallery_subtitle:$('gallerySubtitle')?.value.trim()||'',gallery_position:$('galleryPosition')?.value||'after_products',gallery_lightbox:$('galleryLightbox')?.checked??true,gallery_autoplay:$('galleryAutoplay')?.checked??false,gallery_loop:$('galleryLoop')?.checked??true},checkout_mode:$('checkoutMode').value,minimum_order:parseMoney($('minimumOrder').value),estimated_time:$('estimatedTime').value.trim()||null,order_note:$('orderNote').value.trim()||null,accepts_pix:$('paymentPix').checked,accepts_card:$('paymentCard').checked,accepts_cash:$('paymentCash').checked,pix_key:$('pixKey').value.trim()||null,pix_receiver:$('pixReceiver').value.trim()||null,slug:slugify($('storeSlug').value),is_published:$('storePublished').checked}}
async function saveStore(){setSaving('saving');try{const payload=collectStore();if(!payload.slug)throw new Error('Informe um endereço válido para a loja.');if(state.pendingImages.logo){if(state.store.logo_url)await removeStorageUrl(state.store.logo_url);payload.logo_url=await upload(state.pendingImages.logo,'logo')}else if(state.removeImages.logo){await removeStorageUrl(state.store.logo_url);payload.logo_url=null}if(state.pendingImages.banner){if(state.store.banner_url)await removeStorageUrl(state.store.banner_url);payload.banner_url=await upload(state.pendingImages.banner,'banner')}else if(state.removeImages.banner){await removeStorageUrl(state.store.banner_url);payload.banner_url=null}if(state.pendingImages.coverVideo){if(state.store.cover_video_url)await removeStorageUrl(state.store.cover_video_url);payload.cover_video_url=await upload(state.pendingImages.coverVideo,'cover-video')}else if(state.removeImages.coverVideo){await removeStorageUrl(state.store.cover_video_url);payload.cover_video_url=null}else{const external=$('coverVideoExternalUrl')?.value.trim();if(external)payload.cover_video_url=external}const {data,error}=await state.sb.from('stores').update(payload).eq('id',state.store.id).eq('owner_id',state.user.id).select().single();if(error)throw error;state.store=data;state.pendingImages.logo=null;state.pendingImages.banner=null;state.pendingImages.coverVideo=null;state.removeImages.logo=false;state.removeImages.banner=false;state.removeImages.coverVideo=false;state.dirty=false;$('headerStoreName').textContent=data.name;setImagePreview('logo',data.logo_url);setImagePreview('banner',data.banner_url);setCoverVideoPreview(data.cover_video_url);setSaving('saved');renderAll();updateLivePreview();toast('Alterações da loja salvas.')}catch(e){console.error(e);setSaving('error');toast(e.message||'Erro ao salvar a loja.','error')}}


/* ============================================================
   TAXAS DE ENTREGA
   ============================================================ */

function deliveryFeeBasePayload() {
  return {
    owner_id: state.user.id,
    store_id: state.store.id,
    name: $('deliveryFeeName').value.trim(),
    fee: parseMoney($('deliveryFeeValue').value),
    minimum_order: parseMoney($('deliveryFeeMinimumOrder').value),
    estimated_time:
      $('deliveryFeeEstimatedTime').value.trim() || null,
    active: $('deliveryFeeActive').checked,
    position: Math.max(
      0,
      Number($('deliveryFeePosition').value || 0)
    )
  };
}

function deliveryFeeExtendedPayload() {
  const payload = deliveryFeeBasePayload();

  /*
   * Estes campos são opcionais.
   * O código tenta salvá-los quando as colunas existem.
   * Caso o SQL tenha somente a estrutura básica,
   * o salvamento é repetido automaticamente sem eles.
   */
  if ($('deliveryFeeDescription')) {
    payload.description =
      $('deliveryFeeDescription').value.trim() || null;
  }

  if ($('deliveryFeeType')) {
    payload.delivery_type =
      $('deliveryFeeType').value || 'delivery';
  }

  return payload;
}

function isMissingDeliveryOptionalColumn(error) {
  const message = String(
    error?.message ||
    error?.details ||
    ''
  ).toLowerCase();

  return (
    message.includes('description') ||
    message.includes('delivery_type') ||
    message.includes('column') &&
      message.includes('does not exist') ||
    error?.code === '42703' ||
    error?.code === 'PGRST204'
  );
}

async function reloadDeliveryFees(render = true) {
  if (!state.store?.id) {
    state.deliveryFees = [];

    if (render) renderDeliveryFees();

    return;
  }

  const { data, error } = await state.sb
    .from('store_delivery_fees')
    .select('*')
    .eq('store_id', state.store.id)
    .eq('owner_id', state.user.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    /*
     * Mensagem amigável caso o SQL ainda não tenha sido executado.
     */
    if (
      error.code === '42P01' ||
      String(error.message || '')
        .toLowerCase()
        .includes('store_delivery_fees')
    ) {
      throw new Error(
        'A tabela store_delivery_fees ainda não existe. Execute primeiro o SQL das taxas de entrega.'
      );
    }

    throw error;
  }

  state.deliveryFees = data || [];

  if (render) renderDeliveryFees();
}

function deliveryFeeIcon(fee) {
  const type =
    fee.delivery_type ||
    fee.type ||
    'delivery';

  if (type === 'pickup') {
    return 'ri-store-2-line';
  }

  if (Number(fee.fee || 0) <= 0) {
    return 'ri-gift-line';
  }

  return 'ri-e-bike-2-line';
}

function renderDeliveryFees() {
  const list = $('deliveryFeeList');
  const empty = $('deliveryFeesEmpty');

  if (!list || !empty) return;

  const fees = [...state.deliveryFees].sort(
    (a, b) =>
      Number(a.position || 0) -
        Number(b.position || 0) ||
      String(a.name || '').localeCompare(
        String(b.name || ''),
        'pt-BR'
      )
  );

  const activeCount = fees.filter(
    (fee) => fee.active !== false
  ).length;

  const freeCount = fees.filter(
    (fee) => Number(fee.fee || 0) <= 0
  ).length;

  if ($('deliveryFeeCount')) {
    $('deliveryFeeCount').textContent = fees.length;
  }

  if ($('activeDeliveryFeeCount')) {
    $('activeDeliveryFeeCount').textContent =
      activeCount;
  }

  if ($('freeDeliveryFeeCount')) {
    $('freeDeliveryFeeCount').textContent =
      freeCount;
  }

  empty.classList.toggle(
    'is-hidden',
    fees.length > 0
  );

  list.innerHTML = fees.map((fee, index) => {
    const isPickup =
      (fee.delivery_type || fee.type) === 'pickup';

    const feeText =
      Number(fee.fee || 0) > 0
        ? money(fee.fee)
        : isPickup
          ? 'Retirada grátis'
          : 'Grátis';

    const minimumText =
      Number(fee.minimum_order || 0) > 0
        ? `Pedido mínimo: ${money(fee.minimum_order)}`
        : 'Sem mínimo específico';

    const estimatedText =
      fee.estimated_time
        ? escapeHtml(fee.estimated_time)
        : 'Prazo geral da loja';

    const description =
      fee.description
        ? `<p>${escapeHtml(fee.description)}</p>`
        : '';

    return `
      <article
        class="delivery-fee-item ${fee.active === false ? 'is-inactive' : ''}"
        data-delivery-fee="${escapeHtml(fee.id)}"
      >
        <span class="delivery-fee-icon">
          <i class="${deliveryFeeIcon(fee)}"></i>
        </span>

        <div class="delivery-fee-copy">
          <div class="delivery-fee-title-row">
            <strong>${escapeHtml(fee.name)}</strong>

            <span class="status-pill ${fee.active === false ? 'off' : ''}">
              ${fee.active === false ? 'Inativa' : 'Ativa'}
            </span>
          </div>

          <div class="delivery-fee-meta">
            <span>
              <i class="ri-money-dollar-circle-line"></i>
              ${escapeHtml(feeText)}
            </span>

            <span>
              <i class="ri-shopping-basket-line"></i>
              ${escapeHtml(minimumText)}
            </span>

            <span>
              <i class="ri-time-line"></i>
              ${estimatedText}
            </span>
          </div>

          ${description}
        </div>

        <div class="delivery-fee-actions">
          <button
            type="button"
            title="Mover para cima"
            data-delivery-fee-up="${escapeHtml(fee.id)}"
            ${index === 0 ? 'disabled' : ''}
          >
            <i class="ri-arrow-up-line"></i>
          </button>

          <button
            type="button"
            title="Mover para baixo"
            data-delivery-fee-down="${escapeHtml(fee.id)}"
            ${index === fees.length - 1 ? 'disabled' : ''}
          >
            <i class="ri-arrow-down-line"></i>
          </button>

          <button
            type="button"
            title="${fee.active === false ? 'Ativar' : 'Desativar'}"
            data-toggle-delivery-fee="${escapeHtml(fee.id)}"
          >
            <i class="${fee.active === false ? 'ri-eye-line' : 'ri-eye-off-line'}"></i>
          </button>

          <button
            type="button"
            title="Editar"
            data-edit-delivery-fee="${escapeHtml(fee.id)}"
          >
            <i class="ri-pencil-line"></i>
          </button>

          <button
            type="button"
            title="Excluir"
            data-delete-delivery-fee="${escapeHtml(fee.id)}"
          >
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </article>
    `;
  }).join('');
}

function openDeliveryFee(id = null) {
  const fee = id
    ? state.deliveryFees.find(
        (item) => item.id === id
      )
    : null;

  const modal = $('deliveryFeeModal');
  const form = $('deliveryFeeForm');

  if (!modal || !form) return;

  form.reset();

  $('deliveryFeeId').value = fee?.id || '';

  $('deliveryFeeModalTitle').textContent =
    fee
      ? 'Editar taxa de entrega'
      : 'Nova taxa de entrega';

  $('deliveryFeeName').value =
    fee?.name || '';

  $('deliveryFeeValue').value =
    Number(fee?.fee || 0) > 0
      ? Number(fee.fee).toLocaleString(
          'pt-BR',
          { minimumFractionDigits: 2 }
        )
      : '';

  $('deliveryFeeMinimumOrder').value =
    Number(fee?.minimum_order || 0) > 0
      ? Number(fee.minimum_order).toLocaleString(
          'pt-BR',
          { minimumFractionDigits: 2 }
        )
      : '';

  $('deliveryFeeEstimatedTime').value =
    fee?.estimated_time || '';

  if ($('deliveryFeeDescription')) {
    $('deliveryFeeDescription').value =
      fee?.description || '';
  }

  if ($('deliveryFeeType')) {
    $('deliveryFeeType').value =
      fee?.delivery_type ||
      fee?.type ||
      'delivery';
  }

  $('deliveryFeePosition').value =
    fee?.position ??
    state.deliveryFees.length;

  $('deliveryFeeActive').checked =
    fee ? fee.active !== false : true;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  requestAnimationFrame(() => {
    $('deliveryFeeName')?.focus();
  });
}

function closeDeliveryFee() {
  const modal = $('deliveryFeeModal');

  if (!modal) return;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');

  $('deliveryFeeForm')?.reset();
  $('deliveryFeeId').value = '';
}

async function executeDeliveryFeeSave(
  id,
  payload
) {
  if (id) {
    return state.sb
      .from('store_delivery_fees')
      .update(payload)
      .eq('id', id)
      .eq('store_id', state.store.id)
      .eq('owner_id', state.user.id)
      .select()
      .single();
  }

  return state.sb
    .from('store_delivery_fees')
    .insert(payload)
    .select()
    .single();
}

async function saveDeliveryFee() {
  const name =
    $('deliveryFeeName').value.trim();

  if (!name) {
    toast(
      'Informe o bairro, região ou modalidade.',
      'error'
    );

    $('deliveryFeeName').focus();
    return;
  }

  const fee =
    parseMoney($('deliveryFeeValue').value);

  const minimumOrder =
    parseMoney(
      $('deliveryFeeMinimumOrder').value
    );

  if (fee < 0) {
    toast(
      'A taxa de entrega não pode ser negativa.',
      'error'
    );
    return;
  }

  if (minimumOrder < 0) {
    toast(
      'O pedido mínimo não pode ser negativo.',
      'error'
    );
    return;
  }

  const id = $('deliveryFeeId').value;
  const saveButton = $('saveDeliveryFeeBtn');

  saveButton.disabled = true;
  saveButton.innerHTML =
    '<i class="ri-loader-4-line ri-spin"></i> Salvando...';

  setSaving('saving');

  try {
    let payload = deliveryFeeExtendedPayload();

    let { data, error } =
      await executeDeliveryFeeSave(
        id,
        payload
      );

    /*
     * Compatibilidade com o primeiro SQL, que não possuía
     * description e delivery_type.
     */
    if (
      error &&
      isMissingDeliveryOptionalColumn(error)
    ) {
      payload = deliveryFeeBasePayload();

      ({ data, error } =
        await executeDeliveryFeeSave(
          id,
          payload
        ));
    }

    if (error) {
      if (error.code === '23505') {
        throw new Error(
          'Já existe uma taxa com esse nome nesta loja.'
        );
      }

      throw error;
    }

    await reloadDeliveryFees();

    closeDeliveryFee();
    setSaving('saved');

    toast(
      id
        ? 'Taxa de entrega atualizada.'
        : 'Taxa de entrega cadastrada.'
    );

    return data;
  } catch (error) {
    console.error(
      'Erro ao salvar taxa de entrega:',
      error
    );

    setSaving('error');

    toast(
      error.message ||
        'Não foi possível salvar a taxa de entrega.',
      'error'
    );
  } finally {
    saveButton.disabled = false;
    saveButton.innerHTML =
      '<i class="ri-save-line"></i> Salvar taxa';
  }
}

async function deleteDeliveryFee(id) {
  const fee = state.deliveryFees.find(
    (item) => item.id === id
  );

  if (!fee) return;

  const confirmed = confirm(
    `Excluir a taxa "${fee.name}"?`
  );

  if (!confirmed) return;

  try {
    const { error } = await state.sb
      .from('store_delivery_fees')
      .delete()
      .eq('id', id)
      .eq('store_id', state.store.id)
      .eq('owner_id', state.user.id);

    if (error) throw error;

    await reloadDeliveryFees();

    toast('Taxa de entrega excluída.');
  } catch (error) {
    console.error(error);

    toast(
      error.message ||
        'Não foi possível excluir a taxa.',
      'error'
    );
  }
}

async function toggleDeliveryFee(id) {
  const fee = state.deliveryFees.find(
    (item) => item.id === id
  );

  if (!fee) return;

  try {
    const { error } = await state.sb
      .from('store_delivery_fees')
      .update({
        active: fee.active === false
      })
      .eq('id', id)
      .eq('store_id', state.store.id)
      .eq('owner_id', state.user.id);

    if (error) throw error;

    await reloadDeliveryFees();

    toast(
      fee.active === false
        ? 'Taxa ativada.'
        : 'Taxa desativada.'
    );
  } catch (error) {
    console.error(error);

    toast(
      error.message ||
        'Não foi possível alterar a taxa.',
      'error'
    );
  }
}

async function moveDeliveryFee(
  id,
  direction
) {
  const ordered = [...state.deliveryFees].sort(
    (a, b) =>
      Number(a.position || 0) -
      Number(b.position || 0)
  );

  const currentIndex = ordered.findIndex(
    (item) => item.id === id
  );

  const targetIndex =
    currentIndex + direction;

  if (
    currentIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= ordered.length
  ) {
    return;
  }

  [
    ordered[currentIndex],
    ordered[targetIndex]
  ] = [
    ordered[targetIndex],
    ordered[currentIndex]
  ];

  try {
    const updates = ordered.map(
      (item, position) =>
        state.sb
          .from('store_delivery_fees')
          .update({ position })
          .eq('id', item.id)
          .eq('store_id', state.store.id)
          .eq('owner_id', state.user.id)
    );

    const results = await Promise.all(updates);

    const failed = results.find(
      (result) => result.error
    );

    if (failed?.error) {
      throw failed.error;
    }

    await reloadDeliveryFees();
  } catch (error) {
    console.error(error);

    toast(
      error.message ||
        'Não foi possível reordenar as taxas.',
      'error'
    );
  }
}

function bindDeliveryFees() {
  const newButton =
    $('newDeliveryFeeBtn');

  if (newButton) {
    newButton.onclick =
      () => openDeliveryFee();
  }

  $$('[data-new-delivery-fee]').forEach(
    (button) => {
      button.onclick =
        () => openDeliveryFee();
    }
  );

  $$('[data-close-delivery-fee]').forEach(
    (button) => {
      button.onclick =
        closeDeliveryFee;
    }
  );

  const saveButton =
    $('saveDeliveryFeeBtn');

  if (saveButton) {
    saveButton.onclick =
      saveDeliveryFee;
  }

  const form = $('deliveryFeeForm');

  if (form) {
    form.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        saveDeliveryFee();
      }
    );
  }

  const list = $('deliveryFeeList');

  if (list) {
    list.addEventListener(
      'click',
      (event) => {
        const edit =
          event.target.closest(
            '[data-edit-delivery-fee]'
          );

        const remove =
          event.target.closest(
            '[data-delete-delivery-fee]'
          );

        const toggle =
          event.target.closest(
            '[data-toggle-delivery-fee]'
          );

        const up =
          event.target.closest(
            '[data-delivery-fee-up]'
          );

        const down =
          event.target.closest(
            '[data-delivery-fee-down]'
          );

        if (edit) {
          openDeliveryFee(
            edit.dataset.editDeliveryFee
          );
          return;
        }

        if (remove) {
          deleteDeliveryFee(
            remove.dataset.deleteDeliveryFee
          );
          return;
        }

        if (toggle) {
          toggleDeliveryFee(
            toggle.dataset.toggleDeliveryFee
          );
          return;
        }

        if (up) {
          moveDeliveryFee(
            up.dataset.deliveryFeeUp,
            -1
          );
          return;
        }

        if (down) {
          moveDeliveryFee(
            down.dataset.deliveryFeeDown,
            1
          );
        }
      }
    );
  }

  const typeSelect =
    $('deliveryFeeType');

  if (typeSelect) {
    typeSelect.addEventListener(
      'change',
      () => {
        if (
          typeSelect.value === 'pickup' &&
          !$('deliveryFeeValue').value
        ) {
          $('deliveryFeeValue').value =
            '0,00';
        }
      }
    );
  }

  $('deliveryFeeModal')?.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        closeDeliveryFee();
      }
    }
  );
}


/* ============================================================
   MERCADO PAGO — CONFIGURAÇÃO SEGURA VIA EDGE FUNCTION
   ============================================================ */
const MERCADO_PAGO_FUNCTION = 'mercado-pago-config';

function mercadoPagoFormatDate(value) {
  if (!value) return 'Nunca';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function mercadoPagoEnvironmentLabel(value) {
  return value === 'production' ? 'Produção' : 'Teste';
}

function setMercadoPagoBusy(busy, button = null, text = '') {
  const panel = $('mercadoPagoPanel');
  panel?.classList.toggle('is-loading', busy);

  if (!button) return;
  if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
  button.disabled = busy;
  button.innerHTML = busy
    ? `<i class="ri-loader-4-line ri-spin"></i>${escapeHtml(text || 'Processando...')}`
    : button.dataset.originalHtml;
}

function mercadoPagoFunctionError(error, fallback) {
  const context = error?.context;
  if (context && typeof context.json === 'function') {
    return context.json().then((body) => new Error(body?.error || body?.message || fallback));
  }
  return Promise.resolve(new Error(error?.message || fallback));
}

async function invokeMercadoPago(action, payload = {}) {
  const { data, error } = await state.sb.functions.invoke(MERCADO_PAGO_FUNCTION, {
    body: {
      action,
      store_id: state.store.id,
      ...payload
    }
  });

  if (error) throw await mercadoPagoFunctionError(error, 'Falha ao comunicar com a integração Mercado Pago.');
  if (!data?.ok) throw new Error(data?.error || 'A operação do Mercado Pago não foi concluída.');
  return data;
}

function collectMercadoPagoForm({ includeSecrets = true } = {}) {
  const payload = {
    enabled: !!$('mercadoPagoEnabled')?.checked,
    environment: $('mercadoPagoEnvironment')?.value || 'test',
    checkout_mode: $('mercadoPagoCheckoutMode')?.value || 'checkout_pro',
    public_key: $('mercadoPagoPublicKey')?.value.trim() || null,
    statement_descriptor: $('mercadoPagoStatementDescriptor')?.value.trim().toUpperCase() || null,
    max_installments: Math.max(1, Math.min(24, Number($('mercadoPagoMaxInstallments')?.value || 12))),
    notification_url: $('mercadoPagoNotificationUrl')?.value.trim() || null,
    success_url: $('mercadoPagoSuccessUrl')?.value.trim() || null,
    pending_url: $('mercadoPagoPendingUrl')?.value.trim() || null,
    failure_url: $('mercadoPagoFailureUrl')?.value.trim() || null,
    auto_return: !!$('mercadoPagoAutoReturn')?.checked,
    binary_mode: !!$('mercadoPagoBinaryMode')?.checked
  };

  if (includeSecrets) {
    const accessToken = $('mercadoPagoAccessToken')?.value.trim();
    const webhookSecret = $('mercadoPagoWebhookSecret')?.value.trim();
    if (accessToken) payload.access_token = accessToken;
    if (webhookSecret) payload.webhook_secret = webhookSecret;
  }
  return payload;
}

function validateOptionalHttpsUrl(value, label) {
  if (!value) return;
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} deve ser uma URL válida.`); }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error(`${label} deve utilizar HTTPS.`);
  }
}

function validateMercadoPagoForm(payload, { requireToken = false } = {}) {
  if (!['test', 'production'].includes(payload.environment)) throw new Error('Selecione um ambiente válido.');
  if (!['checkout_pro', 'orders'].includes(payload.checkout_mode)) throw new Error('Selecione um modelo de checkout válido.');
  if (requireToken && !payload.access_token && !state.mercadoPagoConfig?.has_access_token) {
    throw new Error('Informe o Access Token do Mercado Pago.');
  }
  if (payload.statement_descriptor && payload.statement_descriptor.length > 22) {
    throw new Error('A descrição na fatura deve ter no máximo 22 caracteres.');
  }
  validateOptionalHttpsUrl(payload.notification_url, 'A URL de notificação');
  validateOptionalHttpsUrl(payload.success_url, 'A URL de retorno aprovado');
  validateOptionalHttpsUrl(payload.pending_url, 'A URL de retorno pendente');
  validateOptionalHttpsUrl(payload.failure_url, 'A URL de retorno com falha');
}

function renderMercadoPagoConfig(config = {}) {
  state.mercadoPagoConfig = config;
  const setValue = (id, value = '') => { if ($(id)) $(id).value = value ?? ''; };
  const setChecked = (id, value = false) => { if ($(id)) $(id).checked = !!value; };

  setChecked('mercadoPagoEnabled', config.enabled);
  setValue('mercadoPagoEnvironment', config.environment || 'test');
  setValue('mercadoPagoCheckoutMode', config.checkout_mode || 'checkout_pro');
  setValue('mercadoPagoPublicKey', config.public_key || '');
  setValue('mercadoPagoStatementDescriptor', config.statement_descriptor || '');
  setValue('mercadoPagoMaxInstallments', String(config.max_installments || 12));
  setValue('mercadoPagoNotificationUrl', config.notification_url || '');
  setValue('mercadoPagoSuccessUrl', config.success_url || '');
  setValue('mercadoPagoPendingUrl', config.pending_url || '');
  setValue('mercadoPagoFailureUrl', config.failure_url || '');
  setChecked('mercadoPagoAutoReturn', config.auto_return !== false);
  setChecked('mercadoPagoBinaryMode', config.binary_mode);
  setValue('mercadoPagoAccessToken', '');
  setValue('mercadoPagoWebhookSecret', '');

  const connected = !!config.has_access_token;
  const status = $('mercadoPagoConnectionStatus');
  if (status) {
    status.className = `mercado-pago-connection-status ${connected ? 'is-connected' : 'is-disconnected'}`;
    status.innerHTML = connected
      ? '<i class="ri-link-m"></i><b>Credencial salva</b>'
      : '<i class="ri-link-unlink-m"></i><b>Não conectado</b>';
  }

  $('mercadoPagoStatusTitle').textContent = connected
    ? (config.enabled ? 'Mercado Pago ativo' : 'Credencial salva, integração desativada')
    : 'Aguardando configuração';
  $('mercadoPagoStatusMessage').textContent = connected
    ? `Token ${config.masked_access_token || 'protegido'} armazenado com criptografia. Use “Testar conexão” para validar novamente.`
    : 'Informe as credenciais de teste e use “Testar conexão”.';
  $('mercadoPagoStatusEnvironment').textContent = mercadoPagoEnvironmentLabel(config.environment);
  $('mercadoPagoStatusToken').textContent = connected ? (config.masked_access_token || 'Sim') : 'Não';
  $('mercadoPagoStatusLastTest').textContent = mercadoPagoFormatDate(config.last_tested_at);
  $('mercadoPagoStatusResult').textContent = config.last_test_status === 'success'
    ? 'Conexão válida'
    : config.last_test_status === 'error'
      ? 'Falhou'
      : 'Não testado';
  $('mercadoPagoTokenHelp').textContent = connected
    ? `Existe um token salvo (${config.masked_access_token || 'protegido'}). Deixe vazio para mantê-lo.`
    : 'O token privado será enviado somente à Edge Function.';
  $('mercadoPagoWebhookHelp').textContent = config.has_webhook_secret
    ? 'Existe uma chave secreta salva. Deixe vazio para mantê-la.'
    : 'Também é criptografada e nunca retorna ao navegador.';
  $('disconnectMercadoPagoBtn')?.classList.toggle('is-hidden', !connected);
}

async function loadMercadoPagoConfig() {
  if (!$('mercadoPagoPanel')) return;
  try {
    const result = await invokeMercadoPago('get_config');
    renderMercadoPagoConfig(result.config || {});
  } catch (error) {
    console.error('Erro ao carregar Mercado Pago:', error);
    renderMercadoPagoConfig({});
    $('mercadoPagoStatusMessage').textContent = error.message || 'Não foi possível carregar a integração.';
  }
}

async function saveMercadoPagoConfig() {
  const button = $('saveMercadoPagoBtn');
  const payload = collectMercadoPagoForm();
  try {
    validateMercadoPagoForm(payload, { requireToken: true });
    setMercadoPagoBusy(true, button, 'Salvando...');
    const result = await invokeMercadoPago('save_config', { config: payload });
    renderMercadoPagoConfig(result.config || {});
    toast('Integração Mercado Pago salva com segurança.');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Erro ao salvar Mercado Pago.', 'error');
  } finally {
    setMercadoPagoBusy(false, button);
  }
}

async function testMercadoPagoConnection() {
  const button = $('testMercadoPagoBtn');
  const payload = collectMercadoPagoForm();
  try {
    validateMercadoPagoForm(payload, { requireToken: true });
    setMercadoPagoBusy(true, button, 'Testando...');
    const result = await invokeMercadoPago('test_connection', {
      access_token: payload.access_token || null,
      environment: payload.environment
    });
    await loadMercadoPagoConfig();
    $('mercadoPagoStatusTitle').textContent = 'Conexão validada';
    $('mercadoPagoStatusMessage').textContent = `A API respondeu corretamente. ${result.payment_methods_count ?? 0} meio(s) de pagamento identificado(s).`;
    toast('Conexão com Mercado Pago validada.');
  } catch (error) {
    console.error(error);
    $('mercadoPagoStatusTitle').textContent = 'Falha na conexão';
    $('mercadoPagoStatusMessage').textContent = error.message || 'Credencial recusada pela API.';
    toast(error.message || 'Falha ao testar Mercado Pago.', 'error');
  } finally {
    setMercadoPagoBusy(false, button);
  }
}

async function disconnectMercadoPago() {
  if (!confirm('Remover as credenciais do Mercado Pago desta loja?')) return;
  const button = $('disconnectMercadoPagoBtn');
  try {
    setMercadoPagoBusy(true, button, 'Desconectando...');
    await invokeMercadoPago('disconnect');
    renderMercadoPagoConfig({});
    toast('Mercado Pago desconectado da loja.');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Não foi possível desconectar.', 'error');
  } finally {
    setMercadoPagoBusy(false, button);
  }
}

function bindSecretVisibility(buttonId, inputId) {
  const button = $(buttonId), input = $(inputId);
  if (!button || !input) return;
  button.onclick = () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.innerHTML = `<i class="${show ? 'ri-eye-off-line' : 'ri-eye-line'}"></i>`;
  };
}

function bindMercadoPago() {
  if (!$('mercadoPagoPanel')) return;
  $('saveMercadoPagoBtn').onclick = saveMercadoPagoConfig;
  $('testMercadoPagoBtn').onclick = testMercadoPagoConnection;
  $('disconnectMercadoPagoBtn').onclick = disconnectMercadoPago;
  bindSecretVisibility('toggleMercadoPagoTokenBtn', 'mercadoPagoAccessToken');
  bindSecretVisibility('toggleMercadoPagoWebhookBtn', 'mercadoPagoWebhookSecret');

  ['mercadoPagoEnabled','mercadoPagoEnvironment','mercadoPagoCheckoutMode','mercadoPagoPublicKey','mercadoPagoStatementDescriptor','mercadoPagoMaxInstallments','mercadoPagoNotificationUrl','mercadoPagoSuccessUrl','mercadoPagoPendingUrl','mercadoPagoFailureUrl','mercadoPagoAutoReturn','mercadoPagoBinaryMode']
    .forEach((id) => $(id)?.addEventListener('input', markDirty));
}

function openProduct(id=null,duplicate=false){const p=id?state.products.find(x=>x.id===id):null;$('productForm').reset();$('productId').value=duplicate?'':p?.id||'';$('productModalTitle').textContent=duplicate?'Duplicar produto':p?'Editar produto':'Novo produto';$('productName').value=p?(duplicate?`${p.name} - cópia`:p.name):'';$('productDescription').value=p?.description||'';$('productCategory').value=p?.category_id||'';$('productSku').value=duplicate?'':p?.sku||'';$('productPrice').value=p?.price?Number(p.price).toLocaleString('pt-BR',{minimumFractionDigits:2}):'';$('productSalePrice').value=p?.sale_price?Number(p.sale_price).toLocaleString('pt-BR',{minimumFractionDigits:2}):'';$('productStock').value=p?.stock??'';$('productStockMode').value=p?.stock_mode||'unlimited';$('productExternalUrl').value=p?.external_url||'';$('productActive').checked=p?p.active:true;$('productFeatured').checked=!!p?.featured;state.pendingImages.product=null;state.removeImages.product=false;if(p?.image_url){$('productImagePreview').innerHTML=`<img src="${p.image_url}">`}else $('productImagePreview').innerHTML='<i class="ri-image-add-line"></i><span>Foto do produto</span>';const vars=p?state.variations.filter(v=>v.product_id===p.id):[];renderVariations(duplicate?vars.map(v=>({...v,id:null})):vars);$('productModal').classList.add('open');$('productModal').setAttribute('aria-hidden','false')}
function closeProduct(){$('productModal').classList.remove('open');$('productModal').setAttribute('aria-hidden','true')}
function renderVariations(vars=[]){$('variationList').innerHTML=vars.map(v=>variationRow(v.name,v.price_adjustment)).join('')}
function variationRow(name='',price=''){return `<div class="variation-row"><input data-var-name maxlength="80" placeholder="Ex.: Tamanho G" value="${escapeHtml(name)}"><input data-var-price inputmode="decimal" placeholder="Adicional R$" value="${price?Number(price).toLocaleString('pt-BR',{minimumFractionDigits:2}):''}"><button type="button" data-remove-variation><i class="ri-delete-bin-line"></i></button></div>`}
async function saveProduct(){const name=$('productName').value.trim(),price=parseMoney($('productPrice').value);if(!name){toast('Informe o nome do produto.','error');return}if(price<0){toast('Informe um preço válido.','error');return}setSaving('saving');try{const id=$('productId').value;const old=id?state.products.find(p=>p.id===id):null;const payload={owner_id:state.user.id,store_id:state.store.id,name,description:$('productDescription').value.trim()||null,category_id:$('productCategory').value||null,sku:$('productSku').value.trim()||null,price,sale_price:$('productSalePrice').value?parseMoney($('productSalePrice').value):null,stock:Number($('productStock').value||0),stock_mode:$('productStockMode').value,external_url:$('productExternalUrl').value.trim()||null,active:$('productActive').checked,featured:$('productFeatured').checked};if(state.pendingImages.product){if(old?.image_url)await removeStorageUrl(old.image_url);payload.image_url=await upload(state.pendingImages.product,'products')}else if(state.removeImages.product){await removeStorageUrl(old?.image_url);payload.image_url=null}let saved,error;if(id)({data:saved,error}=await state.sb.from('store_products').update(payload).eq('id',id).eq('owner_id',state.user.id).select().single());else({data:saved,error}=await state.sb.from('store_products').insert({...payload,position:state.products.length}).select().single());if(error)throw error;await state.sb.from('store_product_variations').delete().eq('product_id',saved.id);const vars=$$('#variationList .variation-row').map((r,i)=>({owner_id:state.user.id,product_id:saved.id,name:r.querySelector('[data-var-name]').value.trim(),price_adjustment:parseMoney(r.querySelector('[data-var-price]').value),position:i})).filter(v=>v.name);if(vars.length){const {error:ve}=await state.sb.from('store_product_variations').insert(vars);if(ve)throw ve}await reloadProducts();closeProduct();setSaving('saved');toast(id?'Produto atualizado.':'Produto cadastrado.')}catch(e){console.error(e);setSaving('error');toast(e.message||'Erro ao salvar produto.','error')}}
async function reloadProducts(){const {data,error}=await state.sb.from('store_products').select('*').eq('owner_id',state.user.id).order('position').order('created_at',{ascending:false});if(error)throw error;state.products=data||[];const ids=state.products.map(p=>p.id);state.variations=[];if(ids.length){const {data:v,error:ve}=await state.sb.from('store_product_variations').select('*').in('product_id',ids).order('position');if(ve)throw ve;state.variations=v||[]}renderAll()}
async function deleteProducts(ids){if(!ids.length||!confirm(`Excluir ${ids.length} produto(s)? Esta ação não pode ser desfeita.`))return;try{const images=state.products.filter(p=>ids.includes(p.id)).map(p=>p.image_url).filter(Boolean);const {error}=await state.sb.from('store_products').delete().in('id',ids).eq('owner_id',state.user.id);if(error)throw error;for(const url of images)await removeStorageUrl(url);state.selected.clear();await reloadProducts();toast('Produto(s) excluído(s).')}catch(e){toast(e.message,'error')}}
async function bulkActive(active){const ids=[...state.selected];if(!ids.length)return;const {error}=await state.sb.from('store_products').update({active}).in('id',ids).eq('owner_id',state.user.id);if(error)return toast(error.message,'error');state.selected.clear();await reloadProducts();toast(active?'Produtos ativados.':'Produtos desativados.')}

function openCategory(id=null){const c=id?state.categories.find(x=>x.id===id):null;$('categoryForm').reset();$('categoryId').value=c?.id||'';$('categoryModalTitle').textContent=c?'Editar categoria':'Nova categoria';$('categoryName').value=c?.name||'';$('categoryDescription').value=c?.description||'';$('categoryIcon').value=c?.icon||'ri-price-tag-3-line';$('categoryModal').classList.add('open')}
function closeCategory(){$('categoryModal').classList.remove('open')}
async function saveCategory(){const name=$('categoryName').value.trim();if(!name)return toast('Informe o nome da categoria.','error');try{const id=$('categoryId').value,payload={owner_id:state.user.id,store_id:state.store.id,name,description:$('categoryDescription').value.trim()||null,icon:$('categoryIcon').value};let error;if(id)({error}=await state.sb.from('store_categories').update(payload).eq('id',id).eq('owner_id',state.user.id));else({error}=await state.sb.from('store_categories').insert({...payload,position:state.categories.length}));if(error)throw error;await reloadCategories();closeCategory();toast('Categoria salva.')}catch(e){toast(e.message,'error')}}
async function reloadCategories(){const {data,error}=await state.sb.from('store_categories').select('*').eq('owner_id',state.user.id).order('position');if(error)throw error;state.categories=data||[];renderAll()}
async function moveCategory(id,dir){const i=state.categories.findIndex(c=>c.id===id),j=i+dir;if(i<0||j<0||j>=state.categories.length)return;[state.categories[i],state.categories[j]]=[state.categories[j],state.categories[i]];await Promise.all(state.categories.map((c,pos)=>state.sb.from('store_categories').update({position:pos}).eq('id',c.id).eq('owner_id',state.user.id)));renderCategories();populateCategorySelects()}
async function deleteCategory(id){const c=state.categories.find(x=>x.id===id);if(!confirm(`Excluir a categoria "${c?.name}"? Os produtos ficarão sem categoria.`))return;const {error}=await state.sb.from('store_categories').delete().eq('id',id).eq('owner_id',state.user.id);if(error)return toast(error.message,'error');await reloadCategories();await reloadProducts();toast('Categoria excluída.')}

function bind(){
 $$('#editorNav .nav-item').forEach(b=>b.onclick=()=>navigate(b.dataset.section));$$('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));$('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');$('backDashboardBtn').onclick=()=>location.href='./index.html';
 $('saveAllBtn').onclick=saveStore;$('publishSaveBtn').onclick=saveStore;if($('saveMediaSettingsBtn'))$('saveMediaSettingsBtn').onclick=saveStore;['storeName','storeDescription','storeWhatsapp','storeInstagram','checkoutMode','minimumOrder','estimatedTime','orderNote','paymentPix','paymentCard','paymentCash','pixKey','pixReceiver','storePublished'].forEach(id=>$(id).addEventListener('input',()=>{markDirty();if(id==='storeDescription')$('descriptionCount').textContent=$(id).value.length;if(id==='storePublished')updatePublicationStatus();updateLivePreview()}));
 $('storeSlug').addEventListener('input',e=>{const clean=slugify(e.target.value);if(e.target.value!==clean)e.target.value=clean;$('slugFeedback').textContent=clean?'Endereço disponível para validação ao salvar.':'Use letras, números e hífens.';markDirty()});
 [['primaryColor','primaryColorText'],['accentColor','accentColorText']].forEach(([picker,text])=>{$(picker).oninput=e=>{$(text).value=e.target.value;markDirty();updateLivePreview()};$(text).oninput=e=>{if(/^#[0-9a-f]{6}$/i.test(e.target.value)){$(picker).value=e.target.value;markDirty();updateLivePreview()}}});
 $$('#productLayoutChoices .choice').forEach(b=>b.onclick=()=>{state.layout=b.dataset.value;$$('#productLayoutChoices .choice').forEach(x=>x.classList.toggle('active',x===b));markDirty();updateLivePreview()});
 if($('chooseLogoBtn'))$('chooseLogoBtn').onclick=()=>$('logoInput').click();if($('chooseBannerBtn'))$('chooseBannerBtn').onclick=()=>$('bannerInput').click();$('logoInput').onchange=e=>{const f=e.target.files[0];if(validateImage(f)){state.pendingImages.logo=f;state.removeImages.logo=false;state.previewUrls.logo=getPreviewObjectUrl('logo',f);previewLocal(f,$('logoPreview'),'logo');markDirty();updateLivePreview()}};$('bannerInput').onchange=e=>{const f=e.target.files[0];if(validateImage(f)){state.pendingImages.banner=f;state.removeImages.banner=false;state.previewUrls.banner=getPreviewObjectUrl('banner',f);previewLocal(f,$('bannerPreview'),'banner');markDirty();updateLivePreview()}};
 $('removeLogoBtn').onclick=()=>{if(state.previewUrls.logo)URL.revokeObjectURL(state.previewUrls.logo);state.previewUrls.logo='';state.pendingImages.logo=null;state.removeImages.logo=true;setImagePreview('logo',null);markDirty();updateLivePreview()};$('removeBannerBtn').onclick=()=>{if(state.previewUrls.banner)URL.revokeObjectURL(state.previewUrls.banner);state.previewUrls.banner='';state.pendingImages.banner=null;state.removeImages.banner=true;setImagePreview('banner',null);markDirty();updateLivePreview()};
 if($('chooseCoverVideoBtn'))$('chooseCoverVideoBtn').onclick=()=>$('coverVideoInput').click();$('coverVideoInput').onchange=e=>{const f=e.target.files[0];if(validateVideo(f)){state.pendingImages.coverVideo=f;state.removeImages.coverVideo=false;state.previewUrls.coverVideo=getPreviewObjectUrl('coverVideo',f);setCoverVideoPreview(f.name);markDirty();updateLivePreview()}};$('removeCoverVideoBtn').onclick=()=>{if(state.previewUrls.coverVideo)URL.revokeObjectURL(state.previewUrls.coverVideo);state.previewUrls.coverVideo='';state.pendingImages.coverVideo=null;state.removeImages.coverVideo=true;$('coverVideoExternalUrl').value='';setCoverVideoPreview(null);markDirty();updateLivePreview()};document.addEventListener('store-appearance-change',()=>{markDirty();updateLivePreview()});
 $('newProductBtn').onclick=()=>openProduct();$$('[data-new-product]').forEach(b=>b.onclick=()=>openProduct());$('productSearch').oninput=renderProducts;$('productCategoryFilter').onchange=renderProducts;$('selectAllProducts').onchange=e=>{filteredProducts().forEach(p=>e.target.checked?state.selected.add(p.id):state.selected.delete(p.id));renderProducts()};$('productTableBody').onclick=e=>{const edit=e.target.closest('[data-edit-product]'),dup=e.target.closest('[data-duplicate-product]'),del=e.target.closest('[data-delete-product]');if(edit)openProduct(edit.dataset.editProduct);if(dup)openProduct(dup.dataset.duplicateProduct,true);if(del)deleteProducts([del.dataset.deleteProduct])};$('productTableBody').onchange=e=>{const cb=e.target.closest('[data-select-product]');if(cb){cb.checked?state.selected.add(cb.dataset.selectProduct):state.selected.delete(cb.dataset.selectProduct);updateBulkBar()}};
 $$('[data-close-modal]').forEach(x=>x.onclick=closeProduct);$('chooseProductImageBtn').onclick=()=>$('productImageInput').click();$('productImageInput').onchange=e=>{const f=e.target.files[0];if(validateImage(f)){state.pendingImages.product=f;state.removeImages.product=false;previewLocal(f,$('productImagePreview'),'product')}};$('removeProductImageBtn').onclick=()=>{state.pendingImages.product=null;state.removeImages.product=true;$('productImagePreview').innerHTML='<i class="ri-image-add-line"></i><span>Foto do produto</span>'};$('addVariationBtn').onclick=()=>$('variationList').insertAdjacentHTML('beforeend',variationRow());$('variationList').onclick=e=>e.target.closest('[data-remove-variation]')?.closest('.variation-row').remove();$('saveProductBtn').onclick=saveProduct;$('bulkActivate').onclick=()=>bulkActive(true);$('bulkDeactivate').onclick=()=>bulkActive(false);$('bulkDelete').onclick=()=>deleteProducts([...state.selected]);
 $('newCategoryBtn').onclick=()=>openCategory();$$('[data-close-category]').forEach(x=>x.onclick=closeCategory);$('saveCategoryBtn').onclick=saveCategory;$('categoryList').onclick=e=>{const up=e.target.closest('[data-category-up]'),down=e.target.closest('[data-category-down]'),edit=e.target.closest('[data-edit-category]'),del=e.target.closest('[data-delete-category]');if(up)moveCategory(up.dataset.categoryUp,-1);if(down)moveCategory(down.dataset.categoryDown,1);if(edit)openCategory(edit.dataset.editCategory);if(del)deleteCategory(del.dataset.deleteCategory)};
 bindDeliveryFees();
 bindMercadoPago();
 $('copyStoreLinkBtn').onclick=async()=>{const url=`${location.origin}/loja/${slugify($('storeSlug').value)}`;await navigator.clipboard.writeText(url);toast('Link copiado.')};$('previewBtn').onclick=$('openPreviewBtn').onclick=()=>{const slug=slugify($('storeSlug').value);if(!slug)return toast('Defina o endereço da loja.','error');window.open(`/loja/${slug}`,'_blank')};
 window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue=''}});
}

async function init(){try{if(!await requireSession())return;await loadData();fillUI();bind();await loadMercadoPagoConfig();await initStoreMediaManager({sb:state.sb,user:state.user,store:state.store,toast,onChange:updateLivePreview});$('app').classList.remove('is-hidden');$('pageLoader').remove()}catch(e){console.error(e);$('pageLoader').innerHTML=`<i class="ri-error-warning-line" style="font-size:38px;color:#dc2626"></i><strong>Não foi possível abrir o editor</strong><span>${escapeHtml(e.message)}</span><button onclick="location.reload()" class="primary-btn">Tentar novamente</button>`}}
init();