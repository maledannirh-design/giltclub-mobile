export function renderChampionClubPage(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="champion-page">

      <div class="champion-header">
        <div class="title">🏆 Champion Club</div>
        <div class="close-btn" id="closeChampion">✕</div>
      </div>

      <div id="championClub"></div>

    </div>
  `;

  document.getElementById("closeChampion")
    ?.addEventListener("click", ()=>{
      if(window.navigate){
        window.navigate("home");
      }
    });

  // INIT SYSTEM (yang tadi kita buat)
  initChampionClub();
}
