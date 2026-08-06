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
  show_back_to_top:true, header_style:'transparent', header_position:'sticky', footer_style:'simple', footer_background:'accent', footer_text:'', show_social_links:true,
  social_instagram:'', social_facebook:'', social_tiktok:'', social_youtube:'', social_x:'', social_pinterest:'', floating_whatsapp:true, floating_cart:true, custom_css:'',
  banner_display_mode:'carousel', banner_autoplay:true, banner_autoplay_delay:5000, banner_loop:true, banner_arrows:true, banner_dots:true, banner_pause_interaction:true, banner_default_height:'medium', banner_transition:'slide',
  gallery_layout:'grid', gallery_columns:3, gallery_ratio:'square', gallery_gap:'medium', gallery_title:'Nossa galeria', gallery_subtitle:'', gallery_position:'after_products', gallery_lightbox:true, gallery_autoplay:false, gallery_loop:true
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
let banners = [];
let gallery = [];
let bannerTimers = [];
let galleryTimers = [];
let galleryAutoplayStoppedByUser = false;
let galleryLightboxIndex = 0;

let cart = [];

function cartStorageKey() {
  const storeIdentifier =
    store?.id ||
    store?.slug ||
    slugFromUrl() ||
    'unknown-store';

  return `clena_cart_${storeIdentifier}`;
}

function saveCart() {
  if (!store) return;

  try {
    const serializedCart = cart.map((item) => ({
      product_id: item.product?.id || null,
      variation_id: item.variation?.id || null,
      note: String(item.note || '').slice(0, 240),
      quantity: Math.max(1, Number(item.quantity || 1))
    }));

    localStorage.setItem(
      cartStorageKey(),
      JSON.stringify(serializedCart)
    );
  } catch (error) {
    console.warn('Não foi possível salvar o carrinho.', error);
  }
}

function restoreCart() {
  cart = [];

  if (!store) return;

  try {
    const savedValue = localStorage.getItem(
      cartStorageKey()
    );

    if (!savedValue) return;

    const savedItems = JSON.parse(savedValue);

    if (!Array.isArray(savedItems)) {
      localStorage.removeItem(cartStorageKey());
      return;
    }

    cart = savedItems
      .map((savedItem) => {
        const product = products.find(
          (item) => item.id === savedItem.product_id
        );

        if (!product) return null;

        const variation = savedItem.variation_id
          ? variations.find(
              (item) =>
                item.id === savedItem.variation_id &&
                item.product_id === product.id
            ) || null
          : null;

        /*
         * Se a variação salva deixou de existir,
         * o item é descartado para não finalizar
         * com uma opção inválida.
         */
        if (savedItem.variation_id && !variation) {
          return null;
        }

        const note = String(savedItem.note || '')
          .trim()
          .slice(0, 240);

        const quantity = Math.max(
          1,
          Math.min(999, Number(savedItem.quantity || 1))
        );

        return {
          key: `${product.id}:${variation?.id || 'base'}:${note}`,
          product,
          variation,
          note,
          quantity
        };
      })
      .filter(Boolean);

    /*
     * Regrava o carrinhoT depois da validação.
     * Assim produtos removidos desta loja não permanecem salvos.
     */
    saveCart();
  } catch (error) {
    console.warn('Não foi possível restaurar o carrinho.', error);
    localStorage.removeItem(cartStorageKey());
    cart = [];
  }
}

let currentCategory = 'all';
let selectedProduct = null;
let selectedVariation = null;
let selectedQuantity = 1;
let selectedProductImages = [];
let selectedProductImageIndex = 0;
let productImageLightboxIndex = 0;

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

  appearance = {
    ...APPEARANCE_DEFAULTS,
    ...(store.appearance_settings || {}),
    cover_type:
      store.cover_type ||
      store.appearance_settings?.cover_type ||
      'image'
  };

  const coverHeights = {
    compact: '180px',
    medium: '320px',
    large: '480px',
    fullscreen: '100svh'
  };

  const radius = {
    none: '0px',
    small: '10px',
    medium: '18px',
    large: '28px'
  };

  const speed = {
    fast: '180ms',
    normal: '320ms',
    slow: '600ms'
  };

  const scale = {
    compact: '.92',
    small: '.92',
    normal: '1',
    large: '1.1'
  };

  root.style.setProperty(
    '--primary',
    store.primary_color || '#2563eb'
  );

  root.style.setProperty(
    '--accent',
    store.accent_color || '#0f172a'
  );

  root.style.setProperty(
    '--background',
    appearance.background_color || '#f6f8fc'
  );

  root.style.setProperty(
    '--card',
    appearance.card_color || '#ffffff'
  );

  root.style.setProperty(
    '--text',
    appearance.text_color || '#0f172a'
  );

  root.style.setProperty(
    '--muted',
    appearance.muted_color || '#64748b'
  );

  root.style.setProperty(
    '--body-font',
    `"${appearance.body_font || 'Manrope'}", sans-serif`
  );

  root.style.setProperty(
    '--heading-font',
    `"${appearance.heading_font || 'Manrope'}", sans-serif`
  );

  root.style.setProperty(
    '--heading-weight',
    appearance.heading_weight || '800'
  );

  root.style.setProperty(
    '--font-scale',
    scale[appearance.font_scale] || '1'
  );

  root.style.setProperty(
    '--columns',
    String(
      Math.max(
        2,
        Math.min(
          7,
          Number(appearance.desktop_columns || 3)
        )
      )
    )
  );

  root.style.setProperty(
    '--card-radius',
    radius[appearance.card_radius] || radius.large
  );

  root.style.setProperty(
    '--animation-speed',
    speed[appearance.animation_speed] || speed.normal
  );

  const selectedCoverHeight =
    coverHeights[appearance.cover_height] ||
    coverHeights.medium;

  root.style.setProperty(
    '--hero-height',
    selectedCoverHeight
  );

  root.style.setProperty(
    '--overlay-opacity',
    String(
      Number(appearance.cover_overlay || 0) / 100
    )
  );

  root.style.scrollBehavior =
    appearance.scroll_behavior === 'smooth'
      ? 'smooth'
      : 'auto';

  document.body.dataset.theme =
    appearance.theme || 'minimal';

  document.body.dataset.layout =
    store.product_layout || 'grid';

  document.body.dataset.imageRatio =
    appearance.product_image_ratio || 'square';

  document.body.dataset.cardRadius =
    appearance.card_radius || 'large';

  document.body.dataset.cardShadow =
    appearance.card_shadow || 'soft';

  document.body.dataset.productAlign =
    appearance.product_text_alignment || 'left';

  document.body.dataset.categoryStyle =
    appearance.category_style || 'pills';

  document.body.dataset.buttonStyle =
    appearance.button_style || 'rounded';

  document.body.dataset.buttonHover =
    appearance.button_hover || 'lift';

  document.body.dataset.pageAnimation =
    appearance.page_animation || 'fade';

  document.body.dataset.cardAnimation =
    appearance.card_animation || 'lift';

  document.body.dataset.headerStyle =
    appearance.header_style || 'transparent';

  document.body.dataset.headerPosition = 'sticky';

  document.body.dataset.footerStyle =
    appearance.footer_style || 'simple';

  document.body.dataset.footerBackground =
    appearance.footer_background || 'accent';

  document.body.dataset.coverHeight =
    appearance.cover_height || 'medium';

  const themeMeta = $('themeColorMeta');

  if (themeMeta) {
    themeMeta.content =
      appearance.background_color ||
      store.primary_color ||
      '#f6f8fc';
  }

  const customCss = $('customStoreCss');

  if (customCss) {
    customCss.textContent = String(
      appearance.custom_css || ''
    ).slice(0, 12000);
  }

  if (
    appearance.respect_reduced_motion &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    document.body.classList.add('reduce-motion');
  } else {
    document.body.classList.remove('reduce-motion');
  }

  $('searchArea')?.classList.toggle(
    'is-hidden',
    !appearance.show_search
  );

  $('categoryBarWrap')?.classList.toggle(
    'is-sticky',
    Boolean(appearance.sticky_categories)
  );

  $('featuredSection')?.classList.toggle(
    'is-hidden',
    !appearance.show_featured ||
      !products.some((product) => product.featured)
  );

  $('siteFooter')?.classList.toggle(
    'is-hidden',
    appearance.footer_style === 'hidden'
  );

  $('floatingWhatsapp')?.classList.toggle(
    'is-hidden',
    !appearance.floating_whatsapp ||
      !digits(store.whatsapp)
  );

  $('floatingCart')?.classList.toggle(
    'is-hidden',
    !appearance.floating_cart ||
      store.checkout_mode === 'catalog_only'
  );

  $('headerCartButton')?.classList.remove('is-hidden');

  $('backToTop')?.classList.toggle(
    'enabled',
    Boolean(appearance.show_back_to_top)
  );
}




function renderHero() {
  const hero = $('hero');
  const media = $('heroMedia');

  if (!hero || !media) return;

  media.innerHTML = '';
  media.classList.remove('gradient-fallback');

  media.style.backgroundImage = '';
  media.style.backgroundSize =
    appearance.cover_fit || 'cover';

  media.style.backgroundPosition =
    appearance.cover_position || 'center';

  /*
   * Garante que a altura escolhida no editor
   * seja aplicada diretamente na capa.
   */
  const coverHeights = {
    compact: '180px',
    medium: '320px',
    large: '480px',
    fullscreen: '100svh'
  };

  const selectedHeight =
    coverHeights[appearance.cover_height] ||
    coverHeights.medium;

  hero.style.height = selectedHeight;
  hero.style.minHeight = '0';
  hero.style.maxHeight = selectedHeight;

  if (appearance.cover_type === 'video') {
    const source =
      appearance.cover_video_external_url ||
      store.cover_video_url;

    if (source) {
      const video = document.createElement('video');

      video.src = source;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';

      video.style.width = '100%';
      video.style.height = '100%';
      video.style.display = 'block';

      video.style.objectFit =
        appearance.cover_fit || 'cover';

      video.style.objectPosition =
        appearance.cover_position || 'center';

      media.appendChild(video);
    } else {
      media.classList.add('gradient-fallback');
    }
  } else if (appearance.cover_type === 'gradient') {
    media.classList.add('gradient-fallback');
  } else if (store.banner_url) {
    const safeBannerUrl = String(store.banner_url)
      .replace(/"/g, '%22');

    media.style.backgroundImage =
      `url("${safeBannerUrl}")`;
  } else {
    media.classList.add('gradient-fallback');
  }

  /*
   * Remove da capa:
   * - logo grande;
   * - LOJA ONLINE;
   * - nome grande;
   * - selo grande;
   * - descrição;
   * - botão Ver produtos;
   * - botão WhatsApp.
   *
   * O cabeçalho superior permanece normal.
   */
  const heroContent = hero.querySelector(
    '.hero-content'
  );

  if (heroContent) {
    heroContent.classList.add('is-hidden');
    heroContent.setAttribute(
      'aria-hidden',
      'true'
    );
  }

  hero.dataset.align =
    appearance.hero_alignment || 'left';

  /*
   * Mantém somente a logo pequena do cabeçalho
   * e a logo do rodapé.
   */
  const headerLogo = $('headerLogo');

  if (headerLogo) {
    setLogo(
      headerLogo,
      store.logo_url,
      appearance.logo_shape
    );
  }

  const footerLogo = $('footerLogo');

  if (footerLogo) {
    setLogo(
      footerLogo,
      store.logo_url,
      appearance.logo_shape
    );
  }
}





function setLogo(element, url, shape) {
  element.dataset.shape = shape || 'rounded';
  element.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="Logo de ${escapeHtml(store.name)}">` : '<i class="ri-store-2-line"></i>';
}

function renderStoreInformation() {
  const verified = store.is_verified === true;
  $('headerVerified')?.classList.toggle('is-hidden', !verified);
  $('heroVerified')?.classList.toggle('is-hidden', !verified);
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
  updateHeroSocialVisibility();
  $('footerSocialColumn').classList.toggle('is-hidden', !appearance.show_social_links || !links.length);
}


function safeUrl(url) {
  try { const parsed = new URL(url, location.origin); return ['http:','https:'].includes(parsed.protocol) ? parsed.href : ''; } catch { return ''; }
}

function mediaObjectPosition(item) {
  return `${item.object_x || 'center'} ${item.object_y || 'center'}`;
}

function resolveContentLink(item) {
  const type = item.link_type || 'none';
  const value = String(item.link_value || '').trim();
  if (type === 'external') return safeUrl(value);
  if (type === 'whatsapp') {
    const number = digits(value || store.whatsapp);
    return number ? `https://wa.me/${number}` : '';
  }
  if (type === 'product') return value ? `#product-${encodeURIComponent(value)}` : '#catalog';
  if (type === 'category') return value ? `#category-${encodeURIComponent(value)}` : '#catalog';
  return '';
}

function followContentLink(item) {
  if (!item) return;
  const type = item.link_type || 'none';
  const value = String(item.link_value || '').trim();
  if (type === 'product') {
    const found = products.find(p => p.id === value || p.slug === value || p.name === value);
    if (found) return openProduct(found.id);
  }
  if (type === 'category') {
    const found = categories.find(c => c.id === value || c.name === value);
    if (found) {
      currentCategory = found.id;
      renderCategories(); renderProducts();
      document.querySelector('#catalog')?.scrollIntoView({behavior:'smooth'});
      return;
    }
  }
  const url = resolveContentLink(item);
  if (!url) return;
  if (item.link_target === 'new') window.open(url, '_blank', 'noopener'); else location.href = url;
}

function bannerMedia(item) {
  const style = `object-fit:${item.fit || 'cover'};object-position:${mediaObjectPosition(item)}`;
  return item.media_type === 'video'
    ? `<video src="${escapeHtml(item.media_url)}" autoplay muted loop playsinline preload="metadata" style="${style}"></video>`
    : `<img src="${escapeHtml(item.media_url)}" alt="${escapeHtml(item.title || 'Banner')}" loading="lazy" style="${style}">`;
}

function bannerSlide(item, index) {
  const hasAction = item.link_type && item.link_type !== 'none';
  return `<article class="promo-banner banner-height-${escapeHtml(item.height || appearance.banner_default_height || 'medium')}" data-banner-index="${index}" data-device="${escapeHtml(item.device || 'all')}" style="--banner-overlay:${Math.max(0,Math.min(100,Number(item.overlay||0)))/100};--banner-align:${escapeHtml(item.text_align || 'left')}">
    <div class="promo-banner-media">${bannerMedia(item)}</div><div class="promo-banner-overlay"></div>
    <div class="promo-banner-copy"><div>${item.title ? `<h2>${escapeHtml(item.title)}</h2>` : ''}${item.subtitle ? `<p>${escapeHtml(item.subtitle)}</p>` : ''}${hasAction ? `<button type="button" class="primary-button promo-banner-button" data-content-action="banner" data-content-id="${escapeHtml(item.id)}">${escapeHtml(item.button_text || 'Saiba mais')} <i class="ri-arrow-right-line"></i></button>` : ''}</div></div>
  </article>`;
}

function clearBannerTimers() { bannerTimers.forEach(clearInterval); bannerTimers = []; }

function initializeBannerCarousel(root) {
  if (!root) return;

  const track = root.querySelector('.banner-slides');
  const slides = $$('.promo-banner', track || root);
  const dots = $$('.banner-dot', root);

  if (!track || slides.length < 2) return;

  let current = 0;
  let autoplayTimer = null;
  let stoppedByUser = false;

  const normalizeIndex = (index) => {
    if (appearance.banner_loop) {
      return (index + slides.length) % slides.length;
    }

    return Math.max(0, Math.min(slides.length - 1, index));
  };

  const scrollToIndex = (index, behavior = 'smooth') => {
    current = normalizeIndex(index);
    const slide = slides[current];
    if (!slide) return;

    track.scrollTo({
      left: Math.max(0, slide.offsetLeft - track.offsetLeft),
      behavior
    });

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle('is-active', dotIndex === current);
    });
  };

  const stopAutoplay = () => {
    stoppedByUser = true;
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  };

  root.querySelector('[data-banner-prev]')?.addEventListener('click', () => {
    stopAutoplay();
    scrollToIndex(current - 1);
  });

  root.querySelector('[data-banner-next]')?.addEventListener('click', () => {
    stopAutoplay();
    scrollToIndex(current + 1);
  });

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      stopAutoplay();
      scrollToIndex(index);
    });
  });

  if (appearance.banner_pause_interaction) {
    ['pointerdown', 'touchstart', 'wheel'].forEach((eventName) => {
      track.addEventListener(eventName, stopAutoplay, { passive: true });
    });
  }

  track.addEventListener('scroll', () => {
    window.requestAnimationFrame(() => {
      const reference = track.scrollLeft + 8;
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      slides.forEach((slide, index) => {
        const distance = Math.abs(slide.offsetLeft - reference);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      current = nearestIndex;
      dots.forEach((dot, index) => {
        dot.classList.toggle('is-active', index === current);
      });
    });
  }, { passive: true });

  scrollToIndex(0, 'auto');

  if (appearance.banner_autoplay) {
    autoplayTimer = setInterval(() => {
      if (document.hidden || stoppedByUser) return;
      scrollToIndex(current + 1);
    }, Math.max(2000, Number(appearance.banner_autoplay_delay || 5000)));

    bannerTimers.push(autoplayTimer);
  }
}

function renderBanners() {
  clearBannerTimers();
  const placements = ['after_hero','before_categories','after_categories','before_products','after_products','before_footer'];
  placements.forEach((placement) => {
    const slot = $(`slot-${placement}`); if (!slot) return;
    const items = banners.filter(b => b.placement === placement && b.active !== false);
    if (!items.length) { slot.innerHTML=''; slot.classList.remove('has-content'); return; }
    const mode = appearance.banner_display_mode || 'carousel';
    const content = items.map((item,index)=>bannerSlide(item,index)).join('');
    if (mode === 'grid') {
      slot.innerHTML = `<section class="banner-section banner-grid">${content}</section>`;
    } else if (mode === 'single') {
      slot.innerHTML = `<section class="banner-section banner-single">${bannerSlide(items[0],0)}</section>`;
    } else {
      slot.innerHTML = `<section class="banner-section banner-carousel transition-${escapeHtml(appearance.banner_transition || 'slide')}"><div class="banner-slides">${content}</div>${appearance.banner_arrows && items.length>1 ? '<button class="banner-arrow banner-prev" data-banner-prev aria-label="Anterior"><i class="ri-arrow-left-s-line"></i></button><button class="banner-arrow banner-next" data-banner-next aria-label="Próximo"><i class="ri-arrow-right-s-line"></i></button>' : ''}${appearance.banner_dots && items.length>1 ? `<div class="banner-dots">${items.map((_,i)=>`<button class="banner-dot" aria-label="Banner ${i+1}"></button>`).join('')}</div>` : ''}</section>`;
      initializeBannerCarousel(slot.querySelector('.banner-carousel'));
    }
    slot.classList.add('has-content');
  });
  $$('[data-content-action="banner"]').forEach(button=>button.addEventListener('click',()=>followContentLink(banners.find(item=>item.id===button.dataset.contentId))));
}

function galleryMedia(item, index) {
  const style = `object-fit:${item.fit || 'cover'};object-position:${mediaObjectPosition(item)}`;
  const media = item.media_type === 'video'
    ? `<video src="${escapeHtml(item.media_url)}" muted loop playsinline preload="metadata" style="${style}"></video><span class="gallery-video-icon"><i class="ri-play-fill"></i></span>`
    : `<img src="${escapeHtml(item.media_url)}" alt="${escapeHtml(item.title || 'Galeria')}" loading="lazy" style="${style}">`;
  return `<article class="gallery-item" data-gallery-index="${index}" tabindex="0"><div class="gallery-media">${media}</div>${item.title || item.description ? `<div class="gallery-item-copy">${item.title?`<h3>${escapeHtml(item.title)}</h3>`:''}${item.description?`<p>${escapeHtml(item.description)}</p>`:''}</div>`:''}</article>`;
}

function clearGalleryTimers() {
  galleryTimers.forEach((timer) => clearInterval(timer));
  galleryTimers = [];
}

function stopGalleryAutoplay(section = null) {
  galleryAutoplayStoppedByUser = true;
  clearGalleryTimers();
  section?.classList.add('is-user-controlled');
}

function getGalleryItems(track) {
  return $$('.gallery-item', track).filter((item) => item.offsetWidth > 0 && item.offsetHeight > 0);
}

function getNearestGalleryIndex(track, items) {
  if (!items.length) return 0;

  const trackCenter =
    track.scrollLeft +
    track.clientWidth / 2;

  let nearestIndex = 0;
  let nearestDistance = Infinity;

  items.forEach((item, index) => {
    const itemCenter =
      item.offsetLeft +
      item.offsetWidth / 2;

    const distance = Math.abs(
      itemCenter - trackCenter
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function scrollGalleryToIndex(
  track,
  index,
  behavior = 'smooth'
) {
  const items = getGalleryItems(track);

  if (!items.length) return;

  const safeIndex = Math.max(
    0,
    Math.min(items.length - 1, index)
  );

  const target = items[safeIndex];

  const left =
    target.offsetLeft -
    (track.clientWidth - target.offsetWidth) / 2;

  track.scrollTo({
    left: Math.max(0, left),
    behavior
  });
}



function updateGalleryCenterItem(track) {
  const items = getGalleryItems(track);

  if (!items.length) return;

  const centerIndex =
    getNearestGalleryIndex(track, items);

  items.forEach((item, index) => {
    item.classList.toggle(
      'is-center',
      index === centerIndex
    );
  });
}

function moveGalleryCarousel(section, direction, userInitiated = true) {
  const track = section?.querySelector('.gallery-track');
  if (!track) return;

  const items = getGalleryItems(track);
  if (items.length < 2) return;

  if (userInitiated) stopGalleryAutoplay(section);

  const current = getNearestGalleryIndex(track, items);
  let next = current + direction;

  if (next >= items.length) {
    next = appearance.gallery_loop ? 0 : items.length - 1;
  } else if (next < 0) {
    next = appearance.gallery_loop ? items.length - 1 : 0;
  }

  scrollGalleryToIndex(track, next);
}

function initializeGalleryCarousel(section) {
  const track = section?.querySelector('.gallery-track');
  if (!track) return;

  const items = getGalleryItems(track);


  let galleryScrollFrame = null;

const refreshCenterItem = () => {
  if (galleryScrollFrame) {
    cancelAnimationFrame(galleryScrollFrame);
  }

  galleryScrollFrame =
    requestAnimationFrame(() => {
      updateGalleryCenterItem(track);
      galleryScrollFrame = null;
    });
};

track.addEventListener(
  'scroll',
  refreshCenterItem,
  {
    passive: true
  }
);

window.addEventListener(
  'resize',
  refreshCenterItem,
  {
    passive: true
  }
);
  if (items.length < 2) return;

  const stopByInteraction = () => stopGalleryAutoplay(section);

  track.addEventListener('pointerdown', stopByInteraction, { passive: true });
  track.addEventListener('touchstart', stopByInteraction, { passive: true });
  track.addEventListener('wheel', stopByInteraction, { passive: true });

  section.querySelector('.gallery-scroll-prev')?.addEventListener('click', () => {
    moveGalleryCarousel(section, -1, true);
  });

  section.querySelector('.gallery-scroll-next')?.addEventListener('click', () => {
    moveGalleryCarousel(section, 1, true);
  });

requestAnimationFrame(() => {
  scrollGalleryToIndex(
    track,
    items.length >= 2 ? 1 : 0,
    'auto'
  );

  updateGalleryCenterItem(track);
});



  if (appearance.gallery_autoplay && !galleryAutoplayStoppedByUser) {
    const timer = setInterval(() => {
      if (document.hidden || galleryAutoplayStoppedByUser) return;
      moveGalleryCarousel(section, 1, false);
    }, 5000);

    galleryTimers.push(timer);
  }
}

function renderGallery() {
  clearGalleryTimers();
  $$('.gallery-section').forEach((element) => element.remove());
  if (!gallery.length) return;

  const placement = appearance.gallery_position || 'after_products';
  const slot = $(`slot-${placement}`) || $('slot-after_products');
  if (!slot) return;

  const section = document.createElement('section');
  const layout = appearance.gallery_layout || 'grid';
  const supportsNavigation = ['carousel', 'horizontal', 'stories'].includes(layout);

  section.className = `gallery-section gallery-layout-${layout} gallery-gap-${appearance.gallery_gap || 'medium'} gallery-ratio-${appearance.gallery_ratio || 'square'}`;
  section.style.setProperty('--gallery-columns', String(Math.max(2, Math.min(5, Number(appearance.gallery_columns || 3)))));

  section.innerHTML = `
    <div class="gallery-heading">
      ${appearance.gallery_title ? `<h2>${escapeHtml(appearance.gallery_title)}</h2>` : ''}
      ${appearance.gallery_subtitle ? `<p>${escapeHtml(appearance.gallery_subtitle)}</p>` : ''}
    </div>
    <div class="gallery-track" ${layout === 'carousel' ? 'data-gallery-carousel="true"' : ''}>
      ${gallery.map(galleryMedia).join('')}
    </div>
    ${supportsNavigation && gallery.length > 1 ? `
      <button class="gallery-scroll gallery-scroll-prev" type="button" aria-label="Foto anterior"><i class="ri-arrow-left-s-line"></i></button>
      <button class="gallery-scroll gallery-scroll-next" type="button" aria-label="Próxima foto"><i class="ri-arrow-right-s-line"></i></button>
    ` : ''}
  `;

  slot.appendChild(section);
  slot.classList.add('has-content');

  const track = section.querySelector('.gallery-track');

  if (layout === 'carousel') {
    initializeGalleryCarousel(section);
  } else if (supportsNavigation) {
    section.querySelector('.gallery-scroll-prev')?.addEventListener('click', () => {
      stopGalleryAutoplay(section);
      track.scrollBy({ left: -track.clientWidth * .8, behavior: 'smooth' });
    });

    section.querySelector('.gallery-scroll-next')?.addEventListener('click', () => {
      stopGalleryAutoplay(section);
      track.scrollBy({ left: track.clientWidth * .8, behavior: 'smooth' });
    });
  }

  $$('.gallery-item', section).forEach((item) => {
    const open = () => {
      stopGalleryAutoplay(section);
      const index = Number(item.dataset.galleryIndex);

      if (appearance.gallery_lightbox) openGalleryLightbox(index);
      else followContentLink(gallery[index]);
    };

    item.addEventListener('click', open);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });

  if (appearance.gallery_autoplay && !galleryAutoplayStoppedByUser && ['horizontal', 'stories'].includes(layout)) {
    const timer = setInterval(() => {
      if (document.hidden || galleryAutoplayStoppedByUser) return;

      const reachedEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 10;
      if (reachedEnd && appearance.gallery_loop) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else if (!reachedEnd) {
        track.scrollBy({ left: track.clientWidth * .75, behavior: 'smooth' });
      }
    }, 5000);

    galleryTimers.push(timer);
  }
}

function renderGalleryLightbox() {
  const item = gallery[galleryLightboxIndex]; if (!item) return;
  const media = $('galleryLightboxMedia');
  media.innerHTML = item.media_type === 'video' ? `<video src="${escapeHtml(item.media_url)}" controls autoplay playsinline></video>` : `<img src="${escapeHtml(item.media_url)}" alt="${escapeHtml(item.title || 'Galeria')}">`;
  $('galleryLightboxTitle').textContent = item.title || '';
  $('galleryLightboxDescription').textContent = item.description || '';
  $('galleryLightboxTitle').classList.toggle('is-hidden',!item.title);
  $('galleryLightboxDescription').classList.toggle('is-hidden',!item.description);
  const copy=$('galleryLightboxDescription').parentElement;
  copy.querySelector('.gallery-lightbox-action')?.remove();
  if(item.link_type && item.link_type!=='none'){const btn=document.createElement('button');btn.type='button';btn.className='primary-button gallery-lightbox-action';btn.innerHTML='Saiba mais <i class="ri-arrow-right-line"></i>';btn.addEventListener('click',()=>followContentLink(item));copy.appendChild(btn);}
}
function openGalleryLightbox(index) {
  galleryAutoplayStoppedByUser = true;
  clearGalleryTimers();
  galleryLightboxIndex = index;
  renderGalleryLightbox();
  $('galleryLightbox').classList.remove('is-hidden');
  document.body.classList.add('no-scroll');
}
function closeGalleryLightbox() { $('galleryLightbox').classList.add('is-hidden'); $('galleryLightboxMedia').innerHTML=''; document.body.classList.remove('no-scroll'); }
function moveGalleryLightbox(direction) { galleryLightboxIndex=(galleryLightboxIndex+direction+gallery.length)%gallery.length; renderGalleryLightbox(); }

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



function normalizeProductImageEntry(entry) {
  if (!entry) return '';

  if (typeof entry === 'string') {
    return safeUrl(entry);
  }

  if (typeof entry === 'object') {
    return safeUrl(
      entry.url ||
      entry.image_url ||
      entry.src ||
      entry.public_url ||
      ''
    );
  }

  return '';
}

function productImages(product) {
  if (!product) return [];

  const candidates = [
    product.image_url,
    ...(Array.isArray(product.image_urls) ? product.image_urls : []),
    ...(Array.isArray(product.images) ? product.images : []),
    ...(Array.isArray(product.gallery_images) ? product.gallery_images : []),
    ...(Array.isArray(product.product_images) ? product.product_images : [])
  ];

  const unique = [];

  candidates.forEach((entry) => {
    const url = normalizeProductImageEntry(entry);

    if (url && !unique.includes(url)) {
      unique.push(url);
    }
  });

  return unique;
}

function renderProductImageGallery() {
  const main = $('productModalImage');
  const thumbnails = $('productImageThumbnails');

  if (!main || !thumbnails) return;

  const currentUrl =
    selectedProductImages[selectedProductImageIndex] ||
    '';

  main.innerHTML = currentUrl
    ? `
      <img
        src="${escapeHtml(currentUrl)}"
        alt="${escapeHtml(selectedProduct?.name || 'Produto')}"
      >
      <span class="product-image-zoom-hint">
        <i class="ri-zoom-in-line"></i>
        Ampliar
      </span>
    `
    : '<span><i class="ri-image-line"></i></span>';

  main.disabled = !currentUrl;

  thumbnails.classList.toggle(
    'is-hidden',
    selectedProductImages.length <= 1
  );

  thumbnails.innerHTML = selectedProductImages
    .map((url, index) => `
      <button
        type="button"
        class="product-image-thumbnail ${index === selectedProductImageIndex ? 'is-active' : ''}"
        data-product-image-index="${index}"
        aria-label="Ver foto ${index + 1}"
        aria-current="${index === selectedProductImageIndex ? 'true' : 'false'}"
      >
        <img
          src="${escapeHtml(url)}"
          alt=""
          loading="lazy"
        >
      </button>
    `)
    .join('');

  $$('[data-product-image-index]', thumbnails).forEach((button) => {
    button.addEventListener('click', () => {
      selectedProductImageIndex = Number(
        button.dataset.productImageIndex
      );

      renderProductImageGallery();
    });
  });
}

function renderProductImageLightbox() {
  const media = $('productImageLightboxMedia');
  const counter = $('productImageLightboxCounter');

  if (!media) return;

  const url =
    selectedProductImages[productImageLightboxIndex] ||
    '';

  media.innerHTML = url
    ? `
      <img
        src="${escapeHtml(url)}"
        alt="${escapeHtml(selectedProduct?.name || 'Produto')}"
      >
    `
    : '';

  if (counter) {
    counter.textContent = selectedProductImages.length > 1
      ? `${productImageLightboxIndex + 1} / ${selectedProductImages.length}`
      : '';
  }

  const hasMany = selectedProductImages.length > 1;

  $('productImageLightboxPrev')?.classList.toggle(
    'is-hidden',
    !hasMany
  );

  $('productImageLightboxNext')?.classList.toggle(
    'is-hidden',
    !hasMany
  );
}

function openProductImageLightbox(index = selectedProductImageIndex) {
  if (!selectedProductImages.length) return;

  productImageLightboxIndex = Math.max(
    0,
    Math.min(selectedProductImages.length - 1, Number(index || 0))
  );

  renderProductImageLightbox();

  $('productImageLightbox')?.classList.remove('is-hidden');
  document.body.classList.add('no-scroll');
}

function closeProductImageLightbox() {
  $('productImageLightbox')?.classList.add('is-hidden');

  if ($('productImageLightboxMedia')) {
    $('productImageLightboxMedia').innerHTML = '';
  }

  if (
    $('productModal') &&
    !$('productModal').classList.contains('is-hidden')
  ) {
    document.body.classList.add('no-scroll');
  } else {
    document.body.classList.remove('no-scroll');
  }
}

function moveProductImageLightbox(direction) {
  if (selectedProductImages.length < 2) return;

  productImageLightboxIndex =
    (
      productImageLightboxIndex +
      direction +
      selectedProductImages.length
    ) % selectedProductImages.length;

  selectedProductImageIndex = productImageLightboxIndex;
  renderProductImageLightbox();
  renderProductImageGallery();
}

function isProductUnavailable(product) {
  return product.stock_mode === 'out' ||
    (product.stock_mode === 'controlled' && Number(product.stock || 0) <= 0);
}

function getRecommendedProducts(product, limit = 6) {
  if (!product) return [];

  const available = products.filter((item) =>
    item.id !== product.id &&
    item.active !== false &&
    !isProductUnavailable(item)
  );

  const sameCategory = available
    .filter((item) => item.category_id && item.category_id === product.category_id)
    .sort((a, b) =>
      Number(b.featured) - Number(a.featured) ||
      Number(a.position || 0) - Number(b.position || 0)
    );

  const otherCategories = available
    .filter((item) => !sameCategory.some((same) => same.id === item.id))
    .sort((a, b) =>
      Number(b.featured) - Number(a.featured) ||
      Number(a.position || 0) - Number(b.position || 0)
    );

  return [...sameCategory, ...otherCategories].slice(0, limit);
}

function recommendationCard(product) {
  const category = categories.find((item) => item.id === product.category_id);
  const sale = hasSale(product);
  const image = product.image_url
    ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy">`
    : '<span class="recommendation-placeholder"><i class="ri-image-line"></i></span>';

  return `
    <button class="recommendation-card" type="button" data-recommended-product="${escapeHtml(product.id)}" aria-label="Ver ${escapeHtml(product.name)}">
      <span class="recommendation-image">
        ${image}
        ${sale ? '<b class="recommendation-sale">OFERTA</b>' : ''}
      </span>
      <span class="recommendation-content">
        ${category ? `<small>${escapeHtml(category.name)}</small>` : ''}
        <strong>${escapeHtml(product.name)}</strong>
        <span class="recommendation-price">
          ${sale ? `<del>${money(product.price)}</del>` : ''}
          <b>${money(productPrice(product))}</b>
        </span>
      </span>
      <i class="ri-arrow-right-up-line recommendation-arrow" aria-hidden="true"></i>
    </button>
  `;
}

function renderProductRecommendations(product) {
  const section = $('productRecommendationsSection');
  const container = $('productRecommendations');

  if (!section || !container) return;

  const recommendations = getRecommendedProducts(product, 6);
  section.classList.toggle('is-hidden', recommendations.length === 0);
  container.innerHTML = recommendations.map(recommendationCard).join('');

  $$('[data-recommended-product]', container).forEach((button) => {
    button.addEventListener('click', () => {
      openProduct(button.dataset.recommendedProduct);
      const modalCard = $('productModal')?.querySelector('.product-modal-card');
      if (modalCard) modalCard.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
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
  selectedProductImages = productImages(selectedProduct);
  selectedProductImageIndex = 0;
  productImageLightboxIndex = 0;
  renderProductImageGallery();
  $('productModalPrice').innerHTML = hasSale(selectedProduct) ? `<small>${money(selectedProduct.price)}</small><strong>${money(productPrice(selectedProduct))}</strong>` : `<strong>${money(selectedProduct.price)}</strong>`;
  const options = variations.filter((variation) => variation.product_id === id).sort((a,b) => a.position - b.position);
  $('variationArea').classList.toggle('is-hidden', !options.length);
  $('variationOptions').innerHTML = options.map((variation, index) => `<label class="variation-option"><input type="radio" name="productVariation" value="${variation.id}" ${index === 0 ? 'checked' : ''}><span><b>${escapeHtml(variation.name)}</b><small>${Number(variation.price_adjustment || 0) ? `+ ${money(variation.price_adjustment)}` : 'Sem acréscimo'}</small></span><i class="ri-check-line"></i></label>`).join('');
  if (options.length) selectedVariation = options[0];
  $$('input[name="productVariation"]', $('variationOptions')).forEach((input) => input.addEventListener('change', () => { selectedVariation = options.find((item) => item.id === input.value); updateModalTotal(); }));
  updateModalTotal();
  renderProductRecommendations(selectedProduct);

  const modalCard = $('productModal')?.querySelector('.product-modal-card');
  if (modalCard) modalCard.scrollTop = 0;

  $('productModal').classList.remove('is-hidden');
  document.body.classList.add('no-scroll');
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
  saveCart();

  const count = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  if ($('headerCartCount')) {
    $('headerCartCount').textContent = count;
  }

  if ($('floatingCartCount')) {
    $('floatingCartCount').textContent = count;
  }

  const cartItems = $('cartItems');

  if (cartItems) {
    cartItems.innerHTML = cart.map((item, index) => `
      <article class="cart-item">
        <div class="cart-item-image">
          ${
            item.product.image_url
              ? `<img src="${escapeHtml(item.product.image_url)}" alt="${escapeHtml(item.product.name)}">`
              : '<i class="ri-image-line"></i>'
          }
        </div>

        <div class="cart-item-content">
          <div class="cart-item-head">
            <div>
              <h3>${escapeHtml(item.product.name)}</h3>
              ${
                item.variation
                  ? `<p>${escapeHtml(item.variation.name)}</p>`
                  : ''
              }
              ${
                item.note
                  ? `<small>Obs.: ${escapeHtml(item.note)}</small>`
                  : ''
              }
            </div>

            <button
              type="button"
              data-remove-cart="${index}"
              aria-label="Remover"
            >
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>

          <div class="cart-item-bottom">
            <div class="cart-qty">
              <button
                type="button"
                data-cart-delta="-1"
                data-cart-index="${index}"
              >−</button>

              <strong>${item.quantity}</strong>

              <button
                type="button"
                data-cart-delta="1"
                data-cart-index="${index}"
              >+</button>
            </div>

            <strong class="cart-item-total">
              ${money(cartItemUnit(item) * item.quantity)}
            </strong>
          </div>
        </div>
      </article>
    `).join('');
  }

  const empty = cart.length === 0;

  $('cartEmpty')?.classList.toggle(
    'is-hidden',
    !empty
  );

  $('checkoutFormArea')?.classList.toggle(
    'is-hidden',
    empty
  );

  $('cartFooter')?.classList.toggle(
    'is-hidden',
    empty
  );

  const total = cartTotal();

  if ($('cartSubtotal')) {
    $('cartSubtotal').textContent = money(total);
  }

  if ($('cartTotal')) {
    $('cartTotal').textContent = money(total);
  }

  const minimum = Number(store?.minimum_order || 0);
  const underMinimum =
    minimum > 0 &&
    total < minimum;

  $('minimumOrderRow')?.classList.toggle(
    'is-hidden',
    minimum <= 0
  );

  if ($('minimumOrderValue')) {
    $('minimumOrderValue').textContent = money(minimum);
  }

  $('minimumWarning')?.classList.toggle(
    'is-hidden',
    !underMinimum
  );

  if ($('minimumWarning')) {
    $('minimumWarning').textContent = underMinimum
      ? `Faltam ${money(minimum - total)} para atingir o pedido mínimo.`
      : '';
  }

  if ($('checkoutButton')) {
    $('checkoutButton').disabled = underMinimum;
  }

  $$('[data-cart-delta]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.cartIndex);
      const item = cart[index];

      if (!item) return;

      item.quantity += Number(button.dataset.cartDelta);

      if (item.quantity < 1) {
        cart.splice(index, 1);
      }

      renderCart();
    });
  });

  $$('[data-remove-cart]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.removeCart);

      if (!Number.isInteger(index) || !cart[index]) {
        return;
      }

      cart.splice(index, 1);
      renderCart();
    });
  });
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

function updateHeroSocialVisibility() {
  const socialContainer = $('socialLinks');
  const socialSection = $('heroSocialSection');

  if (!socialSection || !socialContainer) return;

  const hasLinks = socialContainer.querySelector('a') !== null;

  socialSection.classList.toggle(
    'is-hidden',
    !hasLinks
  );
}

function bindEvents() {
  $('searchInput')?.addEventListener('input', () => {
    const clearSearch = $('clearSearch');
    const searchInput = $('searchInput');

    clearSearch?.classList.toggle(
      'is-hidden',
      !searchInput?.value
    );

    renderProducts();
  });

  $('clearSearch')?.addEventListener('click', () => {
    const searchInput = $('searchInput');
    const clearSearch = $('clearSearch');

    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }

    clearSearch?.classList.add('is-hidden');
    renderProducts();
  });

  $('sortSelect')?.addEventListener(
    'change',
    renderProducts
  );

  $('resetFilters')?.addEventListener('click', () => {
    currentCategory = 'all';

    const searchInput = $('searchInput');

    if (searchInput) {
      searchInput.value = '';
    }

    renderCategories();
    renderProducts();
  });

  $('viewAllProducts')?.addEventListener('click', () => {
    $('catalog')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });

  $('heroButton')?.addEventListener('click', () => {
    const target = appearance.hero_button_target;

    if (
      target === 'whatsapp' &&
      digits(store.whatsapp)
    ) {
      window.open(
        `https://wa.me/${digits(store.whatsapp)}`,
        '_blank',
        'noopener'
      );

      return;
    }

    if (
      target &&
      target.startsWith('http')
    ) {
      window.open(
        target,
        '_blank',
        'noopener'
      );

      return;
    }

    $('catalog')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });

  $('headerSearchButton')?.addEventListener(
    'click',
    () => {
      $('catalog')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      setTimeout(() => {
        $('searchInput')?.focus();
      }, 500);
    }
  );

  [
    'headerCartButton',
    'floatingCart'
  ].forEach((id) => {
    $(id)?.addEventListener(
      'click',
      openCart
    );
  });

  $$('[data-close-cart]').forEach((element) => {
    element.addEventListener(
      'click',
      closeCart
    );
  });

  $$('[data-close-product]').forEach((element) => {
    element.addEventListener(
      'click',
      closeProduct
    );
  });

  $('continueShopping')?.addEventListener(
    'click',
    () => {
      closeCart();

      $('catalog')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  );

  $('decreaseProductQty')?.addEventListener(
    'click',
    () => {
      selectedQuantity = Math.max(
        1,
        selectedQuantity - 1
      );

      updateModalTotal();
    }
  );

  $('increaseProductQty')?.addEventListener(
    'click',
    () => {
      selectedQuantity += 1;
      updateModalTotal();
    }
  );

  $('addProductToCart')?.addEventListener(
    'click',
    addCurrentProduct
  );

  $('paymentMethod')?.addEventListener(
    'change',
    () => {
      const paymentMethod = $('paymentMethod');

      $('changeField')?.classList.toggle(
        'is-hidden',
        paymentMethod?.value !== 'cash'
      );
    }
  );

  $('checkoutButton')?.addEventListener(
    'click',
    checkout
  );

  $('backToTop')?.addEventListener(
    'click',
    () => {
      scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  );

  addEventListener(
    'scroll',
    () => {
      if (!appearance.show_back_to_top) {
        return;
      }

      $('backToTop')?.classList.toggle(
        'is-hidden',
        scrollY < 600
      );
    },
    {
      passive: true
    }
  );

  $$('[data-close-gallery-lightbox]').forEach(
    (element) => {
      element.addEventListener(
        'click',
        closeGalleryLightbox
      );
    }
  );

  $('productModalImage')?.addEventListener(
    'click',
    () => openProductImageLightbox(selectedProductImageIndex)
  );

  $$('[data-close-product-image]').forEach((element) => {
    element.addEventListener(
      'click',
      closeProductImageLightbox
    );
  });

  $('productImageLightboxPrev')?.addEventListener(
    'click',
    () => moveProductImageLightbox(-1)
  );

  $('productImageLightboxNext')?.addEventListener(
    'click',
    () => moveProductImageLightbox(1)
  );

  $('galleryLightboxPrev')?.addEventListener(
    'click',
    () => moveGalleryLightbox(-1)
  );

  $('galleryLightboxNext')?.addEventListener(
    'click',
    () => moveGalleryLightbox(1)
  );

  addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeProduct();
      closeCart();
      closeGalleryLightbox();
    }

    const galleryLightbox = $('galleryLightbox');
    const galleryIsOpen =
      galleryLightbox &&
      !galleryLightbox.classList.contains('is-hidden');

    if (
      galleryIsOpen &&
      event.key === 'ArrowLeft'
    ) {
      moveGalleryLightbox(-1);
    }

    if (
      galleryIsOpen &&
      event.key === 'ArrowRight'
    ) {
      moveGalleryLightbox(1);
    }
  });
}




async function load() {
  try {
    const slug = slugFromUrl();

    if (!slug || slug === 'loja') {
      return showFatal(
        'Endereço incompleto',
        'Informe o endereço público da loja.'
      );
    }

    const {
      data: storeData,
      error: storeError
    } = await db
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (storeError) {
      throw storeError;
    }

    if (!storeData) {
      return showFatal(
        'Loja não encontrada',
        'Esta loja não existe ou ainda não foi publicada.'
      );
    }

    store = storeData;

    const [
      {
        data: categoryData,
        error: categoryError
      },
      {
        data: productData,
        error: productError
      },
      {
        data: bannerData,
        error: bannerError
      },
      {
        data: galleryData,
        error: galleryError
      }
    ] = await Promise.all([
      db
        .from('store_categories')
        .select('*')
        .eq('store_id', store.id)
        .order('position'),

      db
        .from('store_products')
        .select('*')
        .eq('store_id', store.id)
        .eq('active', true)
        .order('position'),

      db
        .from('store_banners')
        .select('*')
        .eq('store_id', store.id)
        .eq('active', true)
        .order('position'),

      db
        .from('store_gallery_items')
        .select('*')
        .eq('store_id', store.id)
        .eq('active', true)
        .order('position')
    ]);

    if (
      categoryError ||
      productError ||
      bannerError ||
      galleryError
    ) {
      throw (
        categoryError ||
        productError ||
        bannerError ||
        galleryError
      );
    }

    categories = categoryData || [];
    products = productData || [];

    banners = (bannerData || []).filter((item) => {
      const now = Date.now();

      return (
        (!item.starts_at ||
          new Date(item.starts_at).getTime() <= now) &&
        (!item.ends_at ||
          new Date(item.ends_at).getTime() >= now)
      );
    });

    gallery = galleryData || [];

    const productIds = products.map(
      (product) => product.id
    );

    if (productIds.length) {
      const {
        data: variationData,
        error: variationError
      } = await db
        .from('store_product_variations')
        .select('*')
        .in('product_id', productIds)
        .order('position');

      if (variationError) {
        throw variationError;
      }

      variations = variationData || [];
    }

    restoreCart();

    applyAppearance();
    renderHero();
    renderStoreInformation();
    renderCategories();
    renderFeatured();
    renderProducts();
    renderBanners();
    renderGallery();
    renderPaymentMethods();
    renderCart();
    bindEvents();
    setLoadingState(true);
  } catch (error) {
    console.error(error);

    showFatal(
      'Não foi possível abrir a loja',
      error?.message ||
        'Tente novamente em alguns instantes.'
    );
  }
}

/* =========================================================
   BLOQUEIO DE ZOOM PELO MOUSE E PELO TECLADO
   ========================================================= */

document.addEventListener(
  'wheel',
  (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
    }
  },
  {
    passive: false
  }
);

document.addEventListener('keydown', (event) => {
  const zoomKeys = [
    '+',
    '-',
    '=',
    '0'
  ];

  if (
    (event.ctrlKey || event.metaKey) &&
    zoomKeys.includes(event.key)
  ) {
    event.preventDefault();
  }
});

load();
