window.openTennisForm = function(){

  const sheet = document.getElementById("createSessionSheet");
  if(!sheet) return;

  sheet.classList.add("active");

  sheet.innerHTML = `
    <div id="createSessionOverlay"></div>

    <div class="premium-sheet">
      <h2>Buat Sesi Tennis</h2>

      <div class="sheet-section">
        <label>Lapangan</label>
        <input type="text" id="court">
      </div>

      <div class="sheet-section">
        <label>Maksimal Pemain</label>
        <input type="number" id="maxPlayers">
      </div>

      <div class="sheet-section">
        <label>Raket Sewaan</label>
        <input type="number" id="racketStock">
      </div>

      <button id="submitTennisSession">Buat Sesi</button>
    </div>
  `;

  document.getElementById("submitTennisSession").onclick = async ()=>{

    await addDoc(collection(db,"schedules"),{
      sportType: "tennis",
      court: document.getElementById("court").value,
      maxPlayers: Number(document.getElementById("maxPlayers").value),
      racketStock: Number(document.getElementById("racketStock").value),
      createdAt: serverTimestamp()
    });

    showToast("Sesi Tennis dibuat","success");
    sheet.classList.remove("active");
    renderBooking();

  };

};
