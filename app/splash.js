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
  const typingSpeed = 35; // sedikit lebih cepat

  function typeWriter(){
    if(index < text.length){
      splashText.textContent += text.charAt(index);
      index++;
      setTimeout(typeWriter, typingSpeed);
    } else {
      finishSplash();
    }
  }

  function finishSplash(){
    splashScreen.classList.add("fade-out");

    setTimeout(() => {
      splashScreen.style.display = "none";
      app.style.opacity = "1";
    }, 500);
  }

  typeWriter();
}
