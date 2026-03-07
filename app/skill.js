/* ======================================================
   RENDER SKILL PAGE
====================================================== */

export function renderSkill(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div style="padding:20px;">
      
      <h2 style="margin-bottom:20px;">
        ⭐ Skill
      </h2>

      <div style="
        background:#fff;
        padding:20px;
        border-radius:16px;
        box-shadow:0 6px 18px rgba(0,0,0,.1);
      ">

        <p style="margin-bottom:10px;">
          Skill system akan tampil di sini.
        </p>

        <p style="font-size:13px;opacity:.7;">
          Coming soon...
        </p>

      </div>

    </div>
  `;
}
