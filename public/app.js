import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDii_FqpCDTRvvxjJGTyJPIdZmxfwQcO3s",
  authDomain: "convo-ae17e.firebaseapp.com",
  projectId: "convo-ae17e",
  storageBucket: "convo-ae17e.appspot.com",
  messagingSenderId: "1074442682384",
  appId: "1:1074442682384:web:9faa6a60b1b6848a968a95"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// UI refs
const statusEl = document.getElementById("status");
const btnAnon = document.getElementById("btnAnon");
const btnSignOut = document.getElementById("btnSignOut");
const msgForm = document.getElementById("msgForm");
const messagesEl = document.getElementById("messages");

btnAnon.addEventListener("click", async () => {
  btnAnon.disabled = true;
  try { await signInAnonymously(auth); }
  catch (e) { alert("Login error: " + e.message); }
  finally { btnAnon.disabled = false; }
});

btnSignOut.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    statusEl.textContent = `Συνδέθηκες (uid: ${user.uid.slice(0,8)}…)`;
    btnAnon.style.display = "none";
    btnSignOut.style.display = "inline-block";
    msgForm.style.display = "flex";
  } else {
    statusEl.textContent = "Δεν έχεις συνδεθεί.";
    btnAnon.style.display = "inline-block";
    btnSignOut.style.display = "none";
    msgForm.style.display = "none";
    messagesEl.innerHTML = "";
  }
});

// placeholder send
msgForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("msgInput");
  if (!input.value.trim()) return;
  const div = document.createElement("div");
  div.className = "msg";
  div.textContent = input.value.trim();
  messagesEl.appendChild(div);
  input.value = "";
  messagesEl.scrollTop = messagesEl.scrollHeight;
});
