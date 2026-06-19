// Importar módulos de Firebase Web SDK desde CDNs oficiales (v10.9+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    limit, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Configuración de Firebase del usuario
const firebaseConfig = {
  apiKey: "AIzaSyOMC9jPngIdPHiNy2cdTmDccDncKCSudQ",
  authDomain: "debates-literarios.firebaseapp.com",
  projectId: "debates-literarios",
  storageBucket: "debates-literarios.firebasestorage.app",
  messagingSenderId: "229230077953",
  appId: "1:229230077953:web:87e86769ef4c86cda1f800",
  measurementId: "G-6VZEHH6QQY"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Estado de la aplicación
let currentUser = {
    username: "",
    avatarChar: ""
};

// Referencias del DOM
const loginScreen = document.getElementById("login-screen");
const mainScreen = document.getElementById("main-screen");
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username-input");
const currentUserNameDisplay = document.getElementById("current-user-name");
const userAvatarDisplay = document.getElementById("user-avatar");
const exitBtn = document.getElementById("exit-btn");

const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const statusIndicator = document.querySelector(".status-indicator");
const chatStatus = document.getElementById("chat-status");
const questionCards = document.querySelectorAll(".question-card");

// 1. GESTIÓN DE ACCESO (PANTALLAS)
// Revisar si ya hay un usuario guardado localmente
window.addEventListener("DOMContentLoaded", () => {
    const savedUser = localStorage.getItem("chat_username");
    if (savedUser) {
        enterApp(savedUser);
    } else {
        loginScreen.classList.add("active");
    }
});

// Registrar usuario
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (username.length >= 2) {
        localStorage.setItem("chat_username", username);
        enterApp(username);
    }
});

// Salir de la app
exitBtn.addEventListener("click", () => {
    localStorage.removeItem("chat_username");
    currentUser = { username: "", avatarChar: "" };
    
    mainScreen.classList.remove("active");
    loginScreen.classList.add("active");
    
    // Deshabilitar inputs
    messageInput.disabled = true;
    sendBtn.disabled = true;
    
    // Limpiar chat local
    chatMessages.innerHTML = "";
});

// Función para entrar
function enterApp(username) {
    currentUser.username = username;
    currentUser.avatarChar = username.charAt(0);
    
    // Actualizar UI del usuario
    currentUserNameDisplay.textContent = currentUser.username;
    userAvatarDisplay.textContent = currentUser.avatarChar;
    
    // Cambiar pantallas
    loginScreen.classList.remove("active");
    mainScreen.classList.add("active");
    
    // Habilitar entradas de chat
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
    
    // Iniciar escucha del chat en tiempo real
    initChatListener();
}

// 2. CONEXIÓN A FIRESTORE Y CHAT EN TIEMPO REAL
let unsubscribe = null;

function initChatListener() {
    // Si ya había una escucha activa, cancelarla primero
    if (unsubscribe) {
        unsubscribe();
    }
    
    // Crear consulta ordenada por fecha (límite de los últimos 100 mensajes para optimizar)
    const messagesCollection = collection(db, "messages");
    const q = query(messagesCollection, orderBy("timestamp", "asc"), limit(100));
    
    statusIndicator.classList.remove("online");
    chatStatus.textContent = "Conectando al servidor...";
    
    // Iniciar el listener de Firestore
    unsubscribe = onSnapshot(q, (snapshot) => {
        statusIndicator.classList.add("online");
        chatStatus.textContent = "Debate en vivo: Conectado";
        
        // Limpiar el contenedor antes de rellenar
        chatMessages.innerHTML = "";
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            renderMessage(data);
        });
        
        // Scroll automático hacia abajo al recibir un nuevo mensaje
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, (error) => {
        console.error("Error al escuchar cambios en Firestore: ", error);
        statusIndicator.classList.remove("online");
        chatStatus.textContent = "Error de conexión. Reintentando...";
    });
}

// Enviar un mensaje estándar
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    
    messageInput.value = "";
    messageInput.focus();
    
    try {
        await addDoc(collection(db, "messages"), {
            sender: currentUser.username,
            text: text,
            type: "standard",
            timestamp: serverTimestamp()
        });
    } catch (err) {
        console.error("Error al enviar mensaje: ", err);
        alert("No se pudo enviar el mensaje. Inténtalo de nuevo.");
    }
});

// Enviar una pregunta cliqueable a la sala como aviso del sistema
questionCards.forEach(card => {
    card.addEventListener("click", async () => {
        const qText = card.getAttribute("data-q-text");
        const qNum = card.getAttribute("data-q-num");
        
        try {
            // Mandamos un mensaje especial de tipo "system"
            await addDoc(collection(db, "messages"), {
                sender: currentUser.username,
                text: `${currentUser.username} ha propuesto debatir la Pregunta ${qNum}: "${qText}"`,
                type: "system",
                timestamp: serverTimestamp()
            });
        } catch (err) {
            console.error("Error al enviar propuesta de debate: ", err);
        }
    });
});

// 3. RENDERIZACIÓN DE MENSAJES
function renderMessage(data) {
    const messageEl = document.createElement("div");
    
    // Formatear hora de envío (si timestamp aún no se genera en el server, usar hora local temporal)
    const dateObj = data.timestamp ? data.timestamp.toDate() : new Date();
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (data.type === "system") {
        // Mensaje de propuesta de debate
        messageEl.className = "message system";
        messageEl.innerHTML = `
            <div class="message-bubble">
                <i class="fa-solid fa-circle-question"></i>
                <span>${data.text}</span>
            </div>
        `;
    } else {
        // Mensaje estándar de chat
        const isMine = data.sender === currentUser.username;
        messageEl.className = `message ${isMine ? 'mine' : 'other'}`;
        
        messageEl.innerHTML = `
            <div class="message-meta">
                <span class="sender-name">${isMine ? 'Tú' : data.sender}</span>
                <span class="message-time">${timeStr}</span>
            </div>
            <div class="message-bubble">
                ${escapeHTML(data.text)}
            </div>
        `;
    }
    
    chatMessages.appendChild(messageEl);
}

// Función auxiliar para escapar texto y prevenir vulnerabilidades XSS
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
