// =========================================================
// DEBATE LITERARIO — script.js
// =========================================================

// ---------------------------------------------------------
// 1. CONFIG FIREBASE
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyOMC9jPngIdPHiNy2cdTmDccDncKCSudQ",
  authDomain: "debates-literarios.firebaseapp.com",
  projectId: "debates-literarios",
  storageBucket: "debates-literarios.firebasestorage.app",
  messagingSenderId: "229230077953",
  appId: "1:229230077953:web:87e86769ef4c86cda1f800"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const messagesRef = db.collection("messages");
const usersRef = db.collection("usuarios");

// ---------------------------------------------------------
// 2. USUARIOS HARDCODEADOS
// ---------------------------------------------------------
const USUARIOS = {
  "profe":    { password: "clase2024", rol: "admin" },
  "alumno1":  { password: "pass1234",  rol: "usuario" },
  "alumno2":  { password: "pass1234",  rol: "usuario" },
  "alumno3":  { password: "pass1234",  rol: "usuario" },
  "alumno4":  { password: "pass1234",  rol: "usuario" },
  "alumno5":  { password: "pass1234",  rol: "usuario" }
};

const STORAGE_KEY = "debate_usuario_actual";
const STORAGE_KEY_ROL = "debate_rol_actual";

// ---------------------------------------------------------
// 3. REFERENCIAS AL DOM
// ---------------------------------------------------------
const loginScreen   = document.getElementById("login-screen");
const chatScreen    = document.getElementById("chat-screen");

const loginForm     = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const confirmPasswordGroup = document.getElementById("confirm-password-group");
const confirmPasswordInput = document.getElementById("confirm-password");
const loginError    = document.getElementById("login-error");
const authTabs      = document.querySelectorAll(".auth-tab");
const authSubtitle  = document.getElementById("auth-subtitle");
const authSubmitBtn = document.getElementById("auth-submit-btn");

let authMode = "login"; // "login" | "register"

const currentUserName = document.getElementById("current-user-name");
const logoutBtn        = document.getElementById("logout-btn");

const statusDot  = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

const messagesList   = document.getElementById("messages");
const messageForm    = document.getElementById("message-form");
const messageInput   = document.getElementById("message-input");

const questionCards = document.querySelectorAll(".question-card");

let currentUser = null;
let currentUserRole = "usuario"; // "usuario" | "admin"
let unsubscribeMessages = null;

// ---------------------------------------------------------
// 4. LOGIN
// ---------------------------------------------------------
function mostrarErrorLogin(mensaje) {
  loginError.classList.remove("success");
  loginError.querySelector("span").textContent = mensaje;
  loginError.hidden = false;
}

function mostrarExitoLogin(mensaje) {
  loginError.classList.add("success");
  loginError.querySelector("span").textContent = mensaje;
  loginError.hidden = false;
}

function ocultarErrorLogin() {
  loginError.hidden = true;
}

// ---------- Cambiar entre "Iniciar sesión" y "Crear cuenta" ----------
authTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    authMode = tab.dataset.mode;

    authTabs.forEach((t) => t.classList.toggle("active", t === tab));
    ocultarErrorLogin();
    loginForm.reset();

    if (authMode === "register") {
      confirmPasswordGroup.hidden = false;
      confirmPasswordInput.required = true;
      authSubtitle.textContent = "Crea tu usuario y contraseña para entrar al debate";
      authSubmitBtn.querySelector("span").textContent = "Crear cuenta";
    } else {
      confirmPasswordGroup.hidden = true;
      confirmPasswordInput.required = false;
      authSubtitle.textContent = "Entra con tus credenciales de clase para unirte a la conversación";
      authSubmitBtn.querySelector("span").textContent = "Entrar al debate";
    }
  });
});

// ---------- Submit del formulario (login o registro según el modo) ----------
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  ocultarErrorLogin();

  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (username.length < 2 || username.length > 15) {
    mostrarErrorLogin("El usuario debe tener entre 2 y 15 caracteres");
    return;
  }

  if (password.length < 4) {
    mostrarErrorLogin("La contraseña debe tener al menos 4 caracteres");
    return;
  }

  if (authMode === "register") {
    procesarRegistro(username, password);
  } else {
    procesarLogin(username, password);
  }
});

// ---------- LOGIN: revisa primero el objeto hardcodeado, luego Firestore ----------
async function procesarLogin(username, password) {
  const usuarioHardcodeado = USUARIOS[username];

  if (usuarioHardcodeado && usuarioHardcodeado.password === password) {
    iniciarSesion(username, usuarioHardcodeado.rol);
    return;
  }

  authSubmitBtn.disabled = true;

  try {
    const doc = await usersRef.doc(username).get();

    if (doc.exists && doc.data().password === password) {
      iniciarSesion(username, doc.data().rol || "usuario");
    } else {
      mostrarErrorLogin("Usuario o contraseña incorrectos");
      passwordInput.value = "";
    }
  } catch (error) {
    console.error("Error consultando usuario:", error);
    mostrarErrorLogin("Error de conexión, intenta de nuevo");
  } finally {
    authSubmitBtn.disabled = false;
  }
}

// ---------- REGISTRO: crea el usuario en Firestore si no existe ----------
async function procesarRegistro(username, password) {
  const confirmPassword = confirmPasswordInput.value;

  if (password !== confirmPassword) {
    mostrarErrorLogin("Las contraseñas no coinciden");
    return;
  }

  if (USUARIOS[username]) {
    mostrarErrorLogin("Ese usuario ya existe, elige otro");
    return;
  }

  authSubmitBtn.disabled = true;

  try {
    const doc = await usersRef.doc(username).get();

    if (doc.exists) {
      mostrarErrorLogin("Ese usuario ya existe, elige otro");
      return;
    }

    await usersRef.doc(username).set({
      username: username,
      password: password,
      rol: "usuario",
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });

    iniciarSesion(username, "usuario");
  } catch (error) {
    console.error("Error creando usuario:", error);
    mostrarErrorLogin("Error de conexión, intenta de nuevo");
  } finally {
    authSubmitBtn.disabled = false;
  }
}

function iniciarSesion(username, rol) {
  currentUser = username;
  currentUserRole = rol || "usuario";
  localStorage.setItem(STORAGE_KEY, username);
  localStorage.setItem(STORAGE_KEY_ROL, currentUserRole);
  mostrarPantallaChat();
}

function cerrarSesion() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY_ROL);
  currentUser = null;
  currentUserRole = "usuario";

  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  messagesList.innerHTML = "";
  loginForm.reset();
  ocultarErrorLogin();

  chatScreen.hidden = true;
  loginScreen.hidden = false;
}

logoutBtn.addEventListener("click", cerrarSesion);

// ---------------------------------------------------------
// 5. PANTALLA DE CHAT
// ---------------------------------------------------------
function mostrarPantallaChat() {
  loginScreen.hidden = true;
  chatScreen.hidden = false;

  currentUserName.textContent = currentUser;
  document.getElementById("admin-badge").hidden = currentUserRole !== "admin";

  escucharMensajes();
}

// ---------------------------------------------------------
// 6. ESTADO DE CONEXIÓN
// ---------------------------------------------------------
function actualizarEstadoConexion(conectado) {
  if (conectado) {
    statusDot.classList.add("online");
    statusText.textContent = "Conectado";
  } else {
    statusDot.classList.remove("online");
    statusText.textContent = "Conectando…";
  }
}

window.addEventListener("offline", () => actualizarEstadoConexion(false));
window.addEventListener("online", () => actualizarEstadoConexion(true));

// ---------------------------------------------------------
// 7. MENSAJES EN TIEMPO REAL (Firestore onSnapshot)
// ---------------------------------------------------------
function escucharMensajes() {
  actualizarEstadoConexion(false);

  unsubscribeMessages = messagesRef
    .orderBy("timestamp", "asc")
    .onSnapshot(
      (snapshot) => {
        actualizarEstadoConexion(true);
        messagesList.innerHTML = "";

        snapshot.forEach((doc) => {
          renderMensaje(doc.id, doc.data());
        });

        scrollAlFinal();
      },
      (error) => {
        console.error("Error escuchando mensajes:", error);
        actualizarEstadoConexion(false);
      }
    );
}

function renderMensaje(id, data) {
  const { autor, texto, tipo } = data;

  const msgEl = document.createElement("div");

  const botonBorrar = currentUserRole === "admin"
    ? `<button class="msg-delete" data-id="${id}" title="Borrar mensaje"><i class="fa-solid fa-trash"></i></button>`
    : "";

  if (tipo === "sistema") {
    msgEl.className = "msg system";
    msgEl.innerHTML = `
      <div class="msg-bubble">
        <i class="fa-solid fa-circle-question"></i>
        <span>${escapeHTML(texto)}</span>
        ${botonBorrar}
      </div>
      <div class="msg-meta"><span>${escapeHTML(autor)}</span></div>
    `;
  } else if (autor === currentUser) {
    msgEl.className = "msg own";
    msgEl.innerHTML = `
      <div class="msg-bubble">${escapeHTML(texto)} ${botonBorrar}</div>
      <div class="msg-meta">
        <span class="msg-author">Tú</span>
      </div>
    `;
  } else {
    msgEl.className = "msg other";
    msgEl.innerHTML = `
      <div class="msg-bubble">${escapeHTML(texto)} ${botonBorrar}</div>
      <div class="msg-meta">
        <span class="msg-author">${escapeHTML(autor)}</span>
      </div>
    `;
  }

  messagesList.appendChild(msgEl);
}

// ---------- BORRAR MENSAJE (solo admin ve el botón) ----------
messagesList.addEventListener("click", (e) => {
  const boton = e.target.closest(".msg-delete");
  if (!boton) return;

  const id = boton.dataset.id;
  if (!confirm("¿Borrar este mensaje para todos?")) return;

  messagesRef
    .doc(id)
    .delete()
    .catch((error) => {
      console.error("Error borrando mensaje:", error);
      alert("No se pudo borrar el mensaje.");
    });
});

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function scrollAlFinal() {
  messagesList.scrollTop = messagesList.scrollHeight;
}

// ---------------------------------------------------------
// 8. ENVIAR MENSAJE
// ---------------------------------------------------------
messageForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const texto = messageInput.value.trim();
  if (!texto) return;

  enviarMensaje(texto, "usuario");
  messageInput.value = "";
});

function enviarMensaje(texto, tipo) {
  messagesRef
    .add({
      autor: currentUser,
      texto: texto,
      tipo: tipo,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .catch((error) => {
      console.error("Error enviando mensaje:", error);
    });
}

// ---------------------------------------------------------
// 9. PREGUNTAS GUÍA -> MENSAJE DE SISTEMA
// ---------------------------------------------------------
questionCards.forEach((card) => {
  card.addEventListener("click", () => {
    const pregunta = card.dataset.question;
    enviarMensaje(pregunta, "sistema");
  });
});

// ---------------------------------------------------------
// 10. PERSISTENCIA DE SESIÓN AL CARGAR LA PÁGINA
// ---------------------------------------------------------
(function comprobarSesionGuardada() {
  const usuarioGuardado = localStorage.getItem(STORAGE_KEY);
  const rolGuardado = localStorage.getItem(STORAGE_KEY_ROL);

  if (usuarioGuardado) {
    // Si ya inició sesión antes (hardcodeado o registrado), confiamos en localStorage
    currentUser = usuarioGuardado;
    currentUserRole = rolGuardado || "usuario";
    mostrarPantallaChat();
  }
})();
