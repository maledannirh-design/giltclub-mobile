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
