import { getSupabase } from "./supabase-client.js";
import { showToast } from "./ui.js";

export function initializeDashboardUI() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  const menuButton = document.getElementById("menuButton");
  const profileButton = document.getElementById("profileMenuButton");
  const dropdown = document.getElementById("profileDropdown");
  const logoutButton = document.getElementById("logoutButton");

  const closeSidebar = () => {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
  };

  menuButton.addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
    backdrop.classList.toggle("is-visible");
  });

  backdrop.addEventListener("click", closeSidebar);

  profileButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const opening = dropdown.classList.contains("is-hidden");
    dropdown.classList.toggle("is-hidden", !opening);
    profileButton.setAttribute("aria-expanded", String(opening));
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".profile-menu-wrap")) {
      dropdown.classList.add("is-hidden");
      profileButton.setAttribute("aria-expanded", "false");
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      dropdown.classList.add("is-hidden");
    } catch (error) {
      showToast(error?.message || "Não foi possível sair da conta.", "error", "Erro ao sair");
    }
  });
}
