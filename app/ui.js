export function showToast(message, type = "default"){

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerText = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}


export function showConfirm(options){

  return new Promise((resolve) => {

    // Support string lama (backward compatible)
    if (typeof options === "string") {
      options = {
        message: options
      };
    }

    const {
      title = "Konfirmasi",
      message = "",
      confirmText = "Confirm",
      cancelText = "Cancel",
      type = "default" // default | danger | success
    } = options;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
      <div class="modal-box modal-${type}">
        <div class="modal-title">${title}</div>
        <div class="modal-message">${message}</div>
        <div class="modal-actions">
          <button class="modal-cancel">${cancelText}</button>
          <button class="modal-confirm">${confirmText}</button>
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
