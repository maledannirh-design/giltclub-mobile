import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  increment,
  serverTimestamp
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
export function requireAuth(){
  if(!auth.currentUser){
    navigate("profile");
    return false;
  }
  return true;
}
