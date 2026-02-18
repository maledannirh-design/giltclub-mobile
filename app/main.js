import { navigate } from "./navigation.js";

window.navigate = navigate;

document.addEventListener("DOMContentLoaded", () => {
  navigate("home");
});
