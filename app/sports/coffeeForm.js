window.openCoffeeForm = function(){

  const sheet = document.getElementById("createSessionSheet");

  sheet.classList.add("active");

  sheet.innerHTML = `
    <div class="premium-sheet">
      <h2>Coffee Session</h2>

      <div class="sheet-section">
        <label>Tempat</label>
        <input type="text" id="location">
      </div>

      <div class="sheet-section">
        <label>Kapasitas</label>
        <input type="number" id="capacity">
      </div>

      <button id="submitCoffee">Create</button>
    </div>
  `;

};
