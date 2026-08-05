import { getSupabase } from "./supabase-client.js";
import { formatWhatsapp, normalizeWhatsapp, renderAvatar, setLoading, showToast } from "./ui.js";

let currentUser = null;
let currentProfile = null;
let selectedAvatarFile = null;

const els = {};

export function initializeProfileUI() {
  Object.assign(els, {
    modal: document.getElementById("profileModal"),
    form: document.getElementById("profileForm"),
    storeName: document.getElementById("profileStoreName"),
    responsible: document.getElementById("profileResponsible"),
    whatsapp: document.getElementById("profileWhatsapp"),
    email: document.getElementById("profileEmail"),
    avatarInput: document.getElementById("avatarInput"),
    modalAvatar: document.getElementById("modalAvatar"),
    saveButton: document.getElementById("saveProfileButton")
  });

  document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", closeProfileModal);
  });

  ["openProfileButton", "welcomeProfileButton", "summaryEditButton"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", openProfileModal);
  });

  els.avatarInput.addEventListener("change", previewAvatar);
  els.whatsapp.addEventListener("input", () => {
    els.whatsapp.value = formatWhatsapp(els.whatsapp.value);
  });
  els.form.addEventListener("submit", saveProfile);
}

export async function loadProfile(user) {
  currentUser = user;
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, store_name, responsible_name, whatsapp, avatar_url, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const fallbackProfile = {
      id: user.id,
      store_name: user.user_metadata?.store_name || "Minha loja",
      responsible_name: user.user_metadata?.responsible_name || "",
      whatsapp: "",
      avatar_url: ""
    };

    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert(fallbackProfile)
      .select("id, store_name, responsible_name, whatsapp, avatar_url, created_at, updated_at")
      .single();

    if (createError) throw createError;
    currentProfile = created;
  } else {
    currentProfile = data;
  }

  renderProfile();
  return currentProfile;
}

export function openProfileModal() {
  if (!currentUser || !currentProfile) return;

  selectedAvatarFile = null;
  els.avatarInput.value = "";
  els.storeName.value = currentProfile.store_name || "";
  els.responsible.value = currentProfile.responsible_name || "";
  els.whatsapp.value = formatWhatsapp(currentProfile.whatsapp || "");
  els.email.value = currentUser.email || "";
  renderAvatar(els.modalAvatar, currentProfile.avatar_url, currentProfile.store_name);

  els.modal.classList.remove("is-hidden");
  document.body.style.overflow = "hidden";
  window.setTimeout(() => els.storeName.focus(), 50);
}

function closeProfileModal() {
  els.modal.classList.add("is-hidden");
  document.body.style.overflow = "";
  selectedAvatarFile = null;
}

function previewAvatar(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
    showToast("Escolha uma imagem PNG, JPG ou WEBP.", "error", "Formato inválido");
    event.target.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast("A imagem deve ter no máximo 5 MB.", "error", "Arquivo muito grande");
    event.target.value = "";
    return;
  }

  selectedAvatarFile = file;
  const temporaryUrl = URL.createObjectURL(file);
  renderAvatar(els.modalAvatar, temporaryUrl, els.storeName.value || currentProfile.store_name);
  window.setTimeout(() => URL.revokeObjectURL(temporaryUrl), 1000);
}

async function saveProfile(event) {
  event.preventDefault();

  const storeName = els.storeName.value.trim();
  const responsibleName = els.responsible.value.trim();
  const whatsapp = normalizeWhatsapp(els.whatsapp.value);

  if (!storeName) {
    showToast("Informe o nome da loja.", "error", "Campo obrigatório");
    return;
  }

  setLoading(els.saveButton, true, "Salvando...");

  try {
    const supabase = await getSupabase();
    let avatarUrl = currentProfile.avatar_url || "";

    if (selectedAvatarFile) {
      avatarUrl = await uploadAvatar(supabase, selectedAvatarFile);
    }

    const payload = {
      store_name: storeName,
      responsible_name: responsibleName || null,
      whatsapp: whatsapp || null,
      avatar_url: avatarUrl || null
    };

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", currentUser.id)
      .select("id, store_name, responsible_name, whatsapp, avatar_url, created_at, updated_at")
      .single();

    if (error) throw error;

    currentProfile = data;
    renderProfile();
    closeProfileModal();
    showToast("Os dados da loja foram atualizados.", "success", "Perfil salvo");
  } catch (error) {
    showToast(error?.message || "Não foi possível salvar o perfil.", "error", "Erro ao salvar");
  } finally {
    setLoading(els.saveButton, false);
  }
}

async function uploadAvatar(supabase, file) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filePath = `${currentUser.id}/avatar-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("store-avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("store-avatars").getPublicUrl(filePath);
  return data.publicUrl;
}

function renderProfile() {
  const name = currentProfile.store_name || "Minha loja";
  const responsible = currentProfile.responsible_name || "Responsável não informado";
  const whatsappText = currentProfile.whatsapp ? formatWhatsapp(currentProfile.whatsapp) : "Não informado";
  const email = currentUser.email || "—";
  const avatarUrl = currentProfile.avatar_url || "";

  document.getElementById("headerStoreName").textContent = name;
  document.getElementById("headerEmail").textContent = email;
  document.getElementById("summaryStoreName").textContent = name;
  document.getElementById("summaryResponsible").textContent = responsible;
  document.getElementById("summaryEmail").textContent = email;
  document.getElementById("summaryWhatsapp").textContent = whatsappText;
  document.getElementById("welcomeTitle").textContent = `Olá! A dashboard da ${name} está pronta.`;

  ["headerAvatar", "summaryAvatar", "modalAvatar"].forEach((id) => {
    renderAvatar(document.getElementById(id), avatarUrl, name);
  });

  const hasAvatar = Boolean(avatarUrl);
  const hasWhatsapp = Boolean(currentProfile.whatsapp);
  const percent = 50 + (hasAvatar ? 25 : 0) + (hasWhatsapp ? 25 : 0);

  updateCheck("avatarCheck", hasAvatar, "Adicionar foto da loja");
  updateCheck("whatsappCheck", hasWhatsapp, "Adicionar WhatsApp");
  document.getElementById("profilePercent").textContent = `${percent}%`;
  document.getElementById("profileProgressBar").style.width = `${percent}%`;
}

function updateCheck(id, complete, text) {
  const row = document.getElementById(id);
  row.classList.toggle("is-complete", complete);
  row.innerHTML = `<i class="${complete ? "ri-checkbox-circle-fill" : "ri-checkbox-blank-circle-line"}"></i><span>${complete ? text.replace("Adicionar", "Adicionado:") : text}</span>`;
}
