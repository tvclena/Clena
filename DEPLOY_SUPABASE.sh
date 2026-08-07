#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI não encontrado. Instale com: npm install -g supabase"
  exit 1
fi

echo "Deploy mp-create-payment..."
supabase functions deploy mp-create-payment --no-verify-jwt

echo "Deploy mp-payment-status..."
supabase functions deploy mp-payment-status --no-verify-jwt

echo "Deploy mp-webhook..."
supabase functions deploy mp-webhook --no-verify-jwt

echo "Concluído. Agora configure PUBLIC_SITE_URL e ALLOWED_ORIGINS se ainda não configurou."
