await safeExecute(async ()=>{
   const snap = await getDocs(...)
});
export function requireAuth(){

  if (!auth.currentUser){
    navigate("account");
    return false;
  }

  return true;
}

