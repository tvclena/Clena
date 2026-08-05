const byId = (id) => document.getElementById(id);

export function setLoading(button, loading, label = "Aguarde...") {
  if (!button) return;

  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="ri-loader-4-line ri-spin"></i><span>${label}</span>`;
    return;
  }

  button.disabled = false;
  if (button.dataset.originalHtml) {
    button.innerHTML = button.dataset.originalHtml;
    delete button.dataset.originalHtml;
  }
}

export function showToast(message, type = "info", title = "Aviso") {
  const region = byId("toastRegion");
  const toast = document.createElement("div");
  const icon = type === "success" ? "ri-checkbox-circle-line" : type === "error" ? "ri-error-warning-line" : "ri-information-line";

  toast.className = `toast is-${type}`;
  toast.innerHTML = `
    <i class="${icon}" aria-hidden="true"></i>
    <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>
  `;

  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

export function initials(value = "Loja") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return (parts.map((part) => part[0]).join("") || "LO").toUpperCase();
}

export function renderAvatar(element, imageUrl, name) {
  if (!element) return;
  element.innerHTML = imageUrl
    ? `<img src="${escapeAttribute(imageUrl)}" alt="Foto de ${escapeAttribute(name || "loja")}" />`
    : `<span>${escapeHtml(initials(name))}</span>`;
}

export function normalizeWhatsapp(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 13);
}

export function formatWhatsapp(value = "") {
  const digits = normalizeWhatsapp(value);
  if (!digits) return "";

  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length <= 2) return `(${local}`;
  if (local.length <= 7) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
  if (local.length <= 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7, 11)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
