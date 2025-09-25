// ===================== FIREBASE IMPORTS & CONFIG =====================
const GIPHY_KEY='bCn5Jvx2ZOepneH6fMteNoX31hVfqX25';


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, signInAnonymously, updateProfile, 
  sendPasswordResetEmail, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getDatabase, ref, onChildAdded, onChildRemoved, push, 
  serverTimestamp, set, onValue, update, onDisconnect, get, child, remove 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


  const firebaseConfig = {apiKey:"AIzaSyDii_FqpCDTRvvxjJGTyJPIdZmxfwQcO3s",authDomain:"convo-ae17e.firebaseapp.com",databaseURL:"https://convo-ae17e-default-rtdb.europe-west1.firebasedatabase.app",projectId:"convo-ae17e",storageBucket:"convo-ae17e.firebasestorage.app",messagingSenderId:"1074442682384",appId:"1:1074442682384:web:9faa6a60b1b6848a968a95"};
  const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getDatabase(app);

  // ===================== GLOBAL ELEMENT REFERENCES =====================
const $ = (id) => document.getElementById(id);
  const authView = $('authView'), appView = $('appView'), logoutBtn=$('logoutBtn'), helloUser=$('helloUser');
  const loginForm=$('loginForm'), registerForm=$('registerForm'), anonForm=$('anonForm'), forgotLink=$('forgotLink');
  const roomsList=$('roomsList'), newRoomBtn=$('newRoomBtn'), roomDialog=$('roomDialog'), roomForm=$('roomForm'), roomNameInput=$('roomNameInput');
  const roomTitle=$('roomTitle'), messagesEl=$('messages'), messageForm=$('messageForm'), messageInput=$('messageInput'), usersList=$('usersList');
  const emojiToggle=$('emojiToggle'), emojiPanel=$('emojiPanel'), emojiGrid=$('emojiGrid'), emojiSearch=$('emojiSearch');
  const tabs = document.querySelectorAll('.tab'); const panels = document.querySelectorAll('.tab-panel'); const toastEl=$('toast');




  let currentRoom='general', messagesUnsub=null, presenceUnsub=null;
  let currentUserRole = "user"; // default ρόλος


  const showToast=(msg)=>{toastEl.textContent=msg;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),2500)};
  const switchTab=(name)=>{tabs.forEach(t=>t.classList.toggle('active',t.dataset.tab===name)); panels.forEach(p=>p.classList.toggle('active',p.id===`tab-${name}`))};
  tabs.forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));

  
// ===================== AUTH (Register / Login / Anon / Forgot / Logout) =====================

// ===================== REGISTER FORM =====================
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;

  try {
    // Δημιουργία χρήστη στο Firebase Auth
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // ✅ Ορίζουμε το displayName στο Auth
    await updateProfile(user, { displayName: username });

    // ✅ Αποθήκευση στο Realtime Database
    await set(ref(db, "users/" + user.uid), {
      uid: user.uid,
      displayName: username,
      photoURL: user.photoURL || "",
      status: "online",
      typing: false,
      createdAt: Date.now()
    });

    showToast(`✅ Welcome ${username}!`);
    console.log("User registered:", username, email);

  } catch (err) {
    console.error("Register error:", err);
    showToast("❌ " + err.message);
  }
});

// ===================== LOGIN FORM =====================
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast("✅ Welcome back!");
  } catch (err) {
    console.error("login error", err);
    showToast("❌ " + err.message);
  }
});

// ===================== ANONYMOUS LOGIN =====================
anonForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("anonUsername").value.trim() || "Anon";

  try {
    const cred = await signInAnonymously(auth);
    const user = cred.user;

    // ✅ Βάζουμε το όνομα στο Auth
    await updateProfile(user, { displayName: name });

    // ✅ Γράφουμε χρήστη στο DB
    await set(ref(db, `users/${user.uid}`), {
      uid: user.uid,
      displayName: name,
      email: null,
      photoURL: "",
      anonymous: true,
      createdAt: Date.now(),
      status: "online",
      typing: false
    });

    showToast(`✅ Joined as ${name}`);
    console.log("Anonymous user joined:", name);

  } catch (err) {
    console.error("anon error", err);
    showToast("❌ " + err.message);
  }
});

// ===================== FORGOT PASSWORD =====================
forgotLink?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    showToast("❌ Enter your email first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showToast("✅ Reset email sent.");
  } catch (err) {
    console.error("reset error", err);
    showToast("❌ " + err.message);
  }
});

// ===================== LOGOUT =====================
logoutBtn?.addEventListener("click", () => signOut(auth));

  
// ===================== PRESENCE =====================
async function setupPresence(user) {
  const userRef = ref(db, "users/" + user.uid);

  await set(userRef, {
    uid: user.uid,
    displayName: user.displayName || "Anonymous",
    photoURL: user.photoURL || "https://i.pravatar.cc/40",
    status: "online",
    typing: false
  });

  onDisconnect(userRef).set({
    uid: user.uid,
    displayName: user.displayName || "Anonymous",
    photoURL: user.photoURL || "https://i.pravatar.cc/40",
    status: "offline",
    typing: false
  });
}

  
// ===================== ROOMS (Default / Create / Switch) =====================
// Rooms
const defaultRooms = ['general', 'tech', 'random'];

const renderRooms = async () => {
  roomsList.innerHTML = '';

  // Σιγουρεύουμε ότι υπάρχουν τα default rooms
  await Promise.all(defaultRooms.map(async r => {
    const snap = await get(child(ref(db), `rooms/${r}`));
    if (!snap.exists()) {
      await set(ref(db, `rooms/${r}`), { createdAt: Date.now(), name: r });
    }
  }));

  // Παίρνουμε όλα τα rooms
  const snap = await get(child(ref(db), 'rooms'));
  const rooms = snap.exists() ? Object.keys(snap.val()).sort() : defaultRooms;

  // Δημιουργία DOM
  rooms.forEach(r => {
  const div = document.createElement('div');
  div.className = 'room-item' + (r === currentRoom ? ' active' : '');
  div.dataset.name = r;  // 👈 σημαντικό

    // όνομα room
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `#${r}`;

    // counter badge
    const countSpan = document.createElement('span');
    countSpan.className = 'room-count';
    countSpan.textContent = "0"; // default

    // βάζουμε name και counter στο div
    div.appendChild(nameSpan);
    div.appendChild(countSpan);

    div.addEventListener('click', () => switchRoom(r));
    roomsList.appendChild(div);
  });

  updateRoomCounts(); // φρεσκάρει τους counters
};
const switchRoom = (room) => {
  currentRoom = room;
  roomTitle.textContent = `#${room}`;
  document.querySelectorAll('.room-item').forEach(el =>
    el.classList.toggle('active', el.textContent === `#${room}`)
  );

  if (typeof messagesUnsub === 'function') messagesUnsub();
  messagesEl.innerHTML = '';

  const roomRef = ref(db, `messages/${room}`);

  // 📥 Νέα μηνύματα
  messagesUnsub = onChildAdded(roomRef, (snap) => { 
    const m = snap.val(); 
    m.id = snap.key;   
    appendMessage(m, auth.currentUser?.uid); 
  });

  // 🗑 Διαγραμμένα μηνύματα
  onChildRemoved(roomRef, (snap) => {
    const el = messagesEl.querySelector(`[data-id="${snap.key}"]`);
    if (el) {
      el.remove();  // 🔥 φεύγει από UI χωρίς F5
    }
  });
};

  // 🎵 Καθάρισε YouTube player όταν αλλάζεις δωμάτιο
  const playerDiv = document.getElementById("youtubePlayer");
  if (playerDiv) {
    playerDiv.innerHTML = '<button id="closePlayerBtn" class="close-player">✖</button>';
    playerDiv.classList.remove("active");
  }


  newRoomBtn?.addEventListener('click',()=>{ roomDialog.showModal(); roomNameInput.value=''; setTimeout(()=>roomNameInput.focus(),50); });
  roomForm?.addEventListener('submit',async(e)=>{
    e.preventDefault();
    const name=roomNameInput.value.trim().toLowerCase().replace(new RegExp('\\s+','g'),'-').replace(new RegExp('[^a-z0-9_-]','g'),'');
    if(!name) return roomDialog.close(); await set(ref(db,`rooms/${name}`),{createdAt:Date.now(),name}); roomDialog.close(); await renderRooms(); switchRoom(name);
  });
 
  // === Helper για να φέρνουμε το photoURL από users/$uid ===
async function getUserPhotoURL(uid) {
  const snap = await get(ref(db, "users/" + uid + "/photoURL"));
  return snap.exists() ? snap.val() : null;
}


// === YouTube Helpers ===
function extractVideoId(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
}


function playYouTube(url) {
  const videoId = extractVideoId(url);
  if (!videoId) return;

  const playerDiv = document.getElementById("youtubePlayer");

  // Βάζουμε iframe + κουμπιά
  playerDiv.innerHTML = `
    <button id="closePlayerBtn" class="close-player">✖</button>
    <button id="expandPlayerBtn" class="expand-player">⤢</button>
    <iframe 
      src="https://www.youtube.com/embed/${videoId}?autoplay=1"
      frameborder="0"
      allow="autoplay; encrypted-media"
      allowfullscreen>
    </iframe>
  `;
  playerDiv.classList.add("active"); // δείξε το panel

  // ✖ close
  document.getElementById("closePlayerBtn").addEventListener("click", () => {
    playerDiv.innerHTML = `
      <button id="closePlayerBtn" class="close-player">✖</button>
      <button id="expandPlayerBtn" class="expand-player">⤢</button>
    `;
    playerDiv.classList.remove("active", "expanded");
  });

  // ⤢ expand
  document.getElementById("expandPlayerBtn").addEventListener("click", () => {
    playerDiv.classList.toggle("expanded");
  });
}

// ===================== MESSAGES =====================
messageForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

const text = messageInput.value.trim();
if (!text) return;

// === YouTube check ===
if (text.includes("youtube.com") || text.includes("youtu.be")) {
  playYouTube(text);   // ανοίγει το video πάνω από το chat
  // προχωράμε κανονικά για να σταλεί και σαν μήνυμα
}

  
  const isGif = /\.(gif)(\?|$)/i.test(text) || /giphy\.com\/media\//i.test(text);
  const photoURL = await getUserPhotoURL(user.uid);

  const msg = {
    uid: user.uid,
    name: user.displayName || "User",
    text,
    ts: Date.now(),
    photoURL: photoURL
  };

  console.log("📨 Sending message:", msg);

  await push(ref(db, `messages/${currentRoom}`), msg);

  // Reset input
  messageInput.value = "";
  messageInput.style.height = "";  // default ύψος

  // 🆕 Κλείσιμο emoji panel με class
  emojiPanel?.classList.remove("show");
});

// ===================== ENTER / SHIFT+ENTER =====================
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); 
    messageForm.requestSubmit(); // αποστολή με Enter
  }
});

// ===================== AUTO-GROW + TYPING =====================
let typingTimeout;

messageInput.addEventListener("input", () => {
  // Auto-grow textarea
  messageInput.style.height = "auto";
  messageInput.style.height = messageInput.scrollHeight + "px";

  // Typing indicator
  update(ref(db, "users/" + auth.currentUser.uid), {
    typing: true
  });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    update(ref(db, "users/" + auth.currentUser.uid), {
      typing: false
    });
  }, 2000);
});



 
// αυτή η function υπάρχει ήδη πιο κάτω, άστην ξεχωριστά
const makeInitials = (name = '?') => (name.trim()[0] || '?').toUpperCase();

  
const appendMessage = (m, myUid) => {
  const row = document.createElement('div'); 
  row.classList.add('message', 'msg-row');  // 👈 class="message msg-row"
  if (m.uid === myUid) row.classList.add('mine');

  row.dataset.id = m.id;   // 👈 περνάμε το Firebase key



// === Avatar ===
const avatar = document.createElement('div');
let avatarClasses = 'avatar';
if (m.name === 'MysteryMan') avatarClasses += ' admin';
if (m.state === 'online') avatarClasses += ' online';
else avatarClasses += ' offline';
avatar.className = avatarClasses;

if (m.photoURL) {
  const img = document.createElement('img');
  img.src = m.photoURL;
  img.alt = m.name || 'U';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.borderRadius = '50%';
  avatar.appendChild(img);
} else {
  avatar.textContent = (m.name || 'U')[0].toUpperCase();
}

  // === Bubble ===
  const bubble = document.createElement('div'); 
  bubble.className = 'bubble';

  // Huge emoji check
  if (m.text && /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\s)+$/u.test(m.text.trim())) {
    bubble.classList.add('huge-emoji');
  }

  // Meta (όνομα + ώρα)
  const meta = document.createElement('div'); 
  meta.className = 'meta'; 
  const time = new Date(m.ts || Date.now()).toLocaleTimeString();
  const nameHtml = m.name === 'MysteryMan'
    ? `<strong style="color:#ffb703">${escapeHtml(m.name)}</strong> <span class="badge admin">ADMIN</span>`
    : `<strong>${escapeHtml(m.name)}</strong>`;
  meta.innerHTML = `${nameHtml} <span style="opacity:.6">(${time})</span>`;

// Text, YouTube ή GIF
const text = document.createElement('div'); 
text.className = 'text'; 

(function() {
  // === YouTube check ===
  if (m.text && (m.text.includes("youtube.com") || m.text.includes("youtu.be"))) {
    const videoId = extractVideoId(m.text);
    if (videoId) {
      text.innerHTML = `
        <div class="yt-preview">
          <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="YouTube Thumbnail">
          <span>▶ YouTube Video</span>
        </div>
      `;
      // κάνε το thumbnail clickable -> παίζει στο πάνω player
      text.querySelector('.yt-preview').addEventListener('click', () => playYouTube(m.text));
      return; // ✅ σταματάει εδώ
    }
  }

  // === GIF check ===
  const isGif = m.isGif || /\.(gif)(\?|$)/i.test(m.text) || /giphy\.com\/media\//i.test(m.text); 
  if (isGif) {
    const img = document.createElement('img'); 
    img.src = m.text; 
    img.alt = 'gif'; 
    img.className = 'msg-gif'; 
    text.appendChild(img);
  } 
  // === Default text ===
  else { 
    text.innerHTML = linkify(escapeHtml(m.text)); 
  }
})();

bubble.appendChild(meta); 
bubble.appendChild(text);


  // === Reactions (Firebase) ===
  const reactions = document.createElement('div');
  reactions.className = 'reactions';

  const reactBtn = document.createElement('div');
  reactBtn.className = 'reaction-toggle';
  reactBtn.textContent = '🙂';
  reactions.appendChild(reactBtn);

  const menu = document.createElement('div');
  menu.className = 'reaction-menu';
  menu.style.display = 'none';

  const availableReactions = ['👍','❤️','😂','😮','😢','👎','😡'];
  availableReactions.forEach(symbol => {
    const option = document.createElement('div');
    option.className = 'reaction-option';
    option.textContent = symbol;
    option.addEventListener('click', () => {
      toggleReaction(m.id, symbol);
      menu.style.display = 'none';
    });
    menu.appendChild(option);
  });
  reactions.appendChild(menu);

  reactBtn.addEventListener('click', () => {
    menu.style.display = (menu.style.display === 'none' ? 'flex' : 'none');
  });

  const msgRef = ref(db, `messages/${currentRoom}/${m.id}/reactions`);
  onValue(msgRef, (snap) => {
    const data = snap.val() || {};
    renderReactions(reactions, data, m.id);
  });

  bubble.appendChild(reactions);

  // === Τελικό δέσιμο ===
  row.appendChild(avatar); 
  row.appendChild(bubble); 
  messagesEl.appendChild(row); 
  messagesEl.scrollTop = messagesEl.scrollHeight;
};

function renderReactions(container, data, msgId) {
  container.querySelectorAll('.reaction').forEach(el => el.remove());

  // φτιάχνουμε array με reactions + counts
  const entries = Object.entries(data).map(([symbol, users]) => ({
    symbol,
    count: Object.keys(users).length,
    users
  }));

  // ταξινόμηση από μεγαλύτερο προς μικρότερο
  entries.sort((a, b) => b.count - a.count);

  entries.forEach(({symbol, count, users}) => {
    if (count > 0) {
      const btn = document.createElement('div');
      btn.className = 'reaction';
      btn.dataset.symbol = symbol;
      btn.innerHTML = `${symbol} <span class="count">${count}</span>`;

      // tooltip με user names
      btn.title = Object.values(users).join(', ');

      btn.onclick = () => toggleReaction(msgId, symbol, auth.currentUser?.uid);


      // 🎉 animation pop σε κάθε αλλαγή
      btn.classList.remove("pop");
      void btn.offsetWidth; // restart trick
      btn.classList.add("pop");

      container.appendChild(btn);
    }
  });
}



function toggleReaction(msgId, symbol) {
  const user = auth.currentUser;
  if (!user) return;
  const userRef = ref(db, `messages/${currentRoom}/${msgId}/reactions/${symbol}/${user.uid}`);
  get(userRef).then(snap => {
    if (snap.exists()) {
      remove(userRef);
    } else {
      set(userRef, true);
    }
  });
}


  function updateRoomCounts() {
  get(ref(db, 'status')).then(snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    const onlineCount = Object.values(data).filter(s => s.state === 'online').length;

    document.querySelectorAll('.room-item .room-count').forEach(span => {
      span.textContent = onlineCount;
    });
  });
}

// κάθε φορά που αλλάζει το presence, ξανατρέχει
onValue(ref(db, 'status'), () => {
  updateRoomCounts();
});


// ===================== USERS LIST & ROLES =====================
const watchPresence = () => {
  if (presenceUnsub) presenceUnsub();
  presenceUnsub = onValue(ref(db, 'users'), (snap) => {
    const data = snap.val() || {};

    document.getElementById("adminsList").innerHTML = "";
    document.getElementById("modsList").innerHTML = "";
    document.getElementById("vipList").innerHTML = "";
    document.getElementById("normalList").innerHTML = "";

    const seen = new Set(); // ✅ για να μην μπει κάποιος 2η φορά

    Object.entries(data).forEach(([uid, u]) => {
      if (seen.has(uid)) return;
      seen.add(uid);

      const li = document.createElement('li');

      // === Avatar ===
      const avatar = document.createElement('div');
      avatar.className = 'avatar ' + (u.status === 'online' ? 'online' : 'offline');

      if (u.photoURL) {
        const img = document.createElement('img');
        img.src = u.photoURL;
        img.alt = u.displayName || 'U';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        avatar.appendChild(img);
      } else {
        avatar.textContent = (u.displayName || 'U')[0].toUpperCase();
      }

      // === Status dot ===
      const dot = document.createElement('span');
      dot.className = 'status-dot ' + (u.status === 'online' ? 'online' : 'offline');

      // === Username ===
      const name = document.createElement('span');
      name.textContent = u.displayName || 'User';

      // === Badge ===
      let badge = null;
      if ((u.displayName || '') === 'MysteryMan') {
        badge = document.createElement('span');
        badge.className = 'badge admin';
        badge.textContent = '🛡️ ADMIN';
        name.innerHTML = `<strong style="color:#ffb703">${u.displayName}</strong>`;
        li.classList.add("admin");
        document.getElementById("adminsList").appendChild(li);
      } else if (u.role === "mod") {
        badge = document.createElement('span');
        badge.className = 'badge mod';
        badge.textContent = '🛠️ MOD';
        name.innerHTML = `<span style="color:#06d6a0">${u.displayName}</span>`;
        li.classList.add("mod");
        document.getElementById("modsList").appendChild(li);
      } else if (u.role === "vip") {
        badge = document.createElement('span');
        badge.className = 'badge vip';
        badge.textContent = '💎 VIP';
        name.innerHTML = `<span style="color:#7209b7">${u.displayName}</span>`;
        li.classList.add("vip");
        document.getElementById("vipList").appendChild(li);
      } else {
        li.classList.add("user");
        document.getElementById("normalList").appendChild(li);
      }

      // === Name wrapper ===
      const nameWrapper = document.createElement('div');
      nameWrapper.className = 'name-wrapper';
      nameWrapper.appendChild(name);
      if (badge) nameWrapper.appendChild(badge);

      // === Typing indicator ===
      if (u.typing) {
        const typingEl = document.createElement('div');
        typingEl.className = 'typing-indicator';
        typingEl.textContent = '✍️ typing…';
        nameWrapper.appendChild(typingEl);
      }

      // === Append row ===
      li.appendChild(avatar);
      li.appendChild(dot);
      li.appendChild(nameWrapper);
    });

    // ✅ Update counters αφού γεμίσουν οι λίστες
    setTimeout(() => {
      document.getElementById("adminsCount").textContent = document.getElementById("adminsList").childElementCount;
      document.getElementById("modsCount").textContent   = document.getElementById("modsList").childElementCount;
      document.getElementById("vipCount").textContent    = document.getElementById("vipList").childElementCount;
      document.getElementById("usersCount").textContent  = document.getElementById("normalList").childElementCount;
    }, 0);
  });
};


// ===================== AUTH STATE HANDLING =====================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // === Avatar check ===
    if (!user.photoURL) {
      const avatarId = Math.abs(hashCode(user.uid)) % 70 + 1; // pravatar έχει ~70 images
      const stableAvatar = `https://i.pravatar.cc/150?img=${avatarId}`;

      try {
        await updateProfile(user, { photoURL: stableAvatar });
        console.log("✅ Avatar set for user:", stableAvatar);
      } catch (err) {
        console.error("❌ Avatar update failed:", err);
      }
    }

    // === Ενημέρωση Firebase DB με user info ===
    await set(ref(db, "users/" + user.uid), {
      uid: user.uid,
      displayName: user.displayName || "Anonymous",
      photoURL: user.photoURL || "",
      status: "online",
      typing: false
    });

    // === Clear Chat Button (μόνο για admin) ===
    const clearChatBtn = document.getElementById("clearChatBtn");
    if (user.displayName === "MysteryMan") {
      currentUserRole = "admin";
      clearChatBtn.style.display = "inline-block";

      clearChatBtn.addEventListener("click", async () => {
        if (!confirm("⚠️ Να διαγραφούν όλα τα μηνύματα από αυτό το room;")) return;
        try {
          const room = document.getElementById("roomTitle").textContent.replace("#", "");
          await remove(ref(db, "messages/" + room));
          document.getElementById("messages").innerHTML = "";
          console.log("🗑 Chat cleared for room:", room);
        } catch (err) {
          console.error("clearChat error:", err);
        }
      });
    } else {
      currentUserRole = "user";
      clearChatBtn.style.display = "none";
    }

    // === Header avatar από DB ===
    const headerAvatar = document.getElementById("headerAvatar");
    onValue(ref(db, "users/" + user.uid), (snap) => {
      const u = snap.val() || {};
      if (headerAvatar) {
        headerAvatar.innerHTML = u.photoURL
          ? `<img src="${u.photoURL}" alt="avatar">`
          : `<span>${(u.displayName || "U")[0].toUpperCase()}</span>`;
      }
    });

    // === Presence + rooms ===
    await setupPresence(user);
    await renderRooms();
    switchRoom(currentRoom);
    watchPresence();

    // === Εμφάνιση εφαρμογής ===
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    helloUser.textContent = `Hello, ${user.displayName || "User"}!`;

  } else {
    // ❌ Δεν υπάρχει user → δείξε την οθόνη login
    appView.classList.add("hidden");
    authView.classList.remove("hidden");
    helloUser.textContent = "";
    if (messagesUnsub) messagesUnsub();
    if (presenceUnsub) presenceUnsub();
  }
}); // 👈 Τέλος onAuthStateChanged

// Utils
function escapeHtml(str = '') {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
function linkify(text = '') {
  const urlRegex = new RegExp('https?:\\/\\/[^\\s]+', 'g');
  return text.replace(urlRegex, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>');
}
function updateStatus(newStatus) {
  if (!auth.currentUser) return;
  const userRef = ref(db, "users/" + auth.currentUser.uid);
  update(userRef, {
    status: newStatus,
    online: newStatus === "online"
  });
}

// Helper για να δίνει σταθερό id από string (avatar επιλογή)
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

// ===================== EMOJI / GIF / STICKERS PICKER =====================
// Emoji Picker
  const EMOJIS=[["😀","grinning happy smile"],["😃","smile open"],["😄","smile grin"],["😁","grin"],["😆","laugh"],["😅","sweat laugh"],["🤣","rofl rolling floor laughing"],["😂","joy tears"],["🙂","slight smile"],["🙃","upside down"],["😉","wink"],["😊","blush"],["😇","innocent angel"],["🥰","in love hearts"],["😍","heart eyes"],["🤩","star struck"],["😘","kiss"],["😗","kiss"],["😙","kiss"],["😚","kiss"],["😋","yum"],["😛","tongue"],["😜","winking tongue"],["🤪","zany"],["😝","squint tongue"],["🤑","money"],["🤗","hug"],["🤭","oops"],["🤫","shush"],["🤔","thinking"],["🤐","zipper mouth"],["😐","neutral"],["😑","expressionless"],["😶","no mouth"],["😏","smirk"],["😒","unamused"],["🙄","eyeroll"],["😬","grimace"],["🤥","lying"],["😌","relieved"],["😔","pensive"],["😪","sleepy"],["🤤","drool"],["😴","sleeping"],["😷","mask"],["🤒","thermometer"],["🤕","head bandage"],["🤧","sneeze"],["🥵","hot"],["🥶","cold"],["🥴","woozy"],["😵","dizzy"],["🤯","mind blown"],["🤠","cowboy"],["🥳","party"],["😎","cool sunglasses"],["🤓","nerd"],["🫡","salute"],["👍","thumbs up like"],["👎","thumbs down"],["👏","clap"],["🙏","pray thanks"],["👌","ok"],["✌️","victory peace"],["🤝","handshake"],["💪","muscle"],["👀","eyes look"],["👋","wave"],["🔥","fire lit"],["✨","sparkles"],["❤️","heart love"],["🧡","heart orange"],["💛","heart yellow"],["💚","heart green"],["💙","heart blue"],["💜","heart purple"],["💯","100"],["💩","poop"],["🎉","tada party"],["🎂","cake birthday"],["🍕","pizza"],["🍔","burger"],["☕","coffee"]];
  function renderEmojiGrid(filter=""){ const frag=document.createDocumentFragment(); const normalized=filter.trim().toLowerCase(); const list=EMOJIS.filter(([e,k])=>!normalized||k.includes(normalized)); list.forEach(([emoji])=>{ const div=document.createElement('div'); div.className='emoji-item'; div.textContent=emoji; div.title=emoji; div.addEventListener('click',()=>{ messageInput.value+=emoji; messageInput.focus(); }); frag.appendChild(div); }); emojiGrid.innerHTML=''; emojiGrid.appendChild(frag); }
 function launchEmojiTrail(panel) {
  const EMOJIS = ["😀","😂","😍","😎","🎉","🔥"];
  for (let i = 0; i < 4; i++) {
    const span = document.createElement("span");
    span.className = "emoji-pop";
    span.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    span.style.left = (20 + i*25) + "px"; // μικρό offset
    span.style.top = "-10px"; // ξεκινάει λίγο πάνω από το panel
    panel.appendChild(span);
    setTimeout(() => span.remove(), 600);
  }
}

  emojiToggle.addEventListener('click',()=>{ 
  emojiPanel.classList.toggle('show'); 
  if(emojiPanel.classList.contains('show')){
    renderEmojiGrid("");
    emojiSearch.value="";
    emojiSearch.focus();
    launchEmojiTrail(emojiPanel); // 🎉 πετάνε τα emoji!
  }
});

  setEmojiActiveTab && setEmojiActiveTab('emoji');
  emojiSearch.addEventListener('input',(e)=>renderEmojiGrid(e.target.value));
  document.addEventListener('click',(e)=>{ if(!emojiPanel.contains(e.target) && e.target!==emojiToggle){ emojiPanel.classList.remove('show'); } });
// Κλείσιμο με Esc
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && emojiPanel.classList.contains('show')) {
    emojiPanel.classList.remove('show');
    emojiPanel.setAttribute('aria-hidden', 'true');
  }
});  
// === GIF inside emoji panel ===
const gifTabBtn=$('gifTabBtn'), emojiTabBtn=$('emojiTabBtn');
const gifBody=$('gifBody'), gifGrid=$('gifGrid');

function setEmojiActiveTab(name){
  // tabs active class
  document.querySelectorAll('#emojiPanel .emoji-tab').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab===name);
  });
  // bodies
  document.querySelectorAll('#emojiPanel .emoji-body').forEach(b=>b.classList.remove('active'));
  if(name==='gif'){ gifBody.classList.add('active'); }
  else if(name==='stickers'){ stickerBody.classList.add('active'); }
  else { document.querySelector('#emojiPanel .emoji-body:not(#gifBody):not(#stickerBody)').classList.add('active'); }
}
async function loadTrendingGifs(){
  // δείξε προσωρινό μήνυμα
  gifGrid.innerHTML = '<div style="padding:16px;text-align:center">Loading GIFs...</div>';

  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=60&rating=g`);
    const data = await res.json();
    renderGifGrid(data.data || []);
  } catch (e) { 
    gifGrid.innerHTML = '<div style="padding:16px">Failed to load GIFs</div>'; 
  }
}

async function searchGifs(q){
  try{
    const res=await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=60&rating=g`);
    const data=await res.json();
    renderGifGrid(data.data||[]);
  }catch(e){ gifGrid.innerHTML='<div style="padding:16px">Search failed</div>'; }
}
function renderGifGrid(items){
  if (!items.length) { 
    gifGrid.innerHTML = '<div style="padding:16px">No GIFs</div>'; 
    return; 
  }
  const frag = document.createDocumentFragment();
  items.forEach(g => {
    const fixed = g.images && (g.images.fixed_width || g.images.preview_gif || g.images.original);
    const url = fixed ? fixed.url : (g.images?.original?.url || g.url);

    const item = document.createElement('div'); 
    item.className = 'gif-item';

    const img = document.createElement('img'); 
    img.loading = 'lazy'; 
    img.src = url; 
    img.alt = g.title || 'gif';
    item.appendChild(img);

    item.addEventListener('click', async () => {
      const user = auth.currentUser; 
      if (!user) return;
      const msg = {
        uid: user.uid,
        name: user.displayName || 'User',
        text: url,
        isGif: true,
        ts: Date.now()
      };
      try {
        await push(ref(db, `messages/${currentRoom}`), msg);
      } catch(e) { 
        console.error('send gif error', e); 
      }
      emojiPanel.classList.remove('show');
    });

    frag.appendChild(item);
  });
  gifGrid.innerHTML = ''; 
  gifGrid.appendChild(frag);
}

// Hook tabs
gifTabBtn && gifTabBtn.addEventListener('click', ()=>{ setEmojiActiveTab('gif'); loadTrendingGifs(); });
emojiTabBtn && emojiTabBtn.addEventListener('click', ()=>{ setEmojiActiveTab('emoji'); });
// When opening the panel, default to Emoji but user can switch to GIF

// --- GIF search button wiring ---
const gifSearchBtn = $('gifSearchBtn');
if (gifSearchBtn) {
  gifSearchBtn.addEventListener('click', () => {
    // Use the same input as emoji search
    const q = (emojiSearch && emojiSearch.value || '').trim();
    if (q) { searchGifs(q); } else { loadTrendingGifs(); }
  });
}
// On Enter in search box while GIF tab is active, run search
if (emojiSearch) {
  emojiSearch.addEventListener('keydown', (e) => {
    const isGifActive = gifBody && gifBody.classList.contains('active');
    if (isGifActive && e.key === 'Enter') {
      e.preventDefault();
      const q = (emojiSearch.value || '').trim();
      if (q) { searchGifs(q); } else { loadTrendingGifs(); }
    }
  });
}
// --- Unified search for Emoji + GIF + Stickers ---
function doUnifiedSearch(){
  const q = (emojiSearch && emojiSearch.value || '').trim();
  const gifActive = gifBody && gifBody.classList.contains('active');
  const stickerActive = stickerBody && stickerBody.classList.contains('active');
  const emojiActive = emojiBody && emojiBody.classList.contains('active');

  if (gifActive){
    if (q) { searchGifs(q); } else { loadTrendingGifs(); }
  } else if (stickerActive){
    if (q) { searchStickers(q); } else { loadTrendingStickers(); }
  } else if (emojiActive){
    renderEmojiGrid(q);
  }
}

const unifiedSearchBtn = $('unifiedSearchBtn');
if (unifiedSearchBtn){
  unifiedSearchBtn.addEventListener('click', doUnifiedSearch);
}

if (emojiSearch){
  emojiSearch.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter'){
      e.preventDefault();
      doUnifiedSearch();
    }
  });
}

// === Stickers inside emoji panel ===
const stickerTabBtn=$('stickerTabBtn');
const stickerBody=$('stickerBody');
const stickerGrid=$('stickerGrid');

async function loadTrendingStickers(){
  // δείξε προσωρινό μήνυμα
  stickerGrid.innerHTML = '<div style="padding:16px;text-align:center">Loading Stickers...</div>';

  try {
    const res = await fetch(`https://api.giphy.com/v1/stickers/trending?api_key=${GIPHY_KEY}&limit=60&rating=g`);
    const data = await res.json();
    renderStickerGrid(data.data || []);
  } catch (e) { 
    stickerGrid.innerHTML = '<div style="padding:16px">Failed to load Stickers</div>'; 
  }
}

async function searchStickers(q){
  try{
    const res=await fetch(`https://api.giphy.com/v1/stickers/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=60&rating=g`);
    const data=await res.json();
    renderStickerGrid(data.data||[]);
  }catch(e){ stickerGrid.innerHTML='<div style="padding:16px">Search failed</div>'; }
}
function renderStickerGrid(items){
  if (!items.length) { 
    stickerGrid.innerHTML = '<div style="padding:16px">No Stickers</div>'; 
    return; 
  }
  const frag = document.createDocumentFragment();
  items.forEach(s => {
    const fixed = s.images && (s.images.fixed_width || s.images.original);
    const url = fixed ? fixed.url : (s.images?.original?.url || s.url);

    const item = document.createElement('div'); 
    item.className = 'sticker-item';

    const img = document.createElement('img'); 
    img.loading = 'lazy'; 
    img.src = url; 
    img.alt = s.title || 'sticker';
    item.appendChild(img);

    item.addEventListener('click', async () => {
      const user = auth.currentUser; 
      if (!user) return;
      const msg = {
        uid: user.uid,
        name: user.displayName || 'User',
        text: url,
        isGif: true, // ίδιο flag με τα gif
        ts: Date.now()
      };
      try {
        await push(ref(db, `messages/${currentRoom}`), msg);
      } catch(e) { 
        console.error('send sticker error', e); 
      }
      emojiPanel.classList.remove('show');
    });

    frag.appendChild(item);
  });
  stickerGrid.innerHTML = ''; 
  stickerGrid.appendChild(frag);
}

// Hook sticker tab
stickerTabBtn && stickerTabBtn.addEventListener('click', ()=>{ setEmojiActiveTab('stickers'); loadTrendingStickers(); });
// ===================== USER CONTEXT MENU =====================
// Context menu για users
const userContextMenu = document.getElementById("userContextMenu");
let contextTargetUser = null;

// Δεξί κλικ σε user
document.addEventListener("contextmenu", (e) => {
  const li = e.target.closest("li");
  if (li && li.parentElement.classList.contains("users-sublist")) {
    e.preventDefault();
    contextTargetUser = li;
    userContextMenu.style.display = "block";

    // Υπολογισμός θέσης με βάση τα όρια της οθόνης
    const menuWidth = userContextMenu.offsetWidth;
    const menuHeight = userContextMenu.offsetHeight;

    let posX = e.pageX;
    let posY = e.pageY;

    if (posX + menuWidth > window.innerWidth) {
      posX = window.innerWidth - menuWidth - 10;
    }
    if (posY + menuHeight > window.innerHeight) {
      posY = window.innerHeight - menuHeight - 10;
    }

    userContextMenu.style.left = `${posX}px`;
    userContextMenu.style.top = `${posY}px`;

  } else {
    userContextMenu.style.display = "none";
  }
});

// ===== Handlers για τα menu items =====
document.getElementById("ctxAddFriend").addEventListener("click", () => {
  if (!contextTargetUser || !auth.currentUser) return;

  const friendUid = contextTargetUser.dataset.uid;

  // Τραβάμε τα στοιχεία του φίλου από Firebase
  get(ref(db, `users/${friendUid}`)).then(snapshot => {
    if (snapshot.exists()) {
      const friendData = snapshot.val();
      const friendName = friendData.displayName || "Anonymous";

      // Σώζουμε στο δικό μας προφίλ -> friends
      set(ref(db, `users/${auth.currentUser.uid}/friends/${friendUid}`), {
        name: friendName,
        uid: friendUid
      }).then(() => {
        showToast(`✅ ${friendName} added as friend`);
      }).catch(err => console.error("Error adding friend:", err));
    } else {
      console.error("❌ Friend not found in DB");
    }
  });

  userContextMenu.style.display = "none";
});

document.getElementById("ctxRemoveFriend").addEventListener("click", () => {
  if (!contextTargetUser || !auth.currentUser) return;
  const friendUid = contextTargetUser.dataset.uid;
  const friendName = contextTargetUser.querySelector("span")?.textContent;

  remove(ref(db, `users/${auth.currentUser.uid}/friends/${friendUid}`))
    .then(() => showToast(`❌ ${friendName} removed from friends`))
    .catch(err => console.error("Error removing friend:", err));

  userContextMenu.style.display = "none";
});

document.getElementById("ctxBlock").addEventListener("click", () => {
  if (!contextTargetUser || !auth.currentUser) return;
  const friendUid = contextTargetUser.dataset.uid;
  const friendName = contextTargetUser.querySelector("span")?.textContent;

  set(ref(db, `users/${auth.currentUser.uid}/blocked/${friendUid}`), {
    name: friendName
  }).then(() => {
    showToast(`⛔ ${friendName} blocked`);
  }).catch(err => console.error("Error blocking user:", err));

  userContextMenu.style.display = "none";
});

document.getElementById("ctxUnblock").addEventListener("click", () => {
  if (!contextTargetUser || !auth.currentUser) return;
  const friendUid = contextTargetUser.dataset.uid;
  const friendName = contextTargetUser.querySelector("span")?.textContent;

  remove(ref(db, `users/${auth.currentUser.uid}/blocked/${friendUid}`))
    .then(() => showToast(`✅ ${friendName} unblocked`))
    .catch(err => console.error("Error unblocking user:", err));

  userContextMenu.style.display = "none";
});

// ===================== ROOM CONTEXT MENU =====================
// ⚠️ Το roomsList έχει δηλωθεί ήδη πιο πάνω, οπότε εδώ ΔΕΝ το ξαναδηλώνουμε
const roomMenu      = document.getElementById("roomContextMenu");
const joinRoomBtn   = document.getElementById("joinRoom");
const leaveRoomBtn  = document.getElementById("leaveRoom");
const renameRoomBtn = document.getElementById("renameRoom");
const deleteRoomBtn = document.getElementById("deleteRoom");

let clickedRoom = null;

// Δεξί κλικ πάνω σε room -> εμφάνιση context menu
roomsList.addEventListener("contextmenu", (e) => {
  const roomEl = e.target.closest(".room-item");
  if (!roomEl) return;

  e.preventDefault();
  clickedRoom = roomEl;

  // Υπολογισμός θέσης με βάση το click
  roomMenu.style.top = e.pageY + "px";
  roomMenu.style.left = e.pageX + "px";
  roomMenu.style.display = "block";
});

// Κλείσιμο context menu με click έξω ή ESC
document.addEventListener("click", (e) => {
  if (roomMenu && roomMenu.style.display === "block" && !roomMenu.contains(e.target)) {
    roomMenu.style.display = "none";
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && roomMenu.style.display === "block") {
    roomMenu.style.display = "none";
  }
});

// ===================== ROOM ACTIONS =====================

// 🗑 DELETE ROOM
deleteRoomBtn.addEventListener("click", () => {
  if (!clickedRoom) return;
  const roomName = clickedRoom.dataset.name;  // <--- ΠΡΕΠΕΙ να υπάρχει data-name στο HTML
  if (!roomName) return;

  console.log("🗑 Προσπάθεια διαγραφής:", roomName);

  remove(ref(db, "rooms/" + roomName))
    .then(() => {
      console.log("✅ Room deleted:", roomName);
      clickedRoom.remove(); // φεύγει και από UI
    })
    .catch((err) => console.error("❌ Delete error:", err));

  roomMenu.style.display = "none";
});

// ✏️ RENAME ROOM
renameRoomBtn.addEventListener("click", async () => {
  if (!clickedRoom) return;
  const oldName = clickedRoom.dataset.name;
  if (!oldName) return;

  const newName = prompt("Νέο όνομα δωματίου:", oldName);
  if (!newName || newName === oldName) return;

  const oldRef = ref(db, "rooms/" + oldName);
  const newRef = ref(db, "rooms/" + newName);

  try {
    const snap = await get(oldRef);
    if (snap.exists()) {
      await set(newRef, snap.val());   // copy data
      await remove(oldRef);            // delete old
      console.log(`✅ Room renamed: ${oldName} → ${newName}`);

      // update UI
      clickedRoom.dataset.name = newName;
      clickedRoom.textContent = "#" + newName;
    }
  } catch (err) {
    console.error("❌ Rename error:", err);
  }

  roomMenu.style.display = "none";
});


// JOIN (απλό demo για τώρα)
joinRoomBtn.addEventListener("click", () => {
  if (!clickedRoom) return;
  showToast("JOIN room: " + clickedRoom.textContent);
  roomMenu.style.display = "none";
});

// LEAVE (απλό demo για τώρα)
leaveRoomBtn.addEventListener("click", () => {
  if (!clickedRoom) return;
  showToast("LEAVE room: " + clickedRoom.textContent);
  roomMenu.style.display = "none";
});


// ===================== ROOM MENU CLOSE HANDLERS =====================
document.addEventListener("click", (e) => {
  if (roomMenu && roomMenu.style.display === "block" && !roomMenu.contains(e.target)) {
    roomMenu.style.display = "none";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && roomMenu && roomMenu.style.display === "block") {
    roomMenu.style.display = "none";
  }
});

// ===================== USER MENU CLOSE HANDLERS =====================
document.addEventListener("click", (e) => {
  if (userContextMenu && userContextMenu.style.display === "block" && !userContextMenu.contains(e.target)) {
    userContextMenu.style.display = "none";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && userContextMenu && userContextMenu.style.display === "block") {
    userContextMenu.style.display = "none";
  }
});
// ===================== REACTIONS MENU CLOSE HANDLERS =====================
document.addEventListener("click", (e) => {
  document.querySelectorAll(".reaction-menu").forEach(menu => {
    if (!menu.parentElement.contains(e.target)) {
      menu.style.display = "none";
    }
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".reaction-menu").forEach(menu => {
      menu.style.display = "none";
    });
  }
});
// ===================== ADMIN DELETE (Right-Click on Message) =====================
const msgMenu = document.getElementById("msgMenu");
const deleteMsgBtn = document.getElementById("deleteMsgBtn");
let targetMessage = null;

// Δεξί κλικ πάνω σε μήνυμα
document.addEventListener("contextmenu", (e) => {
  const msg = e.target.closest(".message");
  if (msg) {
    e.preventDefault();

    // Επιτρέπεται μόνο αν είναι admin
    if (currentUserRole === "admin") {
      targetMessage = msg;

      // Τοποθέτηση του menu στο click point
      msgMenu.style.top = `${e.pageY}px`;
      msgMenu.style.left = `${e.pageX}px`;
      msgMenu.style.display = "block";
    }
  }
});

// Κλικ εκτός -> κλείσιμο menu
document.addEventListener("click", () => {
  msgMenu.style.display = "none";
});

// Πάτημα Delete στο menu
deleteMsgBtn.addEventListener("click", () => {
  if (!targetMessage) return;

  const msgId = targetMessage.dataset.id; // Το ID από το message div

  if (msgId) {
    // 🔥 Σβήσε από Firebase
    remove(ref(db, `messages/${currentRoom}/${msgId}`));

  }

  msgMenu.style.display = "none";
  targetMessage = null;
});

// === // ===================== AVATAR SAVE =====================
const avatarInput = document.getElementById("avatarUrl");
const saveAvatarBtn = document.getElementById("saveAvatarBtn");

if (saveAvatarBtn) {
  saveAvatarBtn.addEventListener("click", async () => {
    const url = avatarInput.value.trim();
    if (!url) return;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      showToast("Δεν είσαι συνδεδεμένος!");
      return;
    }

    try {
      // 1. Αποθήκευση σε users + status
      const updates = {};
      updates["users/" + uid + "/photoURL"] = url;
      updates["status/" + uid + "/photoURL"] = url;

      await update(ref(db), updates);

      // 2. Ενημέρωση στο Firebase Auth
      await updateProfile(auth.currentUser, { photoURL: url });

      // 3. Καθαρισμός input + επιβεβαίωση
      avatarInput.value = "";
      showToast("✅ Avatar ενημερώθηκε!");
      console.log("✅ Avatar updated everywhere:", url);

    } catch (err) {
      console.error("❌ Error updating avatar:", err);
      showToast("Σφάλμα: " + err.message, true);
    }
  });
}

// ===================== CLEANUP STRAY DOT (deep scan) =====================
function removeStrayDotsDeep(el = document) {
  el.querySelectorAll(".users").forEach(usersEl => {
    usersEl.querySelectorAll("*").forEach(child => {
      child.childNodes.forEach(n => {
        if (n.nodeType === 3 && n.nodeValue.trim() === ".") {
          console.log("🧹 Removed stray dot:", n, "inside", child);
          n.remove();
        }
      });
    });
  });
}

// Τρέχει μόλις φορτώσει η σελίδα
document.addEventListener("DOMContentLoaded", () => removeStrayDotsDeep());

// Ξανατρέχει σε κάθε αλλαγή στο panel
const usersPanel = document.querySelector(".users");
if (usersPanel) {
  const observer = new MutationObserver(() => removeStrayDotsDeep(usersPanel));
  observer.observe(usersPanel, { childList: true, subtree: true });
}


// ===================== MOBILE TOGGLE PANELS =====================
const toggleRoomsBtn = document.getElementById("toggleRooms");
const toggleUsersBtn = document.getElementById("toggleUsers");
const roomsPanel = document.querySelector(".rooms");
// ❌ δεν ξαναδηλώνουμε usersPanel γιατί υπάρχει ήδη

if (toggleRoomsBtn && roomsPanel) {
  toggleRoomsBtn.addEventListener("click", () => {
    roomsPanel.classList.toggle("active");
    usersPanel?.classList.remove("active"); // κλείσε users αν είναι ανοιχτό
  });
}

if (toggleUsersBtn && usersPanel) {
  toggleUsersBtn.addEventListener("click", () => {
    usersPanel.classList.toggle("show");

    roomsPanel?.classList.remove("active"); // κλείσε rooms αν είναι ανοιχτό
  });
}

// Κλείσιμο με click έξω
document.addEventListener("click", (e) => {
  if (roomsPanel && roomsPanel.classList.contains("active") && 
      !roomsPanel.contains(e.target) && e.target !== toggleRoomsBtn) {
    roomsPanel.classList.remove("active");
  }
  if (usersPanel && usersPanel.classList.contains("active") && 
      !usersPanel.contains(e.target) && e.target !== toggleUsersBtn) {
    usersPanel.classList.remove("active");
  }
});

// Κλείσιμο με ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    roomsPanel?.classList.remove("active");
    usersPanel?.classList.remove("active");
  }
});
// ===================== MOBILE TOGGLE EVENTS =====================
toggleRoomsBtn?.addEventListener("click", () => {
  sidebar.classList.toggle("show");
  usersPanel.classList.remove("show"); // κλείνει το Users αν ήταν ανοιχτό
});

toggleUsersBtn?.addEventListener("click", () => {
  usersPanel.classList.toggle("show");
  sidebar.classList.remove("show"); // κλείνει το Rooms αν ήταν ανοιχτό
});

// ===================== GAME: TIC TAC TOE (Firebase Sync) =====================
window.addEventListener("DOMContentLoaded", () => {
  const gameBtn = document.getElementById("gameBtn");
  const gameModal = document.getElementById("gameModal");
  const closeGame = document.getElementById("closeGame");
  const restartGame = document.getElementById("restartGame");
  const board = document.getElementById("ticTacToeBoard");
  const gameStatus = document.getElementById("gameStatus");

  const gameRef = ref(db, "game/tictactoe"); // 🔥 ίδιο σημείο για όλους τους παίκτες

  let currentPlayer = "X";
  let gameActive = true;
  let gameState = ["", "", "", "", "", "", "", "", ""];

  // === Board Setup ===
  function initBoard() {
    board.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      cell.dataset.index = i;
      cell.addEventListener("click", () => handleCellClick(i));
      board.appendChild(cell);
    }
  }

  // === Handle Click ===
  function handleCellClick(index) {
    if (gameState[index] !== "" || !gameActive) return;

    gameState[index] = currentPlayer;

    // save στο Firebase
    set(gameRef, {
      state: gameState,
      player: currentPlayer,
      active: true,
    });
  }

  // === Check Win ===
  function checkWin(state) {
    const winPatterns = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    return winPatterns.find(pattern => {
      const [a,b,c] = pattern;
      return state[a] && state[a] === state[b] && state[a] === state[c];
    });
  }

  function highlightWin(pattern) {
    if (!pattern) return;
    pattern.forEach(i => {
      if (board.children[i]) { // ✅ έλεγχος ασφαλείας
        board.children[i].classList.add("win");
      }
    });
  }

  // === Sync από Firebase ===
  onValue(gameRef, (snap) => {
    const data = snap.val();
    if (!data) return;

    gameState = data.state || ["", "", "", "", "", "", "", "", ""];
    currentPlayer = data.player === "X" ? "O" : "X"; // αλλάζει παίκτης
    gameActive = data.active;

    // ✅ Αν δεν έχει φτιαχτεί board → ξαναφτιάξτο
    if (board.children.length === 0) {
      initBoard();
    }

    // redraw board
    [...board.children].forEach((cell, i) => {
      cell.textContent = gameState[i];
      cell.className = "";
      if (gameState[i]) cell.classList.add(gameState[i]);
    });

    const win = checkWin(gameState);
    if (win) {
      gameStatus.textContent = `🎉 Ο παίκτης ${data.player} κέρδισε!`;
      highlightWin(win);
      gameActive = false;
    } else if (!gameState.includes("")) {
      gameStatus.textContent = "🤝 Ισοπαλία!";
      gameActive = false;
    } else {
      gameStatus.textContent = `Σειρά του παίκτη ${currentPlayer}`;
    }
  });

  // === Events ===
  gameBtn?.addEventListener("click", () => {
    gameModal.classList.remove("hidden");
    initBoard();
    // reset παιχνίδι
    set(gameRef, {
      state: ["", "", "", "", "", "", "", "", ""],
      player: "X",
      active: true,
    });
  });

  closeGame?.addEventListener("click", () => {
    gameModal.classList.add("hidden");
  });

  restartGame?.addEventListener("click", () => {
    initBoard();
    set(gameRef, {
      state: ["", "", "", "", "", "", "", "", ""],
      player: "X",
      active: true,
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      gameModal.classList.add("hidden");
    }
  });
});
// ===================== PROFILE MENU TOGGLE =====================
const profileWrapper = document.querySelector(".profile-wrapper");
const profileMenu = document.getElementById("profileMenu");

profileWrapper?.addEventListener("click", () => {
  profileMenu.style.display = profileMenu.style.display === "flex" ? "none" : "flex";
});

// Κλείσιμο αν κάνεις click έξω
document.addEventListener("click", (e) => {
  if (!profileWrapper.contains(e.target)) {
    profileMenu.style.display = "none";
  }
});
// ===================== PROFILE MENU: STATUS =====================
document.querySelectorAll(".status-options button").forEach(btn => {
  btn.addEventListener("click", () => {
    const status = btn.dataset.status;
    updateStatus(status);   // 🔹 η helper function που έχεις
    showToast(`✅ Status set to: ${status}`);
    profileMenu.style.display = "none";
  });
});

// ===================== STATUS HANDLING =====================
const statusButtons = document.querySelectorAll(".status-options button");

statusButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const newStatus = btn.dataset.status;
    const user = auth.currentUser;
    if (!user) return;

    // Update στο Firebase
    update(ref(db, "users/" + user.uid), {
      status: newStatus
    });

    console.log("✅ Status updated:", newStatus);
    profileMenu.style.display = "none"; // κλείνει το menu μετά την επιλογή
  });
});

// ===================== PROFILE MODAL (only new logic) =====================
const profileModal = document.getElementById("profileModal");
const deleteConfirmModal = document.getElementById("deleteConfirmModal");
const closeProfileModal = document.getElementById("closeProfileModal");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const deleteProfileBtn = document.getElementById("deleteProfileBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

// ====== Open Profile Modal (κουμπί "Edit My Profile") ======
document.querySelectorAll(".profile-menu button").forEach(btn => {
  if (btn.textContent.trim() === "Edit My Profile") {
    btn.addEventListener("click", () => {
      profileModal.showModal();
      document.querySelector(".profile-menu").style.display = "none"; // κλείσε dropdown
    });
  }
});

// ====== Close Profile Modal ======
if (closeProfileModal) {
  closeProfileModal.addEventListener("click", () => {
    profileModal.close();
  });
}

// ====== Tabs switching ======
document.querySelectorAll("#profileModal .tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#profileModal .tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll("#profileModal .tab-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

// ====== Save Profile ======
if (saveProfileBtn) {
  saveProfileBtn.addEventListener("click", () => {
    const nameInput = document.getElementById("profileName");
    const avatarInput = document.getElementById("profileAvatarInput");

    const newName = nameInput ? nameInput.value.trim() : "";
    const newAvatar = avatarInput ? avatarInput.value.trim() : "";

    if (auth.currentUser) {
      updateProfile(auth.currentUser, {
        displayName: newName || auth.currentUser.displayName,
        photoURL: newAvatar || auth.currentUser.photoURL
      }).then(() => {
        showToast("✅ Profile updated!");
        profileModal.close();
      }).catch(err => {
        console.error("Error updating profile", err);
      });
    }
  });
}

// ====== Delete Profile / Αποχώρηση ======
if (deleteProfileBtn) {
  deleteProfileBtn.addEventListener("click", async () => {
    if (!confirm("⚠️ Είσαι σίγουρος ότι θέλεις να διαγράψεις το προφίλ σου; Αυτή η ενέργεια είναι μη αναστρέψιμη.")) {
      return;
    }
    if (auth.currentUser) {
      try {
        // Διαγραφή από DB
        await remove(ref(db, "users/" + auth.currentUser.uid));

        // Διαγραφή από Auth
        await deleteUser(auth.currentUser);

        showToast("✅ Το προφίλ διαγράφηκε");
        profileModal.close();
      } catch (err) {
        console.error("Error deleting profile", err);
        showToast("❌ " + err.message);
      }
    }
  });
}

// ====== Friends Tab Rendering ======
function renderFriends() {
  if (!auth.currentUser) return;
  const friendsList = document.getElementById("friendsList");
  if (!friendsList) return;

  onValue(ref(db, "users/" + auth.currentUser.uid + "/friends"), (snap) => {
    friendsList.innerHTML = "";

    if (!snap.exists()) {
      friendsList.innerHTML = `<li class="muted">No friends yet</li>`;
      return;
    }

    snap.forEach(child => {
      const friendUid = child.key;
      const friendData = child.val();

      const li = document.createElement("li");
      li.innerHTML = `
        <span>${friendData?.name || "(Unknown User)"}</span>
        <button class="btn tiny danger" data-id="${friendUid}">❌</button>
      `;

      // Remove Friend action
      li.querySelector("button").addEventListener("click", () => {
        if (auth.currentUser) {
          remove(ref(db, `users/${auth.currentUser.uid}/friends/${friendUid}`));
        }
      });

      friendsList.appendChild(li);
    });
  });
}

// 🟢 Κάλεσέ το όταν ανοίγει το modal
profileModal?.addEventListener("show", () => {
  renderFriends();
});
