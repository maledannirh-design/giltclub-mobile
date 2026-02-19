export function showToast(message, type = "default"){

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerText = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}

export function showConfirm(message){

  return new Promise((resolve) => {

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-message">${message}</div>
        <div class="modal-actions">
          <button class="modal-cancel">Cancel</button>
          <button class="modal-confirm">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".modal-cancel").onclick = () => {
      overlay.remove();
      resolve(false);
    };

    overlay.querySelector(".modal-confirm").onclick = () => {
      overlay.remove();
      resolve(true);
    };

  });
}
