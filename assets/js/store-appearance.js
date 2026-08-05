const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const APPEARANCE_DEFAULTS = {
  theme: 'minimal', cover_type: 'image', cover_video_external_url: '', cover_fit: 'cover', cover_position: 'center', cover_height: 'medium', cover_overlay: 35,
  logo_shape: 'rounded', hero_alignment: 'left', hero_title: '', hero_subtitle: '', hero_button_text: 'Ver produtos', hero_button_target: 'products',
  background_color: '#f6f8fc', card_color: '#ffffff', text_color: '#0f172a', muted_color: '#64748b', body_font: 'Manrope', heading_font: 'Manrope', heading_weight: '800', font_scale: 'normal',
  desktop_columns: 3, product_image_ratio: 'square', card_radius: 'large', card_shadow: 'soft', product_text_alignment: 'left', category_style: 'pills',
  show_search: true, sticky_categories: false, show_featured: true, show_sale_badge: true, show_product_description: true,
  button_style: 'rounded', button_hover: 'lift', page_animation: 'fade', card_animation: 'lift', animation_speed: 'normal', scroll_behavior: 'smooth', respect_reduced_motion: true, show_back_to_top: true,
  header_style: 'transparent', header_position: 'static', footer_style: 'simple', footer_background: 'accent', footer_text: '', show_social_links: true, floating_whatsapp: true, floating_cart: true,
  custom_css: ''
};

const fieldMap = {
  coverVideoExternalUrl:'cover_video_external_url', coverFit:'cover_fit', coverPosition:'cover_position', coverHeight:'cover_height', coverOverlay:'cover_overlay', logoShape:'logo_shape', heroAlignment:'hero_alignment', heroTitle:'hero_title', heroSubtitle:'hero_subtitle', heroButtonText:'hero_button_text', heroButtonTarget:'hero_button_target',
  backgroundColorText:'background_color', cardColorText:'card_color', textColorText:'text_color', mutedColorText:'muted_color', bodyFont:'body_font', headingFont:'heading_font', headingWeight:'heading_weight', fontScale:'font_scale',
  desktopColumns:'desktop_columns', productImageRatio:'product_image_ratio', cardRadius:'card_radius', cardShadow:'card_shadow', productTextAlignment:'product_text_alignment', categoryStyle:'category_style',
  showSearch:'show_search', stickyCategories:'sticky_categories', showFeatured:'show_featured', showSaleBadge:'show_sale_badge', showProductDescription:'show_product_description',
  buttonStyle:'button_style', buttonHover:'button_hover', pageAnimation:'page_animation', cardAnimation:'card_animation', animationSpeed:'animation_speed', scrollBehavior:'scroll_behavior', respectReducedMotion:'respect_reduced_motion', showBackToTop:'show_back_to_top',
  headerStyle:'header_style', headerPosition:'header_position', footerStyle:'footer_style', footerBackground:'footer_background', footerText:'footer_text', showSocialLinks:'show_social_links', floatingWhatsapp:'floating_whatsapp', floatingCart:'floating_cart', customCss:'custom_css'
};

let current = {...APPEARANCE_DEFAULTS};
let coverType = 'image';

function emitChange(){
  document.dispatchEvent(new CustomEvent('store-appearance-change',{detail:collectAppearance()}));
  updateAppearancePreview();
}
function setChoice(group,value){
  $$(`#${group} [data-value]`).forEach(b=>b.classList.toggle('active',b.dataset.value===value));
}
function setTheme(theme){
  current.theme=theme;
  $$('#themeChoices [data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===theme));
  const presets={
    minimal:{body_font:'Manrope',heading_font:'Manrope',heading_weight:'800',background_color:'#f6f8fc',card_color:'#ffffff',text_color:'#0f172a',muted_color:'#64748b',card_radius:'large',card_shadow:'soft',button_style:'rounded',hero_alignment:'left'},
    boutique:{body_font:'Manrope',heading_font:'Playfair Display',heading_weight:'700',background_color:'#fbf7f3',card_color:'#ffffff',text_color:'#2a201c',muted_color:'#7c6f67',card_radius:'small',card_shadow:'soft',button_style:'square',hero_alignment:'center'},
    vibrant:{body_font:'Poppins',heading_font:'Poppins',heading_weight:'800',background_color:'#fff8ed',card_color:'#ffffff',text_color:'#251537',muted_color:'#765f82',card_radius:'large',card_shadow:'medium',button_style:'pill',hero_alignment:'center'},
    dark:{body_font:'Inter',heading_font:'Montserrat',heading_weight:'800',background_color:'#0b1120',card_color:'#111827',text_color:'#f8fafc',muted_color:'#94a3b8',card_radius:'medium',card_shadow:'strong',button_style:'rounded',hero_alignment:'left'},
    organic:{body_font:'Nunito',heading_font:'Fraunces',heading_weight:'700',background_color:'#f1f5ed',card_color:'#fffdf8',text_color:'#1f3024',muted_color:'#647467',card_radius:'large',card_shadow:'soft',button_style:'pill',hero_alignment:'left'},
    poster:{body_font:'Inter',heading_font:'Anton',heading_weight:'900',background_color:'#ffffff',card_color:'#ffffff',text_color:'#101010',muted_color:'#575757',card_radius:'none',card_shadow:'none',button_style:'square',hero_alignment:'left'}
  };
  Object.assign(current,presets[theme]||{});
  applyAppearance(current,coverType,false);
  emitChange();
}
function syncColor(picker,text){
  const p=$(picker),t=$(text); if(!p||!t)return;
  p.addEventListener('input',()=>{t.value=p.value;emitChange()});
  t.addEventListener('input',()=>{if(/^#[0-9a-f]{6}$/i.test(t.value))p.value=t.value;emitChange()});
}
function toggleCoverFields(){
  $('bannerImageFields')?.classList.toggle('is-hidden',coverType!=='image');
  $('coverVideoFields')?.classList.toggle('is-hidden',coverType!=='video');
  setChoice('coverTypeChoices',coverType);
}

export function collectAppearance(){
  const result={...current,theme:current.theme,cover_type:coverType};
  Object.entries(fieldMap).forEach(([id,key])=>{
    const el=$(id); if(!el)return;
    result[key]=el.type==='checkbox'?el.checked:el.type==='range'||el.type==='number'?Number(el.value):el.value;
  });
  return result;
}

export function applyAppearance(settings={},type='image',update=true){
  current={...APPEARANCE_DEFAULTS,...settings}; coverType=type||current.cover_type||'image';
  $$('#themeChoices [data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===current.theme));
  Object.entries(fieldMap).forEach(([id,key])=>{const el=$(id);if(!el)return;const v=current[key];if(el.type==='checkbox')el.checked=!!v;else el.value=v??'';});
  [['backgroundColor','backgroundColorText'],['cardColor','cardColorText'],['textColor','textColorText'],['mutedColor','mutedColorText']].forEach(([p,t])=>{if($(p)&&$(t))$(p).value=$(t).value});
  $('coverOverlayValue').textContent=`${Number(current.cover_overlay||0)}%`;
  toggleCoverFields(); if(update)updateAppearancePreview();
}

export function updateAppearancePreview(context={}){
  const p=$('appearanceLivePreview'); if(!p)return;
  const a=collectAppearance();
  p.dataset.theme=a.theme; p.dataset.layout=context.productLayout||'grid';
  p.style.setProperty('--ap-primary',context.primaryColor||'#2563eb');
  p.style.setProperty('--ap-accent',context.accentColor||'#0f172a');
  p.style.setProperty('--ap-bg',a.background_color); p.style.setProperty('--ap-card',a.card_color); p.style.setProperty('--ap-text',a.text_color); p.style.setProperty('--ap-muted',a.muted_color);
  p.style.setProperty('--ap-body-font',`"${a.body_font}",sans-serif`); p.style.setProperty('--ap-heading-font',`"${a.heading_font}",sans-serif`); p.style.setProperty('--ap-heading-weight',a.heading_weight);
  p.style.setProperty('--ap-overlay',Number(a.cover_overlay||0)/100); p.style.setProperty('--ap-columns',Math.min(3,Number(a.desktop_columns||3))); p.dataset.radius=a.card_radius; p.dataset.shadow=a.card_shadow; p.dataset.button=a.button_style; p.dataset.align=a.hero_alignment; p.dataset.ratio=a.product_image_ratio;
  p.querySelector('.alp-copy h3').textContent=a.hero_title||context.storeName||'Minha loja';
  p.querySelector('.alp-copy p').textContent=a.hero_subtitle||context.description||'Sua descrição aparecerá aqui';
  const heroBtn=p.querySelector('.alp-copy button'); heroBtn.textContent=a.hero_button_text||'Ver produtos'; heroBtn.hidden=a.hero_button_target==='none';
  p.querySelector('.alp-search').hidden=!a.show_search; p.querySelector('.alp-sale').hidden=!a.show_sale_badge; p.querySelectorAll('.alp-products article p').forEach(x=>x.hidden=!a.show_product_description);
  p.querySelector('.alp-footer').hidden=a.footer_style==='hidden'; p.querySelector('.alp-footer').textContent=a.footer_text||'Sua loja • Instagram • WhatsApp';
  const media=p.querySelector('.alp-media');
  if(context.coverPreviewUrl){media.style.backgroundImage=`url('${context.coverPreviewUrl}')`;media.innerHTML='';}
  else if(a.cover_type==='video'){media.style.backgroundImage='';media.innerHTML='<i class="ri-play-circle-fill"></i><span>Vídeo da capa</span>';}
  else if(a.cover_type==='gradient'){media.style.backgroundImage=`linear-gradient(135deg,${context.primaryColor||'#2563eb'},${context.accentColor||'#0f172a'})`;media.innerHTML='';}
  const logo=p.querySelector('.alp-logo'); if(context.logoPreviewUrl)logo.innerHTML=`<img src="${context.logoPreviewUrl}" alt="">`; else logo.innerHTML='<i class="ri-store-line"></i>'; logo.dataset.shape=a.logo_shape;
}

export function initAppearance(settings={},type='image'){
  applyAppearance(settings,type,false);
  $$('#themeChoices [data-theme]').forEach(b=>b.addEventListener('click',()=>setTheme(b.dataset.theme)));
  $$('#coverTypeChoices [data-value]').forEach(b=>b.addEventListener('click',()=>{coverType=b.dataset.value;toggleCoverFields();emitChange()}));
  Object.keys(fieldMap).forEach(id=>{const el=$(id);if(!el)return;el.addEventListener(el.type==='range'?'input':'change',()=>{if(id==='coverOverlay')$('coverOverlayValue').textContent=`${el.value}%`;emitChange()});if(['text','url','textarea'].includes(el.type)||el.tagName==='TEXTAREA')el.addEventListener('input',emitChange)});
  syncColor('backgroundColor','backgroundColorText');syncColor('cardColor','cardColorText');syncColor('textColor','textColorText');syncColor('mutedColor','mutedColorText');
  $('resetAppearanceBtn')?.addEventListener('click',()=>{if(confirm('Restaurar todas as configurações visuais para o padrão?')){applyAppearance(APPEARANCE_DEFAULTS,'image');emitChange()}});
  $$('[data-preview-device]').forEach(b=>b.addEventListener('click',()=>{$$('[data-preview-device]').forEach(x=>x.classList.toggle('active',x===b));const p=$('appearanceLivePreview');p.classList.toggle('desktop',b.dataset.previewDevice==='desktop');p.classList.toggle('mobile',b.dataset.previewDevice!=='desktop')}));
  updateAppearancePreview();
}

window.StoreAppearance={initAppearance,collectAppearance,applyAppearance,updateAppearancePreview,defaults:APPEARANCE_DEFAULTS};
