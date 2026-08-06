/**
 * CLENA — Configuração pública do Supabase
 *
 * Caminho obrigatório na Vercel:
 *   /api/public-config.js
 *
 * Endpoint publicado:
 *   GET /api/public-config
 *
 * Esta API entrega somente informações públicas necessárias ao navegador:
 *   - URL do projeto Supabase
 *   - chave pública anon/publishable
 *
 * NUNCA coloque aqui:
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - Access Token do Mercado Pago
 *   - secrets de webhook
 *   - senhas
 */

const ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Remove espaços acidentais das variáveis da Vercel.
 */
function cleanEnvironmentValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Obtém a primeira variável de ambiente válida.
 *
 * Mantém compatibilidade com os nomes mais comuns usados em projetos
 * Vercel, Vite e Supabase.
 */
function getFirstEnvironmentValue(names) {
  for (const name of names) {
    const value = cleanEnvironmentValue(process.env[name]);

    if (value) {
      return value;
    }
  }

  return '';
}

/**
 * Verifica se a URL parece ser de um projeto Supabase.
 */
function isValidSupabaseUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' &&
      (
        url.hostname.endsWith('.supabase.co') ||
        url.hostname.endsWith('.supabase.in') ||
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1'
      )
    );
  } catch {
    return false;
  }
}

/**
 * Faz uma validação básica da chave pública.
 *
 * O Supabase pode usar chave anon JWT antiga ou chave publishable mais nova.
 * A validação é propositalmente flexível para aceitar os dois formatos.
 */
function isValidPublicKey(value) {
  if (!value || value.length < 20) return false;

  const looksLikeJwt = value.split('.').length === 3;
  const looksLikePublishable =
    value.startsWith('sb_publishable_') ||
    value.startsWith('sb_anon_');

  return looksLikeJwt || looksLikePublishable;
}

/**
 * Obtém a origem enviada pelo navegador.
 */
function getRequestOrigin(request) {
  const origin = request.headers?.origin;

  return typeof origin === 'string' ? origin : '';
}

/**
 * Configura os headers HTTP usados por todos os retornos.
 */
function applyCommonHeaders(request, response) {
  const requestOrigin = getRequestOrigin(request);

  /*
   * A configuração contém apenas dados públicos.
   * O wildcard permite abrir a loja em domínio próprio, preview da Vercel
   * e subdomínios diferentes sem bloquear a inicialização.
   */
  response.setHeader('Access-Control-Allow-Origin', requestOrigin || '*');
  response.setHeader('Vary', 'Origin');

  response.setHeader(
    'Access-Control-Allow-Methods',
    ALLOWED_METHODS.join(', ')
  );

  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );

  response.setHeader(
    'Access-Control-Max-Age',
    '86400'
  );

  /*
   * Evita guardar uma configuração antiga em cache depois de trocar
   * variáveis de ambiente na Vercel.
   */
  response.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  );

  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');

  response.setHeader(
    'Content-Type',
    'application/json; charset=utf-8'
  );

  response.setHeader(
    'X-Content-Type-Options',
    'nosniff'
  );

  response.setHeader(
    'Referrer-Policy',
    'strict-origin-when-cross-origin'
  );
}

/**
 * Envia JSON sem depender de helpers adicionais.
 */
function sendJson(response, statusCode, body) {
  return response.status(statusCode).json(body);
}

/**
 * API pública utilizada pelos arquivos HTML completos da CLENA.
 */
export default async function handler(request, response) {
  applyCommonHeaders(request, response);

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  if (!ALLOWED_METHODS.includes(request.method)) {
    response.setHeader('Allow', ALLOWED_METHODS.join(', '));

    return sendJson(response, 405, {
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'Método não permitido.',
      allowedMethods: ALLOWED_METHODS
    });
  }

  const supabaseUrl = getFirstEnvironmentValue([
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_URL'
  ]);

  const supabaseAnonKey = getFirstEnvironmentValue([
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY'
  ]);

  const missingVariables = [];

  if (!supabaseUrl) {
    missingVariables.push('SUPABASE_URL');
  }

  if (!supabaseAnonKey) {
    missingVariables.push('SUPABASE_ANON_KEY');
  }

  if (missingVariables.length) {
    console.error(
      '[CLENA][public-config] Variáveis ausentes:',
      missingVariables.join(', ')
    );

    return sendJson(response, 500, {
      ok: false,
      error: 'PUBLIC_CONFIG_NOT_CONFIGURED',
      message:
        'As variáveis públicas do Supabase não estão configuradas na Vercel.',
      missingVariables,
      expectedVariables: {
        supabaseUrl: [
          'SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_URL',
          'VITE_SUPABASE_URL'
        ],
        supabaseAnonKey: [
          'SUPABASE_ANON_KEY',
          'SUPABASE_PUBLISHABLE_KEY',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
          'VITE_SUPABASE_ANON_KEY',
          'VITE_SUPABASE_PUBLISHABLE_KEY'
        ]
      }
    });
  }

  if (!isValidSupabaseUrl(supabaseUrl)) {
    console.error(
      '[CLENA][public-config] SUPABASE_URL inválida.'
    );

    return sendJson(response, 500, {
      ok: false,
      error: 'INVALID_SUPABASE_URL',
      message:
        'A variável SUPABASE_URL não contém uma URL válida do Supabase.'
    });
  }

  if (!isValidPublicKey(supabaseAnonKey)) {
    console.error(
      '[CLENA][public-config] Chave pública Supabase inválida.'
    );

    return sendJson(response, 500, {
      ok: false,
      error: 'INVALID_SUPABASE_PUBLIC_KEY',
      message:
        'A chave pública anon/publishable do Supabase parece inválida.'
    });
  }

  const payload = {
    ok: true,

    /*
     * Estes dois nomes são os usados pelo JavaScript atual da CLENA.
     */
    supabaseUrl,
    supabaseAnonKey,

    /*
     * Alias extras para manter compatibilidade com versões futuras
     * sem quebrar os painéis atuais.
     */
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      publishableKey: supabaseAnonKey
    },

    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',

    generatedAt: new Date().toISOString()
  };

  if (request.method === 'HEAD') {
    return response.status(200).end();
  }

  return sendJson(response, 200, payload);
}
