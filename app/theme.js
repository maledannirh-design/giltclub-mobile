export function toggleTheme(){

  const current = document.documentElement.getAttribute("data-theme");

  if (current === "dark") {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");
  }
}

export function initTheme(){

  const saved = localStorage.getItem("theme");

  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}
