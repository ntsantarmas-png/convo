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

const firebaseConfig = {
  apiKey:"AIzaSyDii_FqpCDTRvvxjJGTyJPIdZmxfwQcO3s",
  authDomain:"convo-ae17e.firebaseapp.com",
  databaseURL:"https://convo-ae17e-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:"convo-ae17e",
  storageBucket:"convo-ae17e.firebasestorage.app",
  messagingSenderId:"1074442682384",
  appId:"1:1074442682384:web:9faa6a60b1b6848a968a95"
};
const app = initializeApp(firebaseConfig); 
const auth = getAuth(app); 
const db = getDatabase(app);

// ===================== GLOBAL ELEMENT REFERENCES =====================
const $ = (id) => document.getElementById(id);
const authView = $('authView'), appView = $('appView'), logoutBtn=$('logoutBtn'), helloUser=$('helloUser');
const loginForm=$('loginForm'), registerForm=$('registerForm'), anonForm=$('anonForm'), forgotLink=$('forgotLink');
const roomsList=$('roomsList'), newRoomBtn=$('newRoomBtn'), roomDialog=$('roomDialog'), roomForm=$('roomForm'), roomNameInput=$('roomNameInput');
const roomTitle=$('roomTitle'), messagesEl=$('messages'), messageForm=$('messageForm'), messageInput=$('messageInput'), usersList=$('usersList');
const emojiToggle=$('emojiToggle'), emojiPanel=$('emojiPanel'), emojiGrid=$('emojiGrid'), emojiSearch=$('emojiSearch');
const tabs = document.querySelectorAll('.tab'); 
const panels = document.querySelectorAll('.tab-panel'); 
const toastEl=$('toast');

let currentRoom='general', messagesUnsub=null, presenceUnsub=null;
let currentUserRole = "user"; // default ρόλος

// Helpers
const showToast=(msg)=>{
  toastEl.textContent=msg;
  toastEl.classList.add('show');
  setTimeout(()=>toastEl.classList.remove('show'),2500);
};
const switchTab=(name)=>{
  tabs.forEach(t=>t.classList.toggle('active',t.dataset.tab===name)); 
  panels.forEach(p=>p.classList.toggle('active',p.id===`tab-${name}`));
};
tabs.forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));

// ===================== AUTH (Register / Login / Anon / Forgot / Logout) =====================
registerForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const username=$('regUsername').value.trim(); 
  const email=$('regEmail').value.trim(); 
  const pass=$('regPassword').value;
  try{ 
    const {user}=await createUserWithEmailAndPassword(auth,email,pass); 
    await updateProfile(user,{displayName:username});
    await update(ref(db,`users/${user.uid}`),{displayName:username,email,createdAt:Date.now()}); 
    showToast('Account created. You are in!');
  }catch(err){ 
    console.error('register error',err); 
    showToast(err.message); 
  }
});

loginForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email=$('loginEmail').value.trim(); 
  const pass=$('loginPassword').value;
  try{ 
    await signInWithEmailAndPassword(auth,email,pass); 
    showToast('Welcome back!'); 
  }
  catch(err){ 
    console.error('login error',err); 
    showToast(err.message); 
  }
});

anonForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name=$('anonUsername').value.trim()||'Anon';
  try{ 
    const cred=await signInAnonymously(auth); 
    await updateProfile(cred.user,{displayName:name});
    await update(ref(db,`users/${cred.user.uid}`),{displayName:name,email:null,createdAt:Date.now(),anonymous:true}); 
    showToast('Joined anonymously.');
  }catch(err){ 
    console.error('anon error',err); 
    showToast(err.message); 
  }
});

forgotLink?.addEventListener('click', async ()=>{
  const email=$('loginEmail').value.trim(); 
  if(!email){showToast('Enter your email first.');return;}
  try{ 
    await sendPasswordResetEmail(auth,email); 
    showToast('Reset email sent.'); 
  }catch(err){ 
    console.error('reset error',err); 
    showToast(err.message); 
  }
});

logoutBtn?.addEventListener('click',()=>signOut(auth));
// ===================== RENDER ROOMS =====================
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
    div.dataset.id = r;   // ✅ το σωστό key

    // όνομα room
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `#${r}`;

    // counter badge
    const countSpan = document.createElement('span');
    countSpan.className = 'room-count';
    countSpan.textContent = "0"; // default

    div.appendChild(nameSpan);
    div.appendChild(countSpan);

    // click -> αλλαγή δωματίου
    div.addEventListener('click', () => switchRoom(r));

    // δεξί κλικ -> context menu
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      clickedRoom = div;
      console.log("🖱️ Right click σε roomId:", div.dataset.id); // ✅ εδώ βλέπεις το σωστό
      roomMenu.style.top = e.pageY + "px";
      roomMenu.style.left = e.pageX + "px";
      roomMenu.style.display = "block";
    });

    roomsList.appendChild(div);
  });

  updateRoomCounts(); // counters
};


  // Φρεσκάρουμε counters (αν το χρειαστείς αργότερα)
  updateRoomCounts();
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

newRoomBtn?.addEventListener('click',()=>{
  roomDialog.showModal(); 
  roomNameInput.value=''; 
  setTimeout(()=>roomNameInput.focus(),50); 
});

roomForm?.addEventListener('submit',async(e)=>{
  e.preventDefault();
  const name=roomNameInput.value.trim().toLowerCase()
    .replace(new RegExp('\\s+','g'),'-')
    .replace(new RegExp('[^a-z0-9_-]','g'),'');
  if(!name) return roomDialog.close(); 
  await set(ref(db,`rooms/${name}`),{createdAt:Date.now(),name}); 
  roomDialog.close(); 
  await renderRooms(); 
  switchRoom(name);
});
// ===================== MESSAGES (Send / Append / Reactions) =====================
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

// ===================== AUTO-GROW TEXTAREA =====================
messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = messageInput.scrollHeight + "px";
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); 
    messageForm.requestSubmit(); // αποστολή με Enter
  }
});

// ===================== MESSAGE APPEND (UI Build) =====================
const makeInitials = (name = '?') => (name.trim()[0] || '?').toUpperCase();

const appendMessage = (m, myUid) => {
  const row = document.createElement('div'); 
  row.classList.add('message', 'msg-row');  
  if (m.uid === myUid) row.classList.add('mine');
  row.dataset.id = m.id;   // Firebase key

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

  // === Meta (όνομα + ώρα) ===
  const meta = document.createElement('div'); 
  meta.className = 'meta'; 
  const time = new Date(m.ts || Date.now()).toLocaleTimeString();
  const nameHtml = m.name === 'MysteryMan'
    ? `<strong style="color:#ffb703">${escapeHtml(m.name)}</strong> <span class="badge admin">ADMIN</span>`
    : `<strong>${escapeHtml(m.name)}</strong>`;
  meta.innerHTML = `${nameHtml} <span style="opacity:.6">(${time})</span>`;

  // === Text, YouTube ή GIF ===
  const text = document.createElement('div'); 
  text.className = 'text'; 
  (function() {
    if (m.text && (m.text.includes("youtube.com") || m.text.includes("youtu.be"))) {
      const videoId = extractVideoId(m.text);
      if (videoId) {
        text.innerHTML = `
          <div class="yt-preview">
            <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="YouTube Thumbnail">
            <span>▶ YouTube Video</span>
          </div>
        `;
        text.querySelector('.yt-preview').addEventListener('click', () => playYouTube(m.text));
        return;
      }
    }
    const isGif = m.isGif || /\.(gif)(\?|$)/i.test(m.text) || /giphy\.com\/media\//i.test(m.text); 
    if (isGif) {
      const img = document.createElement('img'); 
      img.src = m.text; 
      img.alt = 'gif'; 
      img.className = 'msg-gif'; 
      text.appendChild(img);
    } else { 
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
// ===================== REACTIONS RENDER =====================
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

// ===================== REACTIONS TOGGLE =====================
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

// ===================== ROOM COUNTS =====================
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
// Users online
const watchPresence = () => {
  if (presenceUnsub) presenceUnsub();
  presenceUnsub = onValue(ref(db, 'status'), (snap) => {
    const data = snap.val() || {};

    // Καθαρίζουμε όλες τις λίστες
    document.getElementById("adminsList").innerHTML = "";
    document.getElementById("modsList").innerHTML = "";
    document.getElementById("vipList").innerHTML = "";
    document.getElementById("normalList").innerHTML = "";

    Object.entries(data).forEach(([uid, s]) => {
      const li = document.createElement('li');

      // === Avatar ===
      const avatar = document.createElement('div');
      avatar.className = 'avatar ' + (s.state === 'online' ? 'online' : 'offline');

      if (s.photoURL) {
        // Αν έχει photoURL → εμφάνιση εικόνας
        const img = document.createElement('img');
        img.src = s.photoURL;
        img.alt = s.displayName || 'U';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        avatar.appendChild(img);
      } else {
        // Αν δεν έχει photoURL → πρώτο γράμμα ονόματος
        avatar.textContent = (s.displayName || 'U')[0].toUpperCase();
      }

      // === Status dot (online/offline) ===
      const dot = document.createElement('span');
      dot.className = 'status-dot ' + (s.state === 'online' ? 'online' : 'offline');

      // === Username ===
      const name = document.createElement('span');
      name.textContent = s.displayName || 'User';

      // === Badge ===
      let badge = null;

      // --- Admin: ΜΟΝΟ MysteryMan ---
      if ((s.displayName || '') === 'MysteryMan') {
        badge = document.createElement('span');
        badge.className = 'badge admin';
        badge.textContent = '🛡️ ADMIN';
        name.innerHTML = `<strong style="color:#ffb703">${s.displayName}</strong>`;
        li.classList.add("admin");
        document.getElementById("adminsList").appendChild(li);

      // --- Moderator ---
      } else if (s.role === "mod") {
        badge = document.createElement('span');
        badge.className = 'badge mod';
        badge.textContent = '🛠️ MOD';
        name.innerHTML = `<span style="color:#06d6a0">${s.displayName}</span>`;
        li.classList.add("mod");
        document.getElementById("modsList").appendChild(li);

      // --- VIP ---
      } else if (s.role === "vip") {
        badge = document.createElement('span');
        badge.className = 'badge vip';
        badge.textContent = '💎 VIP';
        name.innerHTML = `<span style="color:#7209b7">${s.displayName}</span>`;
        li.classList.add("vip");
        document.getElementById("vipList").appendChild(li);

      // --- Απλοί χρήστες ---
      } else {
        badge = document.createElement('span');
        badge.className = 'badge user';
        badge.textContent = '👤 USER';
        li.classList.add("user");
        document.getElementById("normalList").appendChild(li);
      }

      // === Append row ===
      li.appendChild(avatar);
      li.appendChild(dot);
      li.appendChild(name);
      if (badge) li.appendChild(badge);
    });
  });
};
// ===================== AUTH STATE HANDLING =====================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Αν δεν υπάρχει avatar, δώσε ένα τυχαίο
    if (!user.photoURL) {
      try {
        await updateProfile(user, {
          photoURL: "https://i.pravatar.cc/150?img=3"
        });
        console.log("✅ Avatar set for user:", user.displayName, user.photoURL);
      } catch (err) {
        console.error("updateProfile error", err);
      }
    }

    // Εμφάνιση της εφαρμογής μετά το login
    authView.classList.add('hidden');
    appView.classList.remove('hidden');
    helloUser.textContent = `Hello, ${user.displayName || 'User'}!`;

    // === CLEAR CHAT BUTTON ===
    const clearChatBtn = document.getElementById("clearChatBtn");
    if (user.displayName === "MysteryMan") {
      currentUserRole = "admin";   // 👈 Ορίζουμε ρόλο admin
      clearChatBtn.style.display = "inline-block"; // δείξε το κουμπί μόνο στον admin

      clearChatBtn.addEventListener("click", async () => {
        if (!confirm("⚠️ Να διαγραφούν όλα τα μηνύματα από αυτό το room;")) return;
        try {
          const room = document.getElementById("roomTitle").textContent.replace("#", "");
          await remove(ref(db, "messages/" + room));

          // 🆕 καθάρισε και το UI αμέσως
          document.getElementById("messages").innerHTML = "";

          console.log("🗑 Chat cleared for room:", room);
        } catch (err) {
          console.error("clearChat error:", err);
        }
      });
    } else {
      currentUserRole = "user";    // 👈 Ορίζουμε default ρόλο user
      clearChatBtn.style.display = "none"; // κρύψε το κουμπί για μη-admin
    }

    // Header avatar από το database
    const headerAvatar = document.getElementById("headerAvatar");
    onValue(ref(db, "users/" + user.uid), (snap) => {
      const u = snap.val() || {};
      if (headerAvatar) {
        headerAvatar.innerHTML = u.photoURL
          ? `<img src="${u.photoURL}" alt="avatar">`
          : `<span>${(u.displayName || "U")[0].toUpperCase()}</span>`;
      }
    });

    // Presence + rooms
    await setupPresence(user);
    await renderRooms();
    switchRoom(currentRoom);
    watchPresence();

  } else {
    // Αν δεν υπάρχει user → δείξε την οθόνη login
    appView.classList.add('hidden');
    authView.classList.remove('hidden');
    helloUser.textContent = '';
    if (messagesUnsub) messagesUnsub();
    if (presenceUnsub) presenceUnsub();
  }
});

// ===================== UTILS =====================
function escapeHtml(str=''){ 
  return str.replaceAll('&','&amp;')
            .replaceAll('<','&lt;')
            .replaceAll('>','&gt;'); 
}
function linkify(text=''){ 
  const urlRegex=new RegExp('https?:\\/\\/[^\\s]+','g'); 
  return text.replace(urlRegex,'<a href=\"$&\" target=\"_blank\" rel=\"noopener noreferrer\">$&</a>'); 
}
// ===================== EMOJI / GIF / STICKERS PICKER =====================
// Emoji Picker
const EMOJIS=[["😀","grinning happy smile"],["😃","smile open"],["😄","smile grin"],["😁","grin"],["😆","laugh"],["😅","sweat laugh"],["🤣","rofl rolling floor laughing"],["😂","joy tears"],["🙂","slight smile"],["🙃","upside down"],["😉","wink"],["😊","blush"],["😇","innocent angel"],["🥰","in love hearts"],["😍","heart eyes"],["🤩","star struck"],["😘","kiss"],["😗","kiss"],["😙","kiss"],["😚","kiss"],["😋","yum"],["😛","tongue"],["😜","winking tongue"],["🤪","zany"],["😝","squint tongue"],["🤑","money"],["🤗","hug"],["🤭","oops"],["🤫","shush"],["🤔","thinking"],["🤐","zipper mouth"],["😐","neutral"],["😑","expressionless"],["😶","no mouth"],["😏","smirk"],["😒","unamused"],["🙄","eyeroll"],["😬","grimace"],["🤥","lying"],["😌","relieved"],["😔","pensive"],["😪","sleepy"],["🤤","drool"],["😴","sleeping"],["😷","mask"],["🤒","thermometer"],["🤕","head bandage"],["🤧","sneeze"],["🥵","hot"],["🥶","cold"],["🥴","woozy"],["😵","dizzy"],["🤯","mind blown"],["🤠","cowboy"],["🥳","party"],["😎","cool sunglasses"],["🤓","nerd"],["🫡","salute"],["👍","thumbs up like"],["👎","thumbs down"],["👏","clap"],["🙏","pray thanks"],["👌","ok"],["✌️","victory peace"],["🤝","handshake"],["💪","muscle"],["👀","eyes look"],["👋","wave"],["🔥","fire lit"],["✨","sparkles"],["❤️","heart love"],["🧡","heart orange"],["💛","heart yellow"],["💚","heart green"],["💙","heart blue"],["💜","heart purple"],["💯","100"],["💩","poop"],["🎉","tada party"],["🎂","cake birthday"],["🍕","pizza"],["🍔","burger"],["☕","coffee"]];

function renderEmojiGrid(filter=""){ 
  const frag=document.createDocumentFragment(); 
  const normalized=filter.trim().toLowerCase(); 
  const list=EMOJIS.filter(([e,k])=>!normalized||k.includes(normalized)); 
  list.forEach(([emoji])=>{ 
    const div=document.createElement('div'); 
    div.className='emoji-item'; 
    div.textContent=emoji; 
    div.title=emoji; 
    div.addEventListener('click',()=>{ 
      messageInput.value+=emoji; 
      messageInput.focus(); 
    }); 
    frag.appendChild(div); 
  }); 
  emojiGrid.innerHTML=''; 
  emojiGrid.appendChild(frag); 
}

// ===================== EMOJI TRAIL =====================
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

// ===================== EMOJI PANEL TOGGLE =====================
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
document.addEventListener('click',(e)=>{ 
  if(!emojiPanel.contains(e.target) && e.target!==emojiToggle){ 
    emojiPanel.classList.remove('show'); 
  } 
});
// Κλείσιμο με Esc
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && emojiPanel.classList.contains('show')) {
    emojiPanel.classList.remove('show');
    emojiPanel.setAttribute('aria-hidden', 'true');
  }
});  
// ===================== GIF TABS =====================
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

// ===================== GIF LOADING =====================
async function loadTrendingGifs(){
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

// ===================== GIF RENDER =====================
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

// ===================== GIF SEARCH BUTTON =====================
const gifSearchBtn = $('gifSearchBtn');
if (gifSearchBtn) {
  gifSearchBtn.addEventListener('click', () => {
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

// ===================== UNIFIED SEARCH (Emoji + GIF + Stickers) =====================
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

// ===================== STICKERS =====================
const stickerTabBtn=$('stickerTabBtn');
const stickerBody=$('stickerBody');
const stickerGrid=$('stickerGrid');

async function loadTrendingStickers(){
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

// ===================== STICKERS RENDER =====================
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

// ===================== USER MENU HANDLERS =====================
document.getElementById("ctxAddFriend").addEventListener("click", () => {
  if (!contextTargetUser) return;
  const username = contextTargetUser.querySelector("span")?.textContent;
  alert(`Add Friend: ${username}`);
});

document.getElementById("ctxRemoveFriend").addEventListener("click", () => {
  if (!contextTargetUser) return;
  const username = contextTargetUser.querySelector("span")?.textContent;
  alert(`Remove Friend: ${username}`);
});

document.getElementById("ctxBlock").addEventListener("click", () => {
  if (!contextTargetUser) return;
  const username = contextTargetUser.querySelector("span")?.textContent;
  alert(`Block: ${username}`);
});

document.getElementById("ctxUnblock").addEventListener("click", () => {
  if (!contextTargetUser) return;
  const username = contextTargetUser.querySelector("span")?.textContent;
  alert(`Unblock: ${username}`);
});

// ===================== ROOM CONTEXT MENU =====================
const roomMenu      = document.getElementById("roomContextMenu");
const joinRoomBtn   = document.getElementById("joinRoom");
const leaveRoomBtn  = document.getElementById("leaveRoom");
const renameRoomBtn = document.getElementById("renameRoom");
const deleteRoomBtn = document.getElementById("deleteRoom");

let clickedRoom = null;

// ===================== ROOM DELETE =====================
deleteRoomBtn.addEventListener("click", async () => {
  if (!clickedRoom) return;

  const roomId = clickedRoom.dataset.id;   // ✅ πάντα dataset.id
  const sure = confirm("Delete room: " + roomId + "?");
  console.log("🗑 Προσπάθεια διαγραφής:", roomId);

  if (sure) {
    try {
      // Σβήνουμε το δωμάτιο και τα μηνύματά του
      await remove(ref(db, `rooms/${roomId}`));
      await remove(ref(db, `messages/${roomId}`));

      showToast("🗑 Room deleted: " + roomId);

      // Κάνε refresh στη λίστα και γύρνα στο general
      await renderRooms();
      switchRoom("general");
    } catch (e) {
      console.error("❌ delete room error", e);
      showToast("Error deleting room");
    }
  }

  roomMenu.style.display = "none";
});

// ===================== ROOM RENAME =====================
renameRoomBtn.addEventListener("click", async () => {
  if (!clickedRoom) return;

  const oldName = clickedRoom.dataset.id;   // ✅ μόνο το data-id
  const newName = prompt("New name for room:", oldName);

  if (newName && newName !== oldName) {
    try {
      const oldRef = ref(db, `rooms/${oldName}`);
      const newRef = ref(db, `rooms/${newName}`);

      // Αντιγραφή δεδομένων room
      const snap = await get(oldRef);
      if (snap.exists()) {
        await set(newRef, { ...snap.val(), name: newName });
        await remove(oldRef);
      }

      // Αντιγραφή μηνυμάτων
      const oldMsgs = await get(ref(db, `messages/${oldName}`));
      if (oldMsgs.exists()) {
        await set(ref(db, `messages/${newName}`), oldMsgs.val());
        await remove(ref(db, `messages/${oldName}`));
      }

      showToast(`✏️ Room renamed: ${oldName} → ${newName}`);
      await renderRooms();
      switchRoom(newName);
    } catch (e) {
      console.error("❌ rename room error", e);
      showToast("Error renaming room");
    }
  }
  roomMenu.style.display = "none";
});

// ===================== ROOM JOIN =====================
joinRoomBtn.addEventListener("click", () => {
  if (!clickedRoom) return;
  showToast("JOIN room: " + clickedRoom.dataset.id);  // ✅ μόνο dataset.id
  roomMenu.style.display = "none";
});

// ===================== ROOM LEAVE =====================
leaveRoomBtn.addEventListener("click", () => {
  if (!clickedRoom) return;
  showToast("LEAVE room: " + clickedRoom.dataset.id); // ✅ μόνο dataset.id
  roomMenu.style.display = "none";
});

// ===================== SWITCH ROOM FIX =====================
const switchRoom = (room) => {
  currentRoom = room;
  roomTitle.textContent = `#${room}`;
  document.querySelectorAll('.room-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === room) // ✅ dataset.id
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
    if (el) el.remove();
  });
};


// --- ΚΛΕΙΣΙΜΟ MENU ---
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
// ===================== AVATAR SAVE =====================
const avatarInput = document.getElementById("avatarUrl");
const saveAvatarBtn = document.getElementById("saveAvatarBtn");

if (saveAvatarBtn) {
  saveAvatarBtn.addEventListener("click", () => {
    const url = avatarInput.value.trim();
    if (!url) return;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      showToast("Δεν είσαι συνδεδεμένος!");
      return;
    }

    // Αποθηκεύουμε και στους δύο κόμβους: users + status
    const updates = {};
    updates["users/" + uid + "/photoURL"] = url;
    updates["status/" + uid + "/photoURL"] = url;

    update(ref(db), updates).then(() => {
      showToast("✅ Avatar ενημερώθηκε!");
      avatarInput.value = "";
    }).catch(err => {
      console.error(err);
      showToast("Σφάλμα: " + err.message);
    });
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
