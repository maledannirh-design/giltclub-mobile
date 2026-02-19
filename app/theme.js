function applyTheme(theme){

  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  localStorage.setItem("theme", theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme){

  const btn = document.querySelector(".theme-toggle");
  if (!btn) return;

  btn.innerText = theme === "dark" ? "☀️" : "🌙";
}

export function toggleTheme(){

  const current = localStorage.getItem("theme") || "light";
  const next = current === "dark" ? "light" : "dark";

  applyTheme(next);
}

export function initTheme(){

  const saved = localStorage.getItem("theme") || "light";
  applyTheme(saved);
}
