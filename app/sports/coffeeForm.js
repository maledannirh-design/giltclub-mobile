export async function openCoffeeForm(){
  
  const sheet = document.getElementById("createSessionSheet");

  sheet.classList.add("active");

  sheet.innerHTML = `
    <div class="premium-sheet">
      <h2>☕ Coffee Time</h2>

      <input type="date" id="date">
      <input type="time" id="startTime">

      <input type="text" id="location" placeholder="Cafe Location">
      <input type="number" id="maxPlayers" placeholder="Capacity">

      <textarea id="notes"></textarea>

      <button id="submitCoffee">Create</button>
    </div>
  `;

  
  submitCoffee.onclick = async ()=>{
    await addDoc(collection(db,"schedules"),{
      sportType: "coffee",
      date: date.value,
      startTime: startTime.value,
      maxPlayers: Number(maxPlayers.value),
      location: location.value,
      notes: notes.value,
      hostId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      status: "open"
    });

    showToast("Coffee created","success");
    renderBooking();
  };

};
