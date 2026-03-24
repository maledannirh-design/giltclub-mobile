window.openDanceForm = function(){

  const sheet = document.getElementById("createSessionSheet");

  sheet.innerHTML = `
    <div class="premium-sheet">
      <h2>💃 Dance Session</h2>

      <input type="date" id="date">
      <input type="time" id="startTime">

      <input type="text" id="style" placeholder="Dance Style">
      <input type="number" id="maxPlayers">

      <button id="submitDance">Create</button>
    </div>
  `;

  
  submitDance.onclick = async ()=>{
    await addDoc(collection(db,"schedules"),{
      sportType: "dance",
      date: date.value,
      startTime: startTime.value,
      style: style.value,
      maxPlayers: Number(maxPlayers.value),
      hostId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      status: "open"
    });

    showToast("Dance created","success");
    renderBooking();
  };

};
