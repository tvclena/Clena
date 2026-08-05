import { initializeAuthUI } from "./auth.js";
import { initializeDashboardUI } from "./dashboard.js";
import { initializeProfileUI, loadProfile } from "./profile.js";
import { getSupabase } from "./supabase-client.js";
import { showToast } from "./ui.js";

const loader = document.getElementById("appLoader");
const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");

let renderedUserId = null;

initializeAuthUI();
initializeDashboardUI();
initializeProfileUI();
start();

async function start() {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    await applySession(data.session);

    supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => applySession(session), 0);
    });
  } catch (error) {
    showAuth();
    showToast(error?.message || "Não foi possível iniciar o sistema.", "error", "Erro de configuração");
  } finally {
    loader.classList.add("is-hidden");
  }
}

async function applySession(session) {
  if (!session?.user) {
    renderedUserId = null;
    showAuth();
    return;
  }

  showDashboard();

  if (renderedUserId === session.user.id) return;

  try {
    await loadProfile(session.user);
    renderedUserId = session.user.id;
  } catch (error) {
    showToast(
      `${error?.message || "Não foi possível carregar o perfil."} Execute o arquivo supabase/schema.sql no projeto Supabase.`,
      "error",
      "Perfil indisponível"
    );
  }
}

function showAuth() {
  authView.classList.remove("is-hidden");
  dashboardView.classList.add("is-hidden");
}

function showDashboard() {
  authView.classList.add("is-hidden");
  dashboardView.classList.remove("is-hidden");
}
