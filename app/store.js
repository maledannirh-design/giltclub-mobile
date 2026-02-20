export function renderStore(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="page-fade">
      <h2>Toko</h2>
      <div class="panel">
        <p>Segera hadir..../p>
      </div>
    </div>
  `;
}
