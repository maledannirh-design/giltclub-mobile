export async function openSwimForm(){

  const sheet = document.getElementById("createSessionSheet");

  sheet.classList.add("active");

  sheet.innerHTML = `
    <div class="premium-sheet">
      <h2>🏊 Swim Session</h2>

      <input type="date" id="date">
      <input type="time" id="startTime">
      <input type="time" id="endTime">

      <input type="number" id="maxPlayers" placeholder="Max Swimmer">
      <input type="text" id="pool" placeholder="Pool Name">

      <textarea id="notes" placeholder="Notes"></textarea>

      <button id="submitSwim">Create</button>
    </div>
  `;

  document.getElementById("submitSwim").onclick = async ()=>{

    await addDoc(collection(db,"schedules"),{
      sportType: "swim",
      date: date.value,
      startTime: startTime.value,
      endTime: endTime.value,
      maxPlayers: Number(maxPlayers.value),
      pool: pool.value,
      notes: notes.value,
      hostId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      status: "open"
    });

    showToast("Swim created","success");
    renderBooking();

  };

  

};
