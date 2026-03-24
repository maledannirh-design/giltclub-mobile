window.openCounsellingForm = function(){

  const sheet = document.getElementById("createSessionSheet");

  sheet.innerHTML = `
    <div class="premium-sheet">
      <h2>🫂 Counselling</h2>

      <input type="date" id="date">
      <input type="time" id="startTime">

      <input type="text" id="topic">
      <input type="number" id="maxPlayers">

      <button id="submitCounselling">Create</button>
    </div>
  `;

  submitCounselling.onclick = async ()=>{
    await addDoc(collection(db,"schedules"),{
      sportType: "counselling",
      date: date.value,
      startTime: startTime.value,
      topic: topic.value,
      maxPlayers: Number(maxPlayers.value),
      hostId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      status: "open"
    });

    showToast("Counselling created","success");
    renderBooking();
  };

};
