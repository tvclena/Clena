import { getSupabase } from "./supabase-client.js";
import { setLoading, showToast } from "./ui.js";

let mode = "login";

const el = {};

export function initializeAuthUI() {
  Object.assign(el, {
    form: document.getElementById("authForm"),
    loginTab: document.getElementById("loginTab"),
    registerTab: document.getElementById("registerTab"),
    registerFields: document.getElementById("registerFields"),
    storeName: document.getElementById("storeNameInput"),
    responsible: document.getElementById("responsibleInput"),
    email: document.getElementById("emailInput"),
    password: document.getElementById("passwordInput"),
    submit: document.getElementById("authSubmit"),
    title: document.getElementById("authTitle"),
    subtitle: document.getElementById("authSubtitle"),
    togglePassword: document.getElementById("togglePassword"),
    forgotPassword: document.getElementById("forgotPasswordButton")
  });

  el.loginTab.addEventListener("click", () => setMode("login"));
  el.registerTab.addEventListener("click", () => setMode("register"));
  el.togglePassword.addEventListener("click", togglePasswordVisibility);
  el.forgotPassword.addEventListener("click", resetPassword);
  el.form.addEventListener("submit", submitAuth);
}

function setMode(nextMode) {
  mode = nextMode;
  const registering = mode === "register";

  el.loginTab.classList.toggle("is-active", !registering);
  el.registerTab.classList.toggle("is-active", registering);
  el.loginTab.setAttribute("aria-selected", String(!registering));
  el.registerTab.setAttribute("aria-selected", String(registering));
  el.registerFields.classList.toggle("is-hidden", !registering);

  el.storeName.required = registering;
  el.responsible.required = registering;
  el.password.autocomplete = registering ? "new-password" : "current-password";

  el.title.textContent = registering ? "Crie sua conta" : "Entre na sua conta";
  el.subtitle.textContent = registering
    ? "Cadastre a loja e o responsável para iniciar a estrutura."
    : "Acesse a dashboard para gerenciar os dados da sua loja.";
  el.submit.querySelector("span").textContent = registering ? "Criar conta" : "Entrar";
  el.forgotPassword.classList.toggle("is-hidden", registering);
}

async function submitAuth(event) {
  event.preventDefault();

  const email = el.email.value.trim().toLowerCase();
  const password = el.password.value;
  const storeName = el.storeName.value.trim();
  const responsible = el.responsible.value.trim();

  if (!email || !password) {
    showToast("Preencha o e-mail e a senha.", "error", "Campos obrigatórios");
    return;
  }

  if (password.length < 6) {
    showToast("A senha deve ter pelo menos 6 caracteres.", "error", "Senha inválida");
    return;
  }

  if (mode === "register" && (!storeName || !responsible)) {
    showToast("Informe o nome da loja e o responsável.", "error", "Cadastro incompleto");
    return;
  }

  setLoading(el.submit, true, mode === "register" ? "Criando conta..." : "Entrando...");

  try {
    const supabase = await getSupabase();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showToast("Login realizado com sucesso.", "success", "Bem-vindo");
      return;
    }

    const redirectTo = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          store_name: storeName,
          responsible_name: responsible
        }
      }
    });

    if (error) throw error;

    if (!data.session) {
      el.form.reset();
      setMode("login");
      showToast("Confira seu e-mail para confirmar a conta antes de entrar.", "success", "Conta criada");
    } else {
      showToast("Conta criada e conectada.", "success", "Tudo certo");
    }
  } catch (error) {
    showToast(authErrorMessage(error), "error", "Não foi possível continuar");
  } finally {
    setLoading(el.submit, false);
  }
}

async function resetPassword() {
  const email = el.email.value.trim().toLowerCase();
  if (!email) {
    showToast("Digite seu e-mail antes de solicitar a recuperação.", "error", "Informe o e-mail");
    el.email.focus();
    return;
  }

  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`
    });
    if (error) throw error;
    showToast("Enviamos o link de recuperação para seu e-mail.", "success", "E-mail enviado");
  } catch (error) {
    showToast(authErrorMessage(error), "error", "Falha na recuperação");
  }
}

function togglePasswordVisibility() {
  const visible = el.password.type === "text";
  el.password.type = visible ? "password" : "text";
  el.togglePassword.setAttribute("aria-label", visible ? "Mostrar senha" : "Ocultar senha");
  el.togglePassword.innerHTML = `<i class="${visible ? "ri-eye-line" : "ri-eye-off-line"}" aria-hidden="true"></i>`;
}

function authErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("user already registered")) return "Este e-mail já possui cadastro.";
  if (message.includes("password should be")) return "Use uma senha com pelo menos 6 caracteres.";
  if (message.includes("rate limit")) return "Muitas tentativas. Tente novamente mais tarde.";
  return error?.message || "Ocorreu um erro inesperado.";
}
