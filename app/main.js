
import "./profile.js";
import "./booking.js";
import "./cinema.js";
import "./social.js";

import { createTestUser, readTestUser } from "./auth.js";
import { navigate } from "./navigation.js";

window.navigate = function(page){
  import("./navigation.js").then(mod=>{
    mod.navigate(page);
  });
};

document.addEventListener("DOMContentLoaded", async ()=>{
  navigate("home");

  await createTestUser();
  await readTestUser();
});
