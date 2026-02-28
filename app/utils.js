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

/* =============================
   RESOLVE MEMBER CARD TEMPLATE
============================= */
export function resolveMemberCard(membership, genre){

  const GREEN_CARD =
    "https://raw.githubusercontent.com/maledannirh-design/giltclub-mobile/main/app/image/card/member_card.webp";

  const PINK_CARD =
    "https://raw.githubusercontent.com/maledannirh-design/giltclub-mobile/main/app/image/card/member_card_pink.webp";

  const BLACK_CARD =
    "https://raw.githubusercontent.com/maledannirh-design/giltclub-mobile/main/app/image/card/vvip_card.webp";

  if(membership === "VVIP"){
    return BLACK_CARD;
  }

  if(genre === "female"){
    return PINK_CARD;
  }

  return GREEN_CARD;
}
