export function formatDate(date){
  return new Date(date).toLocaleDateString("id-ID");
}

export async function safeExecute(fn){
  try {
    return await fn();
  } catch(e){
    console.error(e);
    showToast("System error");
  }
}
