import { createTestUser, readTestUser } from "./auth.js";
import { navigate } from "./navigation.js";

window.navigate = navigate;

document.addEventListener("DOMContentLoaded", async () => {
  console.log("App loaded");

  navigate("home");

  await createTestUser();
  await readTestUser();
});
