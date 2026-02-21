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

      <div id="unreadWrapper" style="margin-bottom:16px">
        <div id="unreadSection">Loading messages...</div>
        <div id="unreadList"></div>
      </div>

      <div id="bookingSection">Loading booking...</div>
    </div>
  `;

  try{

    // ===== USER DATA =====
    const userSnap = await getDoc(doc(db,"users",user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    const balance = userData.walletBalance || 0;

    document.getElementById("walletSection").innerHTML =
      `Saldo: Rp ${balance.toLocaleString("id-ID")}`;

    // ===== CHAT ROOMS =====
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

    // SORT latest first
    unreadRooms.sort((a,b)=>{
      return (b.lastMessageTime?.seconds || 0) -
             (a.lastMessageTime?.seconds || 0);
    });

    const unreadSection = document.getElementById("unreadSection");
    const unreadList = document.getElementById("unreadList");

    unreadSection.innerHTML =
      `Pesan belum dibaca: ${totalUnread}`;

    unreadList.innerHTML = "";

    if(unreadRooms.length > 0){

  for (const room of unreadRooms.slice(0,3)) {

    const otherUserId = room.participants.find(p => p !== user.uid);

    let otherUserName = "Unknown";

    if (otherUserId) {
      const otherSnap = await getDoc(doc(db,"users",otherUserId));
      if (otherSnap.exists()) {
        otherUserName = otherSnap.data().name || "User";
      }
    }

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
      window.navigate("chat"); // pastikan route ini memang ada
    };

    
    unreadList.appendChild(item);
  }

}

    // ===== BOOKING =====
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

/* =========================================
   STUBS - WINDOW SECTION B
========================================= */

// 🔥 FUNGSI FOLLOW
window.toggleFollow = async function(targetUid){

  const user = auth.currentUser;
  if(!user) return;

  const button = document.querySelector(
    `button[onclick="toggleFollow('${targetUid}')"]`
  );

  const isCurrentlyFollowing = button.classList.contains("following");

  // 🔥 Optimistic UI update
  if(isCurrentlyFollowing){
    button.classList.remove("following");
    button.innerText = "Follow";
  }else{
    button.classList.add("following");
    button.innerText = "Following";
  }

  try{

    const myUid = user.uid;

    const myFollowingRef = doc(db,"users",myUid,"following",targetUid);
    const targetFollowerRef = doc(db,"users",targetUid,"followers",myUid);

    const myUserRef = doc(db,"users",myUid);
    const targetUserRef = doc(db,"users",targetUid);

    await runTransaction(db, async (transaction)=>{

      const followSnap = await transaction.get(myFollowingRef);

      if(followSnap.exists()){

        transaction.delete(myFollowingRef);
        transaction.delete(targetFollowerRef);

        transaction.update(myUserRef,{
          followingCount: increment(-1)
        });

        transaction.update(targetUserRef,{
          followersCount: increment(-1)
        });

      }else{

        transaction.set(myFollowingRef,{ createdAt: serverTimestamp() });
        transaction.set(targetFollowerRef,{ createdAt: serverTimestamp() });

        transaction.update(myUserRef,{
          followingCount: increment(1)
        });

        transaction.update(targetUserRef,{
          followersCount: increment(1)
        });
      }

    });

  }catch(err){
    console.error(err);
  }
}
