import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where
} from "./firestore.js";

/* =========================================
   HOME DASHBOARD
========================================= */
export async function renderHome(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!content || !user) return;

  try{

    /* =============================
       USER DATA
    ============================= */
    const userSnap = await getDoc(doc(db,"users",user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    const balance = userData.walletBalance || 0;

    /* =============================
       CHAT ROOMS (UNREAD)
    ============================= */
    const roomsSnap = await getDocs(
      query(
        collection(db,"chatRooms"),
        where("participants","array-contains", user.uid)
      )
    );

    let unreadRooms = [];
    let totalUnread = 0;

    roomsSnap.forEach(docSnap=>{
      const data = docSnap.data();
      const unread = data.unreadCount?.[user.uid] || 0;

      if(unread > 0){
        totalUnread += unread;
        unreadRooms.push({
          id: docSnap.id,
          ...data
        });
      }
    });

    unreadRooms.sort((a,b)=>{
      return (b.lastMessageAt?.seconds || 0) -
             (a.lastMessageAt?.seconds || 0);
    });

    /* =============================
       RENDER UI
    ============================= */
    content.innerHTML = `
      <div class="home-container">

        <!-- HEADER -->
        <div class="home-header">
          <div class="home-profile-left">
            <div class="home-avatar">
              ${
                userData.photoURL
                  ? `<img src="${userData.photoURL}" />`
                  : `<div class="avatar-placeholder">👤</div>`
              }
            </div>

            <div class="home-user-text">
              <div class="home-username">
                ${userData.username || "User"}
              </div>
              <div class="home-gpoint">
                ${userData.gPoint || 0} G-Point
              </div>
            </div>
          </div>

          <div class="home-unread-icon">
            <div class="mail-icon">✉️</div>
            ${
              totalUnread > 0
                ? `<div class="home-unread-badge">${totalUnread}</div>`
                : ``
            }
          </div>
        </div>

        <!-- UNREAD SCROLL -->
        <div id="homeUnreadScroll" class="home-unread-scroll"></div>

        <!-- WALLET CARD -->
        <div class="wallet-card-pink">

          <div class="wallet-card-header">
            <div class="wallet-title">G-WALLET</div>
            <div class="wallet-saldo-toggle">
              <span>G-Saldo</span>
              <span id="toggleSaldoBtn" class="eye-btn">👁</span>
            </div>
          </div>

          <div class="wallet-main-content">

            <div class="wallet-left">
              <div id="walletAmount" class="wallet-amount">
                Rp ${balance.toLocaleString("id-ID")}
              </div>

              <button class="wallet-topup-btn">
                ➕ Top Up
              </button>
            </div>

            <div class="wallet-right">
              <img 
                src="https://raw.githubusercontent.com/USERNAME/REPO/main/member-card.png" 
                class="member-card-img"
              />
            </div>

          </div>

        </div>

      </div>
    `;

    /* =============================
       RENDER UNREAD PREVIEW
    ============================= */
    const scroll = document.getElementById("homeUnreadScroll");

    unreadRooms.slice(0,5).forEach(room=>{
      const otherUid = room.participants.find(p=>p !== user.uid);
      const otherUser = room.userMap?.[otherUid] || {};
      const username = otherUser.username || "User";

      const item = document.createElement("div");
      item.className = "home-unread-item";
      item.textContent = `${username}: ${room.lastMessage || ""}`;

      item.onclick = ()=>{
        window.renderChatUI(room.id, otherUid);
      };

      scroll.appendChild(item);
    });

    /* =============================
       TOGGLE SALDO
    ============================= */
    let saldoVisible = true;

    const toggleBtn = document.getElementById("toggleSaldoBtn");
    const walletAmountEl = document.getElementById("walletAmount");

    if(toggleBtn){
      toggleBtn.onclick = ()=>{
        saldoVisible = !saldoVisible;

        walletAmountEl.innerText =
          saldoVisible
            ? `Rp ${balance.toLocaleString("id-ID")}`
            : "Rp ******";
      };
    }

  }catch(error){
    console.error("Home error:", error);
    content.innerHTML = `
      <div style="padding:20px;color:red;">
        Failed to load home.
      </div>
    `;
  }
}
