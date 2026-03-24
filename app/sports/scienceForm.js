window.openScienceForm = function(){

  const sheet = document.getElementById("createSessionSheet");

  sheet.innerHTML = `
    <div class="premium-sheet">
      <h2>🧠 Science Session</h2>

      <input type="date" id="date">
      <input type="time" id="startTime">

      <input type="text" id="topic" placeholder="Topic">
      <input type="text" id="speaker" placeholder="Speaker">

      <button id="submitScience">Create</button>
    </div>
  `;

  submitScience.onclick = async ()=>{
    await addDoc(collection(db,"schedules"),{
      sportType: "science",
      date: date.value,
      startTime: startTime.value,
      topic: topic.value,
      speaker: speaker.value,
      hostId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      status: "open"
    });

    showToast("Science created","success");
    renderBooking();
  };

};

