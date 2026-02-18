import "./navigation.js";
import "./auth.js";
import "./profile.js";
import "./booking.js";
import "./cinema.js";
import "./social.js";

window.navigate = function(page){
  import("./navigation.js").then(mod=>{
    mod.navigate(page);
  });
};

document.addEventListener("DOMContentLoaded",()=>{
  navigate("home");
});

