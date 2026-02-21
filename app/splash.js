document.addEventListener("DOMContentLoaded", () => {
  runSplash();
});

function runSplash(){

  const text = "Where passion, confidence & elegance meet court";
  const splashText = document.getElementById("splashText");
  const splashScreen = document.getElementById("splashScreen");
  const app = document.getElementById("app");

  if(!splashText || !splashScreen || !app) return;

  let index = 0;

  function typeWriter(){
    if(index < text.length){
      splashText.innerHTML += text.charAt(index);
      index++;
      setTimeout(typeWriter, 40); // 🔥 lebih cepat
    } else {

      splashScreen.classList.add("fade-out");

      setTimeout(() => {
        splashScreen.style.display = "none";
        app.style.opacity = "1";
      }, 500); // 🔥 fade cepat
    }
  }

  typeWriter();
}
