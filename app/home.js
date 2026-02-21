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

export async function createOrGetChatRoom(otherUserId){

  const user = auth.currentUser;
  if(!user) return null;

  // Cari room existing
  const q = query(
    collection(db,"chatRooms"),
    where("participants","array-contains", user.uid)
  );

  const snap = await getDocs(q);

  for(const docSnap of snap.docs){
    const data = docSnap.data();
    if(data.participants.includes(otherUserId)){
      return docSnap.id;
    }
  }

  // Kalau belum ada → buat baru
  const otherSnap = await getDoc(doc(db,"users",otherUserId));
  if(!otherSnap.exists()) return null;

  const otherData = otherSnap.data();

  const userSnap = await getDoc(doc(db,"users",user.uid));
  const userData = userSnap.data();

  const newRoom = await addDoc(collection(db,"chatRooms"),{
    participants: [user.uid, otherUserId],
    lastMessage: "",
    lastMessageTime: serverTimestamp(),
    lastSenderId: "",
    unreadCount: {
      [user.uid]: 0,
      [otherUserId]: 0
    },
    userMap: {
      [user.uid]: {
        name: userData.name || "User",
        avatar: userData.avatar || ""
      },
      [otherUserId]: {
        name: otherData.name || "User",
        avatar: otherData.avatar || ""
      }
    },
    createdAt: serverTimestamp()
  });

  return newRoom.id;
}

export async function sendMessage(roomId, text){

  const user = auth.currentUser;
  if(!user || !text) return;

  const roomRef = doc(db,"chatRooms",roomId);

  const roomSnap = await getDoc(roomRef);
  if(!roomSnap.exists()) return;

  const roomData = roomSnap.data();
  const otherUserId = roomData.participants.find(p => p !== user.uid);

  // 1️⃣ Add message
  await addDoc(collection(db,"chatRooms",roomId,"messages"),{
    senderId: user.uid,
    text,
    createdAt: serverTimestamp()
  });

  // 2️⃣ Update room summary
  await updateDoc(roomRef,{
    lastMessage: text,
    lastMessageTime: serverTimestamp(),
    lastSenderId: user.uid,
    [`unreadCount.${otherUserId}`]: increment(1)
  });
}

export async function renderChat(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!content || !user) return;

  const roomId = localStorage.getItem("activeChatRoom");

  content.innerHTML = `
    <div style="padding:20px">
      <div id="chatHeader"></div>
      <div id="chatMessages"></div>
      <div style="margin-top:10px;">
        <input id="chatInput" placeholder="Type message..." />
        <button id="sendBtn">Send</button>
      </div>
    </div>
  `;

  if(!roomId) return;

  const roomRef = doc(db,"chatRooms",roomId);

  // Reset unread
  await updateDoc(roomRef,{
    [`unreadCount.${user.uid}`]: 0
  });

  // Realtime listener
  onSnapshot(
    query(
      collection(db,"chatRooms",roomId,"messages"),
      orderBy("createdAt","asc")
    ),
    snap => {

      const container = document.getElementById("chatMessages");
      container.innerHTML = "";

      snap.forEach(docSnap=>{
        const data = docSnap.data();

        const div = document.createElement("div");
        div.style.marginBottom = "8px";
        div.style.textAlign =
          data.senderId === user.uid ? "right" : "left";

        div.innerHTML = `
          <div style="
            display:inline-block;
            padding:8px 12px;
            border-radius:12px;
            background:${data.senderId === user.uid ? "#2f80ed" : "#eee"};
            color:${data.senderId === user.uid ? "#fff" : "#000"};
          ">
            ${data.text}
          </div>
        `;

        container.appendChild(div);
      });

      container.scrollTop = container.scrollHeight;
    }
  );

  document.getElementById("sendBtn").onclick = async ()=>{
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if(!text) return;

    await sendMessage(roomId,text);
    input.value = "";
  };
}
