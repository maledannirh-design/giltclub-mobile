document.addEventListener("DOMContentLoaded", () => {
  runSplash();
});

function runSplash(){

  const text = "Where passion, confidence & elegance meet court";
  const splashText = document.getElementById("splashText");
  const splashScreen = document.getElementById("splashScreen");

  if(!splashText || !splashScreen) return;

  let index = 0;

  function typeWriter(){
    if(index < text.length){
      splashText.innerHTML += text.charAt(index);
      index++;
      setTimeout(typeWriter, 250);
    } else {

      setTimeout(() => {
        splashScreen.classList.add("fade-out");

        setTimeout(() => {
          splashScreen.classList.add("hide");
        }, 800);

      }, 2500);
    }
  }

  typeWriter();
}
