// scannerEngine.js

export async function startUniversalScanner({
  readerId,
  resultId,
  mode = "member", // "member" | "checkin"
  scheduleId = null,
  currentUser = null
}){

  const readerEl = document.getElementById(readerId);
  const resultBox = document.getElementById(resultId);

  if(!readerEl || !resultBox) return;

  const html5Qr = new Html5Qrcode(readerId);

  const cameras = await Html5Qrcode.getCameras();

  if(!cameras.length){
    resultBox.innerHTML =
      `<div class="invalid-box">Camera tidak ditemukan</div>`;
    return;
  }

  const backCamera =
    cameras.find(c =>
      c.label.toLowerCase().includes("back") ||
      c.label.toLowerCase().includes("environment")
    ) || cameras[0];

  const config = {
    fps: 20,
    qrbox: (vw, vh) => {
      const min = Math.min(vw, vh);
      const size = Math.floor(min * 0.8);
      return { width: size, height: size };
    },
    aspectRatio: 1.0,
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true
    }
  };

  let processing = false;

  await html5Qr.start(
    backCamera.id,
    config,
    async (decodedText) => {

      if(processing) return;
      processing = true;

      try{

        const cleaned = decodedText.trim().replace(/\n/g,"");

        let c,i,s;

        if(cleaned.startsWith("http")){
          const parsed = new URL(cleaned);
          c = parsed.searchParams.get("c");
          i = parsed.searchParams.get("i");
          s = parsed.searchParams.get("s");
        }else{
          const params = new URLSearchParams(cleaned);
          c = params.get("c");
          i = params.get("i");
          s = params.get("s");
        }

        if(!c || !i || !s){
          showInvalid("QR format tidak valid");
          return reset();
        }

        let res;

        if(mode === "checkin"){
          if(!scheduleId || !currentUser){
            showInvalid("Check-in parameter missing");
            return reset();
          }

          res = await window.processCheckIn(
            c, i, s,
            scheduleId,
            currentUser
          );

        }else{
          res = await window.validateScanParams(c,i,s);
        }

        if(res.valid){
          showValid(res);
        }else{
          showInvalid(res.reason);
        }

      }catch(err){
        showInvalid("QR tidak valid");
      }

      reset();
    }
  );

  function showValid(res){
    resultBox.innerHTML = `
      <div style="
        background:#1f2d1f;
        border:2px solid #2ecc71;
        padding:18px;
        border-radius:14px;
        text-align:center;
      ">
        ✅ ${mode==="checkin" ? "CHECK-IN BERHASIL" : "VALID MEMBER"}
        <div style="margin-top:8px;">
          ${res.user?.username || ""}
        </div>
      </div>
    `;
  }

  function showInvalid(msg){
    resultBox.innerHTML = `
      <div style="
        background:#3a1c1c;
        border:2px solid #e74c3c;
        padding:18px;
        border-radius:14px;
        text-align:center;
      ">
        ❌ ${msg}
      </div>
    `;
  }

  function reset(){
    setTimeout(()=>{
      resultBox.innerHTML = "";
      processing = false;
    },1500);
  }

  return html5Qr;
}
