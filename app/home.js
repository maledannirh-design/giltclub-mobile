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

      <div id="walletSection">Loading wallet...</div>

      <div id="unreadWrapper" style="margin-top:20px; display:none;">
        <div id="unreadList"></div>
      </div>

      <div id="bookingSection" style="margin-top:20px">
        Loading booking...
      </div>

    </div>
  `;

  try{

    /* USER DATA */
    const userSnap = await getDoc(doc(db,"users",user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    const balance = userData.walletBalance || 0;

    document.getElementById("walletSection").innerHTML =
      `Saldo: Rp ${balance.toLocaleString("id-ID")}`;


    /* CHAT ROOMS */
    const roomsSnap = await getDocs(
      query(
        collection(db,"chatRooms"),
        where("participants","array-contains", user.uid)
      )
    );

    let unreadRooms = [];

    roomsSnap.forEach(docSnap=>{
      const data = docSnap.data();
      const unread = data.unreadCount?.[user.uid] || 0;

      if(unread > 0){
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

    if(unreadRooms.length > 0){

      const unreadWrapper = document.getElementById("unreadWrapper");
      const unreadList = document.getElementById("unreadList");

      unreadWrapper.style.display = "block";
      unreadList.innerHTML = "";

      for(const room of unreadRooms.slice(0,5)){

        const otherUid = room.participants.find(p=>p !== user.uid);
        const otherUser = room.userMap?.[otherUid] || {};
        const username = otherUser.username || "User";

        const item = document.createElement("div");
        item.className = "unread-item-mini";
        item.textContent = `${username}: ${room.lastMessage || ""}`;

        item.onclick = ()=>{
          renderChatUI(room.id, otherUid);
        };

        unreadList.appendChild(item);
      }
    }


    /* BOOKINGS */
    const bookingSnap = await getDocs(
      query(
        collection(db,"bookings"),
        where("userId","==", user.uid)
      )
    );

    document.getElementById("bookingSection").innerHTML =
      `Total booking: ${bookingSnap.size}`;

  }catch(error){
    console.error(error);
  }
}
