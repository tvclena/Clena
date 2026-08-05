import { getSupabase } from './supabase-client.js';

const db = await getSupabase();
const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const digits = (value) => String(value || '').replace(/\D/g, '');

const APPEARANCE_DEFAULTS = {
  theme:'minimal', cover_type:'image', cover_video_external_url:'', cover_fit:'cover', cover_position:'center', cover_height:'medium', cover_overlay:35,
  logo_shape:'rounded', hero_alignment:'left', hero_title:'', hero_subtitle:'', hero_button_text:'Ver produtos', hero_button_target:'products',
  background_color:'#f6f8fc', card_color:'#ffffff', text_color:'#0f172a', muted_color:'#64748b', body_font:'Manrope', heading_font:'Manrope', heading_weight:'800', font_scale:'normal',
  desktop_columns:3, product_image_ratio:'square', card_radius:'large', card_shadow:'soft', product_text_alignment:'left', category_style:'pills',
  show_search:true, sticky_categories:false, show_featured:true, show_sale_badge:true, show_product_description:true,
  button_style:'rounded', button_hover:'lift', page_animation:'fade', card_animation:'lift', animation_speed:'normal', scroll_behavior:'smooth', respect_reduced_motion:true,
  show_back_to_top:true, header_style:'transparent', header_position:'static', footer_style:'simple', footer_background:'accent', footer_text:'', show_social_links:true,
  social_instagram:'', social_facebook:'', social_tiktok:'', social_youtube:'', social_x:'', social_pinterest:'', floating_whatsapp:true, floating_cart:true, custom_css:''
};

const SOCIALS = [
  ['social_instagram','ri-instagram-line','Instagram','https://instagram.com/'], ['social_facebook','ri-facebook-circle-line','Facebook','https://facebook.com/'],
  ['social_tiktok','ri-tiktok-line','TikTok','https://tiktok.com/@'], ['social_youtube','ri-youtube-line','YouTube','https://youtube.com/@'],
  ['social_x','ri-twitter-x-line','X','https://x.com/'], ['social_pinterest','ri-pinterest-line','Pinterest','https://pinterest.com/']
];

let store = null;
let appearance = { ...APPEARANCE_DEFAULTS };
let categories = [];
let products = [];
let variations = [];
let cart = [];
let currentCategory = 'all';
let selectedProduct = null;
let selectedVariation = null;
let selectedQuantity = 1;

function slugFromUrl() {
  const querySlug = new URLSearchParams(location.search).get('slug');
  if (querySlug) return querySlug;
  const parts = location.pathname.split('/').filter(Boolean);
  const last = parts.at(-1) || '';
  return last.replace(/\.html$/i, '');
}

function normalizeSocialUrl(value, base) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^@/, '').replace(/^\/+/, '');
  if (/^(instagram|facebook|tiktok|youtube|youtu\.be|x|twitter|pinterest)\.com\//i.test(clean)) return `https://${clean}`;
  return `${base}${clean}`;
}

function toast(message, type = 'info') {
  const element = document.createElement('div');
  element.className = `toast toast-${type}`;
  element.innerHTML = `<i class="${type === 'success' ? 'ri-checkbox-circle-line' : type === 'error' ? 'ri-error-warning-line' : 'ri-information-line'}"></i><span>${escapeHtml(message)}</span>`;
  $('toastRegion').appendChild(element);
  requestAnimationFrame(() => element.classList.add('show'));
  setTimeout(() => { element.classList.remove('show'); setTimeout(() => element.remove(), 250); }, 2800);
}

function setLoadingState(done) {
  $('pageLoader').classList.toggle('is-hidden', done);
  $('storeApp').classList.toggle('is-hidden', !done);
}

function showFatal(title, message) {
  document.body.innerHTML = `<main class="fatal-state"><span><i class="ri-store-2-line"></i></span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="/">Voltar ao início</a></main>`;
}

function applyAppearance() {
  const root = document.documentElement;
  appearance = { ...APPEARANCE_DEFAULTS, ...(store.appearance_settings || {}), cover_type: store.cover_type || store.appearance_settings?.cover_type || 'image' };
  const coverHeights = { compact:'320px', medium:'470px', large:'620px', fullscreen:'min(880px,100svh)' };
  const radius = { none:'0px', small:'10px', medium:'18px', large:'28px' };
  const speed = { fast:'180ms', normal:'320ms', slow:'600ms' };
  const scale = { small:'.92', normal:'1', large:'1.1' };

  root.style.setProperty('--primary', store.primary_color || '#2563eb');
  root.style.setProperty('--accent', store.accent_color || '#0f172a');
  root.style.setProperty('--background', appearance.background_color);
  root.style.setProperty('--card', appearance.card_color);
  root.style.setProperty('--text', appearance.text_color);
  root.style.setProperty('--muted', appearance.muted_color);
  root.style.setProperty('--body-font', `"${appearance.body_font}",sans-serif`);
  root.style.setProperty('--heading-font', `"${appearance.heading_font}",sans-serif`);
  root.style.setProperty('--heading-weight', appearance.heading_weight);
  root.style.setProperty('--font-scale', scale[appearance.font_scale] || '1');
  root.style.setProperty('--columns', String(Math.max(2, Math.min(5, Number(appearance.desktop_columns || 3)))));
  root.style.setProperty('--card-radius', radius[appearance.card_radius] || radius.large);
  root.style.setProperty('--animation-speed', speed[appearance.animation_speed] || speed.normal);
  root.style.setProperty('--hero-height', coverHeights[appearance.cover_height] || coverHeights.medium);
  root.style.setProperty('--overlay-opacity', String(Number(appearance.cover_overlay || 0) / 100));
  root.style.scrollBehavior = appearance.scroll_behavior === 'smooth' ? 'smooth' : 'auto';

  document.body.dataset.theme = appearance.theme;
  document.body.dataset.layout = store.product_layout || 'grid';
  document.body.dataset.imageRatio = appearance.product_image_ratio;
  document.body.dataset.cardRadius = appearance.card_radius;
  document.body.dataset.cardShadow = appearance.card_shadow;
  document.body.dataset.productAlign = appearance.product_text_alignment;
  document.body.dataset.categoryStyle = appearance.category_style;
  document.body.dataset.buttonStyle = appearance.button_style;
  document.body.dataset.buttonHover = appearance.button_hover;
  document.body.dataset.pageAnimation = appearance.page_animation;
  document.body.dataset.cardAnimation = appearance.card_animation;
  document.body.dataset.headerStyle = appearance.header_style;
  document.body.dataset.headerPosition = appearance.header_position;
  document.body.dataset.footerStyle = appearance.footer_style;
  document.body.dataset.footerBackground = appearance.footer_background;

  $('themeColorMeta').content = appearance.background_color || store.primary_color || '#f6f8fc';
  $('customStoreCss').textContent = String(appearance.custom_css || '').slice(0, 12000);

  if (appearance.respect_reduced_motion && matchMedia('(prefers-reduced-motion: reduce)').matches) document.body.classList.add('reduce-motion');
  $('searchArea').classList.toggle('is-hidden', !appearance.show_search);
  $('categoryBarWrap').classList.toggle('is-sticky', Boolean(appearance.sticky_categories));
  $('featuredSection').classList.toggle('is-hidden', !appearance.show_featured || !products.some((p) => p.featured));
  $('siteFooter').classList.toggle('is-hidden', appearance.footer_style === 'hidden');
  $('floatingWhatsapp').classList.toggle('is-hidden', !appearance.floating_whatsapp || !digits(store.whatsapp));
  $('floatingCart').classList.toggle('is-hidden', !appearance.floating_cart || store.checkout_mode === 'catalog_only');
  $('headerCartButton').classList.toggle('is-hidden', store.checkout_mode === 'catalog_only');
  $('backToTop').classList.toggle('enabled', Boolean(appearance.show_back_to_top));
}

function renderHero() {
  const media = $('heroMedia');
  media.innerHTML = '';
  media.style.backgroundImage = '';
  media.style.backgroundSize = appearance.cover_fit || 'cover';
  media.style.backgroundPosition = appearance.cover_position || 'center';

  if (appearance.cover_type === 'video') {
    const source = appearance.cover_video_external_url || store.cover_video_url;
    if (source) {
      const video = document.createElement('video');
      video.src = source;
      video.autoplay = true; video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'metadata';
      video.style.objectFit = appearance.cover_fit || 'cover';
      video.style.objectPosition = appearance.cover_position || 'center';
      media.appendChild(video);
    } else media.classList.add('gradient-fallback');
  } else if (appearance.cover_type === 'gradient') {
    media.classList.add('gradient-fallback');
  } else if (store.banner_url) {
    media.style.backgroundImage = `url("${String(store.banner_url).replace(/"/g, '%22')}")`;
  } else media.classList.add('gradient-fallback');

  const title = appearance.hero_title || store.name;
  const subtitle = appearance.hero_subtitle || store.description || '';
  $('heroTitle').textContent = title;
  $('heroSubtitle').textContent = subtitle;
  $('heroSubtitle').classList.toggle('is-hidden', !subtitle);
  $('heroButton').textContent = appearance.hero_button_text || 'Ver produtos';
  $('heroButton').classList.toggle('is-hidden', appearance.hero_button_target === 'none');
  $('hero').dataset.align = appearance.hero_alignment || 'left';

  setLogo($('heroLogo'), store.logo_url, appearance.logo_shape);
  setLogo($('headerLogo'), store.logo_url, appearance.logo_shape);
  setLogo($('footerLogo'), store.logo_url, appearance.logo_shape);
}

function setLogo(element, url, shape) {
  element.dataset.shape = shape || 'rounded';
  element.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="Logo de ${escapeHtml(store.name)}">` : '<i class="ri-store-2-line"></i>';
}

function renderStoreInformation() {
  document.title = store.name;
  document.querySelector('meta[name="description"]').content = store.description || `Loja virtual ${store.name}`;
  $('headerName').textContent = store.name;
  $('headerStatus').textContent = store.is_published ? 'Loja online' : 'Catálogo';
  $('footerStoreName').textContent = store.name;
  $('footerDescription').textContent = store.description || '';
  $('catalogDescription').textContent = store.order_note || 'Explore nossos produtos e finalize seu pedido.';

  if (store.estimated_time) { $('estimatedInfo').classList.remove('is-hidden'); $('estimatedText').textContent = store.estimated_time; }
  if (Number(store.minimum_order || 0) > 0) { $('minimumInfo').classList.remove('is-hidden'); $('minimumText').textContent = money(store.minimum_order); }

  const whatsappUrl = digits(store.whatsapp) ? `https://wa.me/${digits(store.whatsapp)}` : '';
  for (const id of ['heroWhatsapp','footerWhatsapp']) {
    const link = $(id); link.classList.toggle('is-hidden', !whatsappUrl); if (whatsappUrl) link.href = whatsappUrl;
  }
  $('floatingWhatsapp').onclick = () => { if (whatsappUrl) window.open(whatsappUrl, '_blank', 'noopener'); };

  const instagramValue = appearance.social_instagram || store.instagram || '';
  const instagramUrl = normalizeSocialUrl(instagramValue, 'https://instagram.com/');
  for (const id of ['headerInstagram','footerInstagram']) {
    const link = $(id); link.classList.toggle('is-hidden', !instagramUrl); if (instagramUrl) link.href = instagramUrl;
  }

  renderSocialLinks();
  $('footerText').textContent = appearance.footer_text || `${store.name} © ${new Date().getFullYear()}. Todos os direitos reservados.`;
}

function renderSocialLinks() {
  const values = { ...appearance };
  if (!values.social_instagram && store.instagram) values.social_instagram = store.instagram;
  const links = SOCIALS.map(([key, icon, label, base]) => ({ icon, label, url: normalizeSocialUrl(values[key], base) })).filter((item) => item.url);
  $('socialLinks').innerHTML = appearance.show_social_links ? links.map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" aria-label="${item.label}" title="${item.label}"><i class="${item.icon}"></i></a>`).join('') : '';
  $('footerSocialColumn').classList.toggle('is-hidden', !appearance.show_social_links || !links.length);
}

function renderCategories() {
  const buttons = [{ id:'all', name:'Todos', icon:'ri-apps-2-line' }, ...categories.map((category) => ({ id:category.id, name:category.name, icon:category.icon || 'ri-price-tag-3-line' }))];
  $('categoryBar').innerHTML = buttons.map((category) => `<button class="category-button ${currentCategory === category.id ? 'active' : ''}" type="button" role="tab" aria-selected="${currentCategory === category.id}" data-category="${category.id}"><i class="${escapeHtml(category.icon)}"></i><span>${escapeHtml(category.name)}</span></button>`).join('');
  $$('[data-category]').forEach((button) => button.addEventListener('click', () => {
    currentCategory = button.dataset.category;
    renderCategories(); renderProducts();
    if (appearance.sticky_categories) $('catalog').scrollIntoView({ behavior:'smooth', block:'start' });
  }));
}

function getFilteredProducts() {
  const search = $('searchInput').value.trim().toLowerCase();
  let list = products.filter((product) => currentCategory === 'all' || product.category_id === currentCategory).filter((product) => `${product.name} ${product.description || ''} ${product.sku || ''}`.toLowerCase().includes(search));
  const sort = $('sortSelect').value;
  if (sort === 'featured') list.sort((a,b) => Number(b.featured) - Number(a.featured) || a.position - b.position);
  if (sort === 'low') list.sort((a,b) => productPrice(a) - productPrice(b));
  if (sort === 'high') list.sort((a,b) => productPrice(b) - productPrice(a));
  if (sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (sort === 'position') list.sort((a,b) => a.position - b.position);
  return list;
}

function productPrice(product) {
  const sale = Number(product.sale_price || 0);
  return sale > 0 && sale < Number(product.price || 0) ? sale : Number(product.price || 0);
}

function hasSale(product) {
  return Number(product.sale_price || 0) > 0 && Number(product.sale_price) < Number(product.price || 0);
}

function productCard(product, index = 0) {
  const category = categories.find((item) => item.id === product.category_id);
  const out = product.stock_mode === 'out' || (product.stock_mode === 'controlled' && Number(product.stock || 0) <= 0);
  const sale = hasSale(product);
  const image = product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy">` : `<span class="product-placeholder"><i class="ri-image-line"></i></span>`;
  const action = product.external_url
    ? `<a class="product-action" href="${escapeHtml(product.external_url)}" target="_blank" rel="noopener"><span>Ver produto</span><i class="ri-external-link-line"></i></a>`
    : store.checkout_mode === 'catalog_only'
      ? `<button class="product-action" type="button" data-contact-product="${product.id}"><span>Consultar</span><i class="ri-whatsapp-line"></i></button>`
      : `<button class="product-action" type="button" data-open-product="${product.id}" ${out ? 'disabled' : ''}><span>${out ? 'Esgotado' : 'Adicionar'}</span><i class="${out ? 'ri-forbid-line' : 'ri-add-line'}"></i></button>`;

  return `<article class="product-card" style="--item-index:${index}" data-product-card="${product.id}">
    <button class="product-image" type="button" data-open-product="${product.id}" ${out ? 'aria-disabled="true"' : ''}>${image}${appearance.show_sale_badge && sale ? '<span class="sale-badge">OFERTA</span>' : ''}${product.featured ? '<span class="featured-badge"><i class="ri-star-fill"></i></span>' : ''}${out ? '<span class="out-badge">Esgotado</span>' : ''}</button>
    <div class="product-content">${category ? `<span class="product-category">${escapeHtml(category.name)}</span>` : ''}<h3>${escapeHtml(product.name)}</h3>${appearance.show_product_description && product.description ? `<p>${escapeHtml(product.description)}</p>` : ''}<div class="product-bottom"><div class="product-price">${sale ? `<small>${money(product.price)}</small>` : ''}<strong>${money(productPrice(product))}</strong></div>${action}</div></div>
  </article>`;
}

function bindProductActions(root = document) {
  $$('[data-open-product]', root).forEach((element) => element.addEventListener('click', () => {
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') return;
    openProduct(element.dataset.openProduct);
  }));
  $$('[data-contact-product]', root).forEach((element) => element.addEventListener('click', () => {
    const product = products.find((item) => item.id === element.dataset.contactProduct);
    if (!digits(store.whatsapp)) return toast('WhatsApp não configurado.', 'error');
    window.open(`https://wa.me/${digits(store.whatsapp)}?text=${encodeURIComponent(`Olá! Gostaria de saber mais sobre ${product.name}.`)}`, '_blank', 'noopener');
  }));
}

function renderProducts() {
  const list = getFilteredProducts();
  const category = categories.find((item) => item.id === currentCategory);
  $('resultCount').textContent = `${list.length} ${list.length === 1 ? 'produto' : 'produtos'}`;
  $('activeFilterLabel').textContent = category?.name || 'Todos os produtos';
  $('productGrid').innerHTML = list.map(productCard).join('');
  $('productGrid').classList.toggle('is-hidden', !list.length);
  $('emptyProducts').classList.toggle('is-hidden', Boolean(list.length));
  bindProductActions($('productGrid'));
}

function renderFeatured() {
  const featured = products.filter((product) => product.featured).slice(0, Math.max(4, Number(appearance.desktop_columns || 3)));
  const visible = appearance.show_featured && featured.length > 0;
  $('featuredSection').classList.toggle('is-hidden', !visible);
  if (!visible) return;
  $('featuredProducts').innerHTML = featured.map(productCard).join('');
  bindProductActions($('featuredProducts'));
}

function openProduct(id) {
  selectedProduct = products.find((product) => product.id === id);
  if (!selectedProduct) return;
  selectedQuantity = 1; selectedVariation = null; $('productNote').value = '';
  const category = categories.find((item) => item.id === selectedProduct.category_id);
  $('productModalCategory').textContent = category?.name || 'Produto';
  $('productModalName').textContent = selectedProduct.name;
  $('productModalDescription').textContent = selectedProduct.description || '';
  $('productModalDescription').classList.toggle('is-hidden', !selectedProduct.description);
  $('productModalImage').innerHTML = selectedProduct.image_url ? `<img src="${escapeHtml(selectedProduct.image_url)}" alt="${escapeHtml(selectedProduct.name)}">` : '<span><i class="ri-image-line"></i></span>';
  $('productModalPrice').innerHTML = hasSale(selectedProduct) ? `<small>${money(selectedProduct.price)}</small><strong>${money(productPrice(selectedProduct))}</strong>` : `<strong>${money(selectedProduct.price)}</strong>`;
  const options = variations.filter((variation) => variation.product_id === id).sort((a,b) => a.position - b.position);
  $('variationArea').classList.toggle('is-hidden', !options.length);
  $('variationOptions').innerHTML = options.map((variation, index) => `<label class="variation-option"><input type="radio" name="productVariation" value="${variation.id}" ${index === 0 ? 'checked' : ''}><span><b>${escapeHtml(variation.name)}</b><small>${Number(variation.price_adjustment || 0) ? `+ ${money(variation.price_adjustment)}` : 'Sem acréscimo'}</small></span><i class="ri-check-line"></i></label>`).join('');
  if (options.length) selectedVariation = options[0];
  $$('input[name="productVariation"]', $('variationOptions')).forEach((input) => input.addEventListener('change', () => { selectedVariation = options.find((item) => item.id === input.value); updateModalTotal(); }));
  updateModalTotal();
  $('productModal').classList.remove('is-hidden'); document.body.classList.add('no-scroll');
}

function updateModalTotal() {
  $('productQty').textContent = selectedQuantity;
  const unit = productPrice(selectedProduct) + Number(selectedVariation?.price_adjustment || 0);
  $('modalAddPrice').textContent = money(unit * selectedQuantity);
}

function closeProduct() { $('productModal').classList.add('is-hidden'); document.body.classList.remove('no-scroll'); }

function addCurrentProduct() {
  if (!selectedProduct) return;
  const key = `${selectedProduct.id}:${selectedVariation?.id || 'base'}:${$('productNote').value.trim()}`;
  const existing = cart.find((item) => item.key === key);
  if (existing) existing.quantity += selectedQuantity;
  else cart.push({ key, product:selectedProduct, variation:selectedVariation, note:$('productNote').value.trim(), quantity:selectedQuantity });
  renderCart(); closeProduct(); toast('Produto adicionado ao carrinho.', 'success');
}

function cartItemUnit(item) { return productPrice(item.product) + Number(item.variation?.price_adjustment || 0); }
function cartTotal() { return cart.reduce((total, item) => total + cartItemUnit(item) * item.quantity, 0); }

function renderCart() {
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  $('headerCartCount').textContent = count; $('floatingCartCount').textContent = count;
  $('cartItems').innerHTML = cart.map((item, index) => `<article class="cart-item"><div class="cart-item-image">${item.product.image_url ? `<img src="${escapeHtml(item.product.image_url)}" alt="">` : '<i class="ri-image-line"></i>'}</div><div class="cart-item-content"><div class="cart-item-head"><div><h3>${escapeHtml(item.product.name)}</h3>${item.variation ? `<p>${escapeHtml(item.variation.name)}</p>` : ''}${item.note ? `<small>Obs.: ${escapeHtml(item.note)}</small>` : ''}</div><button type="button" data-remove-cart="${index}" aria-label="Remover"><i class="ri-delete-bin-line"></i></button></div><div class="cart-item-bottom"><div class="cart-qty"><button type="button" data-cart-delta="-1" data-cart-index="${index}">−</button><strong>${item.quantity}</strong><button type="button" data-cart-delta="1" data-cart-index="${index}">+</button></div><strong>${money(cartItemUnit(item) * item.quantity)}</strong></div></div></article>`).join('');
  const empty = !cart.length;
  $('cartEmpty').classList.toggle('is-hidden', !empty); $('checkoutFormArea').classList.toggle('is-hidden', empty); $('cartFooter').classList.toggle('is-hidden', empty);
  const total = cartTotal(); $('cartSubtotal').textContent = money(total); $('cartTotal').textContent = money(total);
  const minimum = Number(store.minimum_order || 0); const under = minimum > 0 && total < minimum;
  $('minimumOrderRow').classList.toggle('is-hidden', minimum <= 0); $('minimumOrderValue').textContent = money(minimum);
  $('minimumWarning').classList.toggle('is-hidden', !under); $('minimumWarning').textContent = under ? `Faltam ${money(minimum - total)} para atingir o pedido mínimo.` : '';
  $('checkoutButton').disabled = under;
  $$('[data-cart-delta]').forEach((button) => button.addEventListener('click', () => { const item = cart[Number(button.dataset.cartIndex)]; item.quantity += Number(button.dataset.cartDelta); if (item.quantity < 1) cart.splice(Number(button.dataset.cartIndex),1); renderCart(); }));
  $$('[data-remove-cart]').forEach((button) => button.addEventListener('click', () => { cart.splice(Number(button.dataset.removeCart),1); renderCart(); }));
}

function openCart() { $('cartDrawer').classList.remove('is-hidden'); document.body.classList.add('no-scroll'); }
function closeCart() { $('cartDrawer').classList.add('is-hidden'); document.body.classList.remove('no-scroll'); }

function renderPaymentMethods() {
  const methods = [];
  if (store.accepts_pix) methods.push(['pix','PIX']);
  if (store.accepts_card) methods.push(['card','Cartão']);
  if (store.accepts_cash) methods.push(['cash','Dinheiro']);
  $('paymentMethod').innerHTML = methods.length ? methods.map(([value,label]) => `<option value="${value}">${label}</option>`).join('') : '<option value="not_informed">Combinar no atendimento</option>';
  $('paymentField').classList.toggle('is-hidden', !methods.length);
}

function checkout() {
  if (!cart.length) return toast('Seu carrinho está vazio.', 'error');
  const name = $('customerName').value.trim(); const phone = digits($('customerPhone').value);
  if (!name) return toast('Informe seu nome.', 'error');
  if (phone.length < 10) return toast('Informe um WhatsApp válido.', 'error');
  if (!digits(store.whatsapp)) return toast('A loja não configurou o WhatsApp de pedidos.', 'error');
  const total = cartTotal();
  if (total < Number(store.minimum_order || 0)) return toast('O pedido ainda não atingiu o valor mínimo.', 'error');
  const paymentLabel = $('paymentMethod').selectedOptions[0]?.textContent || 'A combinar';
  const lines = cart.map((item) => {
    const details = [item.variation?.name, item.note ? `Obs.: ${item.note}` : ''].filter(Boolean).join(' | ');
    return `• ${item.quantity}x ${item.product.name}${details ? ` (${details})` : ''} — ${money(cartItemUnit(item) * item.quantity)}`;
  });
  const message = [`Olá! Quero fazer um pedido na *${store.name}*.`, '', `*Cliente:* ${name}`, `*WhatsApp:* ${phone}`, '', '*Itens:*', ...lines, '', `*Total:* ${money(total)}`, `*Pagamento:* ${paymentLabel}`];
  if ($('paymentMethod').value === 'cash' && $('cashChange').value.trim()) message.push(`*Troco para:* R$ ${$('cashChange').value.trim()}`);
  if ($('orderNotes').value.trim()) message.push(`*Observações:* ${$('orderNotes').value.trim()}`);
  if (store.order_note) message.push('', store.order_note);
  window.open(`https://wa.me/${digits(store.whatsapp)}?text=${encodeURIComponent(message.join('\n'))}`, '_blank', 'noopener');
}

function bindEvents() {
  $('searchInput').addEventListener('input', () => { $('clearSearch').classList.toggle('is-hidden', !$('searchInput').value); renderProducts(); });
  $('clearSearch').addEventListener('click', () => { $('searchInput').value = ''; $('clearSearch').classList.add('is-hidden'); renderProducts(); $('searchInput').focus(); });
  $('sortSelect').addEventListener('change', renderProducts);
  $('resetFilters').addEventListener('click', () => { currentCategory = 'all'; $('searchInput').value = ''; renderCategories(); renderProducts(); });
  $('viewAllProducts').addEventListener('click', () => $('catalog').scrollIntoView({ behavior:'smooth' }));
  $('heroButton').addEventListener('click', () => {
    const target = appearance.hero_button_target;
    if (target === 'whatsapp' && digits(store.whatsapp)) return window.open(`https://wa.me/${digits(store.whatsapp)}`, '_blank', 'noopener');
    if (target && target.startsWith('http')) return window.open(target, '_blank', 'noopener');
    $('catalog').scrollIntoView({ behavior:'smooth' });
  });
  $('headerSearchButton').addEventListener('click', () => { $('catalog').scrollIntoView({ behavior:'smooth' }); setTimeout(() => $('searchInput').focus(), 500); });
  for (const id of ['headerCartButton','floatingCart']) $(id).addEventListener('click', openCart);
  $$('[data-close-cart]').forEach((element) => element.addEventListener('click', closeCart));
  $$('[data-close-product]').forEach((element) => element.addEventListener('click', closeProduct));
  $('continueShopping').addEventListener('click', () => { closeCart(); $('catalog').scrollIntoView({ behavior:'smooth' }); });
  $('decreaseProductQty').addEventListener('click', () => { selectedQuantity = Math.max(1, selectedQuantity - 1); updateModalTotal(); });
  $('increaseProductQty').addEventListener('click', () => { selectedQuantity += 1; updateModalTotal(); });
  $('addProductToCart').addEventListener('click', addCurrentProduct);
  $('paymentMethod').addEventListener('change', () => $('changeField').classList.toggle('is-hidden', $('paymentMethod').value !== 'cash'));
  $('checkoutButton').addEventListener('click', checkout);
  $('backToTop').addEventListener('click', () => scrollTo({ top:0, behavior:'smooth' }));
  addEventListener('scroll', () => { if (appearance.show_back_to_top) $('backToTop').classList.toggle('is-hidden', scrollY < 600); });
  addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeProduct(); closeCart(); } });
}

async function load() {
  try {
    const slug = slugFromUrl();
    if (!slug || slug === 'loja') return showFatal('Endereço incompleto', 'Informe o endereço público da loja.');
    const { data: storeData, error: storeError } = await db.from('stores').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
    if (storeError) throw storeError;
    if (!storeData) return showFatal('Loja não encontrada', 'Esta loja não existe ou ainda não foi publicada.');
    store = storeData;
    const [{ data: categoryData, error: categoryError }, { data: productData, error: productError }] = await Promise.all([
      db.from('store_categories').select('*').eq('store_id', store.id).order('position'),
      db.from('store_products').select('*').eq('store_id', store.id).eq('active', true).order('position')
    ]);
    if (categoryError) throw categoryError;
    if (productError) throw productError;
    categories = categoryData || []; products = productData || [];
    const productIds = products.map((product) => product.id);
    if (productIds.length) {
      const { data: variationData, error: variationError } = await db.from('store_product_variations').select('*').in('product_id', productIds).order('position');
      if (variationError) throw variationError;
      variations = variationData || [];
    }
    applyAppearance(); renderHero(); renderStoreInformation(); renderCategories(); renderFeatured(); renderProducts(); renderPaymentMethods(); renderCart(); bindEvents(); setLoadingState(true);
  } catch (error) {
    console.error(error);
    showFatal('Não foi possível abrir a loja', error?.message || 'Tente novamente em alguns instantes.');
  }
}

load();
