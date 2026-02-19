import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where
};


export async function safeExecute(fn){
  try {
    return await fn();
  } catch(e){
    console.error(e);
    showToast("System error");
  }
}
await safeExecute(async ()=>{
   const snap = await getDocs(...)
});
