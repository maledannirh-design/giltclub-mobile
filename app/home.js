import { renderHome } from "./home.js";

/* =========================================
   HOME DASHBOARD
========================================= */
export async function renderHome(){

  const content = document.getElementById("content");
  const user = auth.currentUser;

  if(!content || !user) return;

  content.innerHTML = `
    <div style="padding:20px">
      <h2>Home</h2>

      <div id="walletSection" style="margin-bottom:16px">Loading wallet...</div>

      <div id="unreadWrapper" style="margin-bottom:16px; display:none;">
        <div id="unreadSection"></div>
        <div id="unreadList"></div>
      </div>

      <div id="bookingSection">Loading booking...</div>
    </div>
  `;

  try{

    /* ======================
       USER DATA
    ====================== */
    const userSnap = await getDoc(doc(db,"users",user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    const balance = userData.walletBalance || 0;

    document.getElementById("walletSection").innerHTML =
      `Saldo: Rp ${balance.toLocaleString("id-ID")}`;


    /* ======================
       CHAT ROOMS (OPTIMIZED)
    ====================== */
    const roomsSnap = await getDocs(
      query(
        collection(db,"chatRooms"),
        where("participants","array-contains", user.uid)
      )
    );

    let totalUnread = 0;
    let unreadRooms = [];

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

    // Sort by latest message
    unreadRooms.sort((a,b)=>{
      return (b.lastMessageTime?.seconds || 0) -
             (a.lastMessageTime?.seconds || 0);
    });

    const unreadWrapper = document.getElementById("unreadWrapper");
    const unreadSection = document.getElementById("unreadSection");
    const unreadList = document.getElementById("unreadList");

    if(totalUnread > 0){

      unreadWrapper.style.display = "block";

      unreadSection.innerHTML =
        `Pesan belum dibaca: ${totalUnread}`;

      unreadList.innerHTML = "";

      for (const room of unreadRooms.slice(0,3)) {

        const otherUserId = room.participants.find(p => p !== user.uid);
        const otherUserData = room.userMap?.[otherUserId] || {};

        const otherUserName = otherUserData.name || "User";

        const item = document.createElement("div");
        item.className = "unread-item";

        item.innerHTML = `
          <div class="unread-dot"></div>
          <div class="unread-content">
            <div class="unread-name">${otherUserName}</div>
            <div class="unread-preview">
              ${room.lastMessage || ""}
            </div>
          </div>
        `;

        item.onclick = ()=>{
          localStorage.setItem("activeChatRoom", room.id);
          window.navigate("chat");
        };

        unreadList.appendChild(item);
      }
    }


    /* ======================
       BOOKINGS
    ====================== */
    const bookingSnap = await getDocs(
      query(
        collection(db,"bookings"),
        where("userId","==", user.uid)
      )
    );

    document.getElementById("bookingSection").innerHTML =
      `Total booking: ${bookingSnap.size}`;

  }catch(error){

    console.error("Home error:", error);

    content.innerHTML = `
      <div style="padding:20px;color:red">
        Error loading dashboard.
      </div>
    `;
  }
}
