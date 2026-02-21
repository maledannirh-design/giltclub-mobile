document.addEventListener("DOMContentLoaded", () => {
  runSplash();
});

function runSplash(){

  const text = "Where passion, confidence & elegance meet court";
  const splashText = document.getElementById("splashText");
  const splashScreen = document.getElementById("splashScreen");

  let index = 0;

  function typeWriter(){
    if(index < text.length){
      splashText.innerHTML += text.charAt(index);
      index++;
      setTimeout(typeWriter, 35);
    } else {
      setTimeout(() => {
        splashScreen.classList.add("hide");

        setTimeout(() => {
          splashScreen.remove();
        }, 600);

      }, 900);
    }
  }

  typeWriter();
}
