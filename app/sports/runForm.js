window.openRunForm = function(){

  const sheet = document.getElementById("createSessionSheet");

  sheet.innerHTML = `
    <div class="premium-sheet">
      <h2>🏃 Running Session</h2>

      <input type="date" id="date">
      <input type="time" id="startTime">

      <input type="text" id="route" placeholder="Route">
      <input type="number" id="distance" placeholder="Distance (km)">

      <button id="submitRun">Create</button>
    </div>
  `;

  
  submitRun.onclick = async ()=>{
    await addDoc(collection(db,"schedules"),{
      sportType: "run",
      date: date.value,
      startTime: startTime.value,
      route: route.value,
      distance: Number(distance.value),
      hostId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      status: "open"
    });

    showToast("Run created","success");
    renderBooking();
  };

};
