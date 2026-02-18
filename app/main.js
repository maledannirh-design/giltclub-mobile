import { navigate } from "./navigation.js";
import { watchAuth } from "./auth.js";

window.navigate = navigate;

document.addEventListener("DOMContentLoaded", () => {
  console.log("App loaded");

  watchAuth((user) => {
    if (user) {
      console.log("User logged in:", user.uid);
    } else {
      console.log("No user logged in");
    }
  });

  navigate("home");
});
