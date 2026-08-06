const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const APPEARANCE_DEFAULTS = {
  theme: 'minimal',
  cover_type: 'image',
  cover_video_external_url: '',
  cover_fit: 'cover',
  cover_position: 'center',
  cover_height: 'medium',
  cover_overlay: 35,
  logo_shape: 'rounded',
  hero_alignment: 'left',
  hero_title: '',
  hero_subtitle: '',
  hero_button_text: 'Ver produtos',
  hero_button_target: 'products',
  background_color: '#f6f8fc',
  card_color: '#ffffff',
  text_color: '#0f172a',
  muted_color: '#64748b',
  body_font: 'Manrope',
  heading_font: 'Manrope',
  heading_weight: '800',
  font_scale: 'normal',
  desktop_columns: 3,
  product_image_ratio: 'square',
  card_radius: 'large',
  card_shadow: 'soft',
  product_text_alignment: 'left',
  category_style: 'pills',
  show_search: true,
  sticky_categories: false,
  show_featured: true,
  show_sale_badge: true,
  show_product_description: true,
  button_style: 'rounded',
  button_hover: 'lift',
  page_animation: 'fade',
  card_animation: 'lift',
  animation_speed: 'normal',
  scroll_behavior: 'smooth',
  respect_reduced_motion: true,
  show_back_to_top: true,
  header_style: 'transparent',
  header_position: 'static',
  footer_style: 'simple',
  footer_background: 'accent',
  footer_text: '',
  show_social_links: true,
  social_instagram: '',
  social_facebook: '',
  social_tiktok: '',
  social_youtube: '',
  social_x: '',
  social_pinterest: '',
  floating_whatsapp: true,
  floating_cart: false,
  custom_css: ''
};

const fieldMap = {
  coverVideoExternalUrl: 'cover_video_external_url',
  coverFit: 'cover_fit',
  coverPosition: 'cover_position',
  coverHeight: 'cover_height',
  coverOverlay: 'cover_overlay',
  logoShape: 'logo_shape',
  heroAlignment: 'hero_alignment',
  heroTitle: 'hero_title',
  heroSubtitle: 'hero_subtitle',
  heroButtonText: 'hero_button_text',
  heroButtonTarget: 'hero_button_target',
  backgroundColorText: 'background_color',
  cardColorText: 'card_color',
  textColorText: 'text_color',
  mutedColorText: 'muted_color',
  bodyFont: 'body_font',
  headingFont: 'heading_font',
  headingWeight: 'heading_weight',
  fontScale: 'font_scale',
  desktopColumns: 'desktop_columns',
  productImageRatio: 'product_image_ratio',
  cardRadius: 'card_radius',
  cardShadow: 'card_shadow',
  productTextAlignment: 'product_text_alignment',
  categoryStyle: 'category_style',
  showSearch: 'show_search',
  stickyCategories: 'sticky_categories',
  showFeatured: 'show_featured',
  showSaleBadge: 'show_sale_badge',
  showProductDescription: 'show_product_description',
  buttonStyle: 'button_style',
  buttonHover: 'button_hover',
  pageAnimation: 'page_animation',
  cardAnimation: 'card_animation',
  animationSpeed: 'animation_speed',
  scrollBehavior: 'scroll_behavior',
  respectReducedMotion: 'respect_reduced_motion',
  showBackToTop: 'show_back_to_top',
  headerStyle: 'header_style',
  headerPosition: 'header_position',
  footerStyle: 'footer_style',
  footerBackground: 'footer_background',
  footerText: 'footer_text',
  showSocialLinks: 'show_social_links',
  socialInstagram: 'social_instagram',
  socialFacebook: 'social_facebook',
  socialTiktok: 'social_tiktok',
  socialYoutube: 'social_youtube',
  socialX: 'social_x',
  socialPinterest: 'social_pinterest',
  floatingWhatsapp: 'floating_whatsapp',
  floatingCart: 'floating_cart',
  customCss: 'custom_css'
};

const themePresets = {
  minimal: {
    primary_color:'#2563eb',
    accent_color:'#0f172a',
    body_font:'Inter',
    heading_font:'Inter',
    heading_weight:'700',
    background_color:'#f8fafc',
    card_color:'#ffffff',
    text_color:'#111827',
    muted_color:'#64748b',
    font_scale:'normal',
    desktop_columns:3,
    product_image_ratio:'square',
    card_radius:'small',
    card_shadow:'none',
    product_text_alignment:'left',
    category_style:'underline',
    button_style:'outline',
    button_hover:'lift',
    page_animation:'fade',
    card_animation:'border',
    header_style:'solid',
    header_position:'sticky',
    footer_style:'simple',
    footer_background:'light',
    hero_alignment:'left',
    cover_overlay:12,
    show_featured:true,
    show_product_description:true
  },

  boutique: {
    primary_color:'#8b5e4a',
    accent_color:'#2f211c',
    body_font:'Manrope',
    heading_font:'Playfair Display',
    heading_weight:'700',
    background_color:'#f7efe9',
    card_color:'#fffaf6',
    text_color:'#34241f',
    muted_color:'#8b756b',
    font_scale:'large',
    desktop_columns:3,
    product_image_ratio:'portrait',
    card_radius:'none',
    card_shadow:'soft',
    product_text_alignment:'center',
    category_style:'text',
    button_style:'square',
    button_hover:'scale',
    page_animation:'fade',
    card_animation:'zoom',
    header_style:'minimal',
    header_position:'static',
    footer_style:'centered',
    footer_background:'accent',
    hero_alignment:'center',
    cover_overlay:28,
    show_featured:true,
    show_product_description:false
  },

  vibrant: {
    primary_color:'#ff3d8d',
    accent_color:'#5b35f5',
    body_font:'Poppins',
    heading_font:'Poppins',
    heading_weight:'900',
    background_color:'#fff6d8',
    card_color:'#ffffff',
    text_color:'#24123b',
    muted_color:'#765f82',
    font_scale:'normal',
    desktop_columns:4,
    product_image_ratio:'portrait',
    card_radius:'large',
    card_shadow:'strong',
    product_text_alignment:'center',
    category_style:'pills',
    button_style:'pill',
    button_hover:'glow',
    page_animation:'cascade',
    card_animation:'lift',
    header_style:'floating',
    header_position:'sticky',
    footer_style:'columns',
    footer_background:'primary',
    hero_alignment:'center',
    cover_overlay:18,
    show_featured:true,
    show_product_description:true
  },

  dark: {
    primary_color:'#8b5cf6',
    accent_color:'#070b14',
    body_font:'Inter',
    heading_font:'Montserrat',
    heading_weight:'800',
    background_color:'#080d18',
    card_color:'#111827',
    text_color:'#f8fafc',
    muted_color:'#94a3b8',
    font_scale:'normal',
    desktop_columns:3,
    product_image_ratio:'square',
    card_radius:'medium',
    card_shadow:'strong',
    product_text_alignment:'left',
    category_style:'cards',
    button_style:'rounded',
    button_hover:'glow',
    page_animation:'slide-up',
    card_animation:'lift',
    header_style:'floating',
    header_position:'sticky',
    footer_style:'columns',
    footer_background:'dark',
    hero_alignment:'left',
    cover_overlay:52,
    show_featured:true,
    show_product_description:true
  },

  organic: {
    primary_color:'#47724f',
    accent_color:'#22382a',
    body_font:'Nunito',
    heading_font:'Fraunces',
    heading_weight:'700',
    background_color:'#edf3e6',
    card_color:'#fffdf6',
    text_color:'#203126',
    muted_color:'#697a6d',
    font_scale:'large',
    desktop_columns:3,
    product_image_ratio:'auto',
    card_radius:'large',
    card_shadow:'soft',
    product_text_alignment:'left',
    category_style:'cards',
    button_style:'pill',
    button_hover:'lift',
    page_animation:'fade',
    card_animation:'zoom',
    header_style:'solid',
    header_position:'static',
    footer_style:'centered',
    footer_background:'accent',
    hero_alignment:'left',
    cover_overlay:22,
    show_featured:true,
    show_product_description:true
  },

  poster: {
    primary_color:'#ff352f',
    accent_color:'#050505',
    body_font:'Inter',
    heading_font:'Anton',
    heading_weight:'900',
    background_color:'#f2f0e9',
    card_color:'#ffffff',
    text_color:'#050505',
    muted_color:'#515151',
    font_scale:'large',
    desktop_columns:4,
    product_image_ratio:'landscape',
    card_radius:'none',
    card_shadow:'none',
    product_text_alignment:'left',
    category_style:'underline',
    button_style:'square',
    button_hover:'slide',
    page_animation:'zoom',
    card_animation:'border',
    header_style:'solid',
    header_position:'sticky',
    footer_style:'columns',
    footer_background:'dark',
    hero_alignment:'left',
    cover_overlay:8,
    show_featured:true,
    show_product_description:false
  }
};

const socialMeta = [
  ['social_instagram','ri-instagram-line','Instagram','https://instagram.com/'],
  ['social_facebook','ri-facebook-circle-line','Facebook','https://facebook.com/'],
  ['social_tiktok','ri-tiktok-line','TikTok','https://tiktok.com/@'],
  ['social_youtube','ri-youtube-line','YouTube','https://youtube.com/@'],
  ['social_x','ri-twitter-x-line','X','https://x.com/'],
  ['social_pinterest','ri-pinterest-line','Pinterest','https://pinterest.com/']
];

let current = { ...APPEARANCE_DEFAULTS };
let coverType = 'image';
let previewContext = {};
let initialized = false;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char]));
}

function normalizeSocialUrl(value, base) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^@/, '').replace(/^\/+/, '');
  if (/^(instagram|facebook|tiktok|youtube|youtu\.be|x|twitter|pinterest)\.com\//i.test(clean)) return `https://${clean}`;
  return `${base}${clean}`;
}

function emitChange() {
  const detail = collectAppearance();
  document.dispatchEvent(new CustomEvent('store-appearance-change', { detail }));
  updateAppearancePreview(previewContext);
}

function setChoice(group, value) {
  $$(`#${group} [data-value]`).forEach((button) => button.classList.toggle('active', button.dataset.value === value));
}

function setTheme(theme) {
  const preset = themePresets[theme];
  if (!preset) return;

  current.theme = theme;
  Object.assign(current, preset);

  const primary = preset.primary_color;
  const accent = preset.accent_color;

  if (primary) {
    if ($('primaryColorText')) $('primaryColorText').value = primary;
    if ($('primaryColor')) $('primaryColor').value = primary;
    previewContext.primaryColor = primary;
  }

  if (accent) {
    if ($('accentColorText')) $('accentColorText').value = accent;
    if ($('accentColor')) $('accentColor').value = accent;
    previewContext.accentColor = accent;
  }

  applyAppearance(current, coverType, false);
  emitChange();
}

function syncColor(pickerId, textId) {
  const picker = $(pickerId);
  const text = $(textId);
  if (!picker || !text) return;
  picker.addEventListener('input', () => {
    text.value = picker.value;
    emitChange();
  });
  text.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(text.value)) picker.value = text.value;
    emitChange();
  });
}

function toggleCoverFields() {
  $('bannerImageFields')?.classList.toggle('is-hidden', coverType !== 'image');
  $('coverVideoFields')?.classList.toggle('is-hidden', coverType !== 'video');
  setChoice('coverTypeChoices', coverType);
}

export function collectAppearance() {
  const result = { ...current, theme: current.theme, cover_type: coverType };
  Object.entries(fieldMap).forEach(([id, key]) => {
    const element = $(id);
    if (!element) return;
    if (element.type === 'checkbox') result[key] = element.checked;
    else if (element.type === 'range' || element.type === 'number') result[key] = Number(element.value);
    else result[key] = element.value;
  });
  return result;
}

export function applyAppearance(settings = {}, type = 'image', update = true) {
  current = { ...APPEARANCE_DEFAULTS, ...settings };
  coverType = type || current.cover_type || 'image';
  current.cover_type = coverType;

  $$('#themeChoices [data-theme]').forEach((button) => button.classList.toggle('active', button.dataset.theme === current.theme));
  Object.entries(fieldMap).forEach(([id, key]) => {
    const element = $(id);
    if (!element) return;
    const value = current[key];
    if (element.type === 'checkbox') element.checked = Boolean(value);
    else element.value = value ?? '';
  });

  [['backgroundColor','backgroundColorText'], ['cardColor','cardColorText'], ['textColor','textColorText'], ['mutedColor','mutedColorText']].forEach(([picker, text]) => {
    if ($(picker) && $(text) && /^#[0-9a-f]{6}$/i.test($(text).value)) $(picker).value = $(text).value;
  });

  if ($('coverOverlayValue')) $('coverOverlayValue').textContent = `${Number(current.cover_overlay || 0)}%`;
  toggleCoverFields();
  if (update) updateAppearancePreview(previewContext);
}

function renderPreviewProducts(container, products = []) {
  if (!container) return;

  const fallback = [
    {
      name: 'Produto exemplo',
      description: 'Descrição curta do produto',
      price: 29.9,
      sale_price: 24.9,
      image_url: '',
      featured: true
    },
    {
      name: 'Outro produto',
      description: 'Outra descrição do catálogo',
      price: 49.9,
      sale_price: null,
      image_url: '',
      featured: false
    }
  ];

  const list = (products.length ? products : fallback)
    .filter((product) => product.active !== false)
    .slice(0, 6);

  container.innerHTML = list.map((product) => {
    const hasSale =
      Number(product.sale_price || 0) > 0 &&
      Number(product.sale_price) < Number(product.price || 0);

    const price = hasSale
      ? product.sale_price
      : product.price;

    const image =
      product.image_url ||
      product.image ||
      '';

    return `
      <article>
        <div
          class="alp-image"
          ${image ? `style="background-image:url('${escapeHtml(image)}')"` : ''}
        ></div>

        ${hasSale ? '<span class="alp-sale">OFERTA</span>' : ''}

        <h4>${escapeHtml(product.name || 'Produto')}</h4>
        <p>${escapeHtml(product.description || 'Descrição do produto')}</p>

        <div class="alp-product-bottom">
          <strong>
            ${new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(Number(price || 0))}
          </strong>

          <button type="button" aria-label="Adicionar produto">
            <i class="ri-add-line"></i>
          </button>
        </div>
      </article>
    `;
  }).join('');
}

function renderPreviewCategories(container, categories = []) {
  const names = ['Todos', ...categories.slice(0, 4).map((category) => category.name).filter(Boolean)];
  if (names.length === 1) names.push('Novidades', 'Destaques');
  container.innerHTML = names.map((name, index) => `<span class="${index === 0 ? 'active' : ''}">${escapeHtml(name)}</span>`).join('');
}

function renderSocials(container, appearance, context) {
  const socialValues = { ...appearance };
  if (!socialValues.social_instagram && context.instagram) socialValues.social_instagram = context.instagram;
  const links = socialMeta.map(([key, icon, label, base]) => ({ key, icon, label, url: normalizeSocialUrl(socialValues[key], base) })).filter((item) => item.url);
  container.innerHTML = appearance.show_social_links
    ? links.map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" title="${item.label}" aria-label="${item.label}"><i class="${item.icon}"></i></a>`).join('')
    : '';
  container.hidden = !appearance.show_social_links || !links.length;
}

function setPreviewMedia(media, appearance, context) {
  media.innerHTML = '';
  media.style.backgroundImage = '';
  media.style.backgroundSize = appearance.cover_fit || 'cover';
  media.style.backgroundPosition = appearance.cover_position || 'center';

  if (appearance.cover_type === 'video') {
    const videoUrl = context.coverVideoPreviewUrl || appearance.cover_video_external_url || context.coverVideoUrl;
    if (videoUrl) {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.style.objectFit = appearance.cover_fit || 'cover';
      video.style.objectPosition = appearance.cover_position || 'center';
      media.appendChild(video);
    } else {
      media.innerHTML = '<i class="ri-play-circle-fill"></i><span>Prévia do vídeo da capa</span>';
    }
  } else if (appearance.cover_type === 'gradient') {
    media.style.backgroundImage = `linear-gradient(135deg,${context.primaryColor || '#2563eb'},${context.accentColor || '#0f172a'})`;
  } else if (context.coverPreviewUrl) {
    media.style.backgroundImage = `url('${context.coverPreviewUrl}')`;
  } else {
    media.style.backgroundImage = `linear-gradient(135deg,${context.primaryColor || '#2563eb'},${context.accentColor || '#0f172a'})`;
  }
}

export function updateAppearancePreview(context = {}) {
  previewContext = { ...previewContext, ...context };

  const preview = $('appearanceLivePreview');
  if (!preview) return;

  const appearance = collectAppearance();

  preview.dataset.theme = appearance.theme;
  preview.dataset.layout = previewContext.productLayout || 'grid';
  preview.dataset.radius = appearance.card_radius;
  preview.dataset.shadow = appearance.card_shadow;
  preview.dataset.button = appearance.button_style;
  preview.dataset.buttonHover = appearance.button_hover;
  preview.dataset.align = appearance.hero_alignment;
  preview.dataset.ratio = appearance.product_image_ratio;
  preview.dataset.textAlign = appearance.product_text_alignment;
  preview.dataset.categoryStyle = appearance.category_style;
  preview.dataset.headerStyle = appearance.header_style;
  preview.dataset.headerPosition = appearance.header_position;
  preview.dataset.footerStyle = appearance.footer_style;
  preview.dataset.animation = appearance.page_animation;
  preview.dataset.cardAnimation = appearance.card_animation;
  preview.dataset.animationSpeed = appearance.animation_speed;
  preview.dataset.fontScale = appearance.font_scale;

  preview.style.setProperty('--ap-primary', previewContext.primaryColor || '#2563eb');
  preview.style.setProperty('--ap-accent', previewContext.accentColor || '#0f172a');
  preview.style.setProperty('--ap-bg', appearance.background_color || '#f6f8fc');
  preview.style.setProperty('--ap-card', appearance.card_color || '#ffffff');
  preview.style.setProperty('--ap-text', appearance.text_color || '#0f172a');
  preview.style.setProperty('--ap-muted', appearance.muted_color || '#64748b');
  preview.style.setProperty('--ap-body-font', `"${appearance.body_font || 'Manrope'}",sans-serif`);
  preview.style.setProperty('--ap-heading-font', `"${appearance.heading_font || 'Manrope'}",sans-serif`);
  preview.style.setProperty('--ap-heading-weight', appearance.heading_weight || '800');
  preview.style.setProperty('--ap-overlay', Number(appearance.cover_overlay || 0) / 100);
  preview.style.setProperty(
    '--ap-columns',
    Math.max(2, Math.min(5, Number(appearance.desktop_columns || 3)))
  );

  const heightMap = {
    compact: '145px',
    medium: '210px',
    large: '285px',
    fullscreen: '390px'
  };

  preview.style.setProperty(
    '--ap-cover-height',
    heightMap[appearance.cover_height] || heightMap.medium
  );

  const previewStoreName = previewContext.storeName || 'Minha loja';

  const headerName = preview.querySelector('.alp-brand strong');
  if (headerName) headerName.textContent = previewStoreName;

const searchBox = preview.querySelector('.alp-search');
  if (searchBox) searchBox.hidden = !appearance.show_search;

  const categoriesElement = preview.querySelector('.alp-categories');
  if (categoriesElement) {
    categoriesElement.hidden = false;
    categoriesElement.classList.toggle(
      'sticky-demo',
      Boolean(appearance.sticky_categories)
    );

    renderPreviewCategories(
      categoriesElement,
      previewContext.categories || []
    );
  }

  const allProducts = (previewContext.products || [])
    .filter((product) => product.active !== false);

  const featuredProducts = allProducts
    .filter((product) => product.featured)
    .slice(0, 4);

  const mainProductsContainer = preview.querySelector(
    '.alp-products:not(.alp-featured-products)'
  );

  const featuredProductsContainer = preview.querySelector(
    '.alp-featured-products'
  );

  const featuredSection = preview.querySelector('.alp-featured');

  if (mainProductsContainer) {
    renderPreviewProducts(
      mainProductsContainer,
      allProducts
    );
  }

  if (featuredProductsContainer) {
    renderPreviewProducts(
      featuredProductsContainer,
      featuredProducts.length ? featuredProducts : allProducts.slice(0, 2)
    );
  }

  if (featuredSection) {
    featuredSection.hidden = !appearance.show_featured;
  }

  preview
    .querySelectorAll('.alp-products article p')
    .forEach((element) => {
      element.hidden = !appearance.show_product_description;
    });

  preview
    .querySelectorAll('.alp-sale')
    .forEach((element) => {
      element.hidden = !appearance.show_sale_badge;
    });

  const resultCount = preview.querySelector('.alp-results small');
  if (resultCount) {
    const count = allProducts.length || 2;
    resultCount.textContent = `${count} ${count === 1 ? 'produto' : 'produtos'}`;
  }

  const footer = preview.querySelector('.alp-footer');

  if (footer) {
    footer.hidden = appearance.footer_style === 'hidden';
    footer.dataset.background = appearance.footer_background;

    const footerText = footer.querySelector('.alp-footer-text');

    if (footerText) {
      footerText.textContent =
        appearance.footer_text ||
        `${previewStoreName} © ${new Date().getFullYear()}`;
    }
  }

  /*
   * As redes sociais da loja pública aparecem somente
   * abaixo do banner, nunca ao lado da sacola.
   */
  const socialSection = preview.querySelector('.alp-social-section');
  const socialContainer = socialSection?.querySelector('.alp-socials');

  if (socialContainer) {
    renderSocials(
      socialContainer,
      appearance,
      previewContext
    );

    socialSection.hidden =
      socialContainer.hidden ||
      !appearance.show_social_links;
  }

  const whatsapp = preview.querySelector('.alp-floating-whatsapp');

  if (whatsapp) {
    const whatsappNumber = String(
      previewContext.whatsapp || ''
    ).replace(/\D/g, '');

    whatsapp.hidden =
      !appearance.floating_whatsapp ||
      !whatsappNumber;

    whatsapp.href = whatsappNumber
      ? `https://wa.me/${whatsappNumber}`
      : '#';
  }

  setPreviewMedia(
    preview.querySelector('.alp-media'),
    appearance,
    previewContext
  );

  const logo = preview.querySelector('.alp-logo');

  if (logo) {
    logo.dataset.shape = appearance.logo_shape;

    logo.innerHTML = previewContext.logoPreviewUrl
      ? `<img src="${escapeHtml(previewContext.logoPreviewUrl)}" alt="Logo">`
      : '<i class="ri-store-2-line"></i>';
  }
}

function bindField(id) {
  const element = $(id);
  if (!element) return;
  const eventName = element.type === 'range' ? 'input' : (element.tagName === 'SELECT' || element.type === 'checkbox' ? 'change' : 'input');
  element.addEventListener(eventName, () => {
    if (id === 'coverOverlay' && $('coverOverlayValue')) $('coverOverlayValue').textContent = `${element.value}%`;
    emitChange();
  });
}

export function initAppearance(settings = {}, type = 'image') {
  applyAppearance(settings, type, false);
  if (!initialized) {
    initialized = true;
    $$('#themeChoices [data-theme]').forEach((button) => button.addEventListener('click', () => setTheme(button.dataset.theme)));
    $$('#coverTypeChoices [data-value]').forEach((button) => button.addEventListener('click', () => {
      coverType = button.dataset.value;
      toggleCoverFields();
      emitChange();
    }));
    Object.keys(fieldMap).forEach(bindField);
    syncColor('backgroundColor','backgroundColorText');
    syncColor('cardColor','cardColorText');
    syncColor('textColor','textColorText');
    syncColor('mutedColor','mutedColorText');

    $('resetAppearanceBtn')?.addEventListener('click', () => {
      if (!confirm('Restaurar todas as configurações visuais para o padrão?')) return;
      applyAppearance(APPEARANCE_DEFAULTS, 'image');
      emitChange();
    });

    $$('[data-preview-device]').forEach((button) => button.addEventListener('click', () => {
      $$('[data-preview-device]').forEach((item) => item.classList.toggle('active', item === button));
      const preview = $('appearanceLivePreview');
      const desktop = button.dataset.previewDevice === 'desktop';
      preview.classList.toggle('desktop', desktop);
      preview.classList.toggle('mobile', !desktop);
    }));
  }
  updateAppearancePreview(previewContext);
}

window.StoreAppearance = {
  initAppearance,
  collectAppearance,
  applyAppearance,
  updateAppearancePreview,
  defaults: APPEARANCE_DEFAULTS
};
