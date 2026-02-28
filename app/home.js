import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where
} from "./firestore.js";
import { resolveMemberCard, renderMemberCard } from "./utils.js";
import { eyeOpenSVG, eyeCloseSVG } from "./wallet.js";

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

          <div class="home-right-section">
            <div class="home-unread-icon">
              <div class="mail-icon">✉️</div>
              ${
                totalUnread > 0
                  ? `<div class="home-unread-badge">${totalUnread}</div>`
                  : ``
              }
            </div>
          </div>
        </div>

        <div id="homeUnreadScroll" class="home-unread-scroll"></div>

        <!-- WALLET CARD -->
        <div class="wallet-card-pink">

          <div class="wallet-card-header">
            <div class="wallet-title">G-WALLET</div>
            <div class="wallet-saldo-toggle">
              <span>G-Saldo</span>
              <span id="toggleSaldoBtn" class="eye-btn">
                ${eyeOpenSVG()}
              </span>
            </div>
          </div>

          <div class="wallet-main-content">

            <div class="wallet-left">
              <div id="walletAmount" class="wallet-amount">
                Rp ******
              </div>

              <button class="wallet-topup-btn">
                ➕ Top Up
              </button>
            </div>

            <div class="wallet-right" id="homeMemberCard"></div>

          </div>

        </div>

      </div>
    `;

    /* =============================
       INSERT MEMBER CARD
    ============================= */
    const homeCardContainer = document.getElementById("homeMemberCard");
    if(homeCardContainer){
      homeCardContainer.innerHTML = renderMemberCard(userData);
    }

    /* =============================
       RENDER UNREAD PREVIEW
    ============================= */
    const scroll = document.getElementById("homeUnreadScroll");

    if (scroll) {

      scroll.innerHTML = "";

      for (const room of unreadRooms.slice(0,5)) {

        const otherUid = room.participants.find(p => p !== user.uid);
        let username = "User";

        if (otherUid) {
          const otherSnap = await getDoc(doc(db,"users",otherUid));
          if (otherSnap.exists()) {
            username = otherSnap.data().username || "User";
          }
        }

        const item = document.createElement("div");
        item.className = "home-unread-item";

        item.innerHTML = `
          <div class="unread-name">${username}</div>
          <div class="unread-text">${room.lastMessage || ""}</div>
        `;

        item.onclick = ()=>{
          window.renderChatUI(room.id, otherUid);
        };

        scroll.appendChild(item);
      }
    }

    /* =============================
       TOGGLE SALDO
    ============================= */
    let saldoVisible = false;

    const toggleBtn = document.getElementById("toggleSaldoBtn");
    const walletAmountEl = document.getElementById("walletAmount");

    if(toggleBtn){
      toggleBtn.onclick = ()=>{
        saldoVisible = !saldoVisible;

        walletAmountEl.innerText =
          saldoVisible
            ? `Rp ${balance.toLocaleString("id-ID")}`
            : "Rp ******";

        toggleBtn.innerHTML =
          saldoVisible ? eyeCloseSVG() : eyeOpenSVG();
      };
    }

    /* =============================
       HOME TOP UP BUTTON
    ============================= */
    const homeTopupBtn = document.querySelector(".wallet-topup-btn");

    if(homeTopupBtn){
      homeTopupBtn.onclick = async ()=>{
        const module = await import("./wallet.js");
        module.renderTopUpSheet();
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

/* =========================================
   SVG ICON
========================================= */
function eyeOpenSVG(){
  return `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="18" height="18"
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         stroke-width="1.6"
         stroke-linecap="round"
         stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `;
}
