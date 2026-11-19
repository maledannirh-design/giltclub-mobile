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

  if(membership === "VVIP") return BLACK_CARD;
  if(genre === "male") return GREEN_CARD;

  return PINK_CARD;
}


/* =============================
   RENDER MEMBER CARD COMPONENT
============================= */
export function renderMemberCard(userData){

  const templateUrl = resolveMemberCard(
    userData.membership,
    userData.genre
  );

  const fullName = userData.fullName || "MEMBER";
  const memberCode = userData.memberCode || "-";

  const backCardUrl = userData.membership === "VVIP"
    ? "https://raw.githubusercontent.com/maledannirh-design/giltclub-mobile/main/app/image/card/vvip_card_back.png"
    : "https://raw.githubusercontent.com/maledannirh-design/giltclub-mobile/main/app/image/card/member_card_back.png";

  return `
    <div class="membership-card-flip" data-card-flip>
      <div class="membership-card-inner">
        <div class="membership-card-face membership-card-front">
          <img src="${templateUrl}" class="wallet-member-big-img" alt="Kartu member GMTC"/>
          <div class="wallet-member-overlay">
            <div class="wallet-member-name">
              ${fullName.toUpperCase()}
            </div>
            <div class="wallet-member-code">
              ${memberCode}
            </div>
          </div>
        </div>
        <div class="membership-card-face membership-card-back">
          <img
            class="wallet-member-back-img"
            src="${backCardUrl}"
            alt="Bagian belakang kartu member GMTC"
            loading="eager"
          />
        </div>
      </div>
      <div class="membership-card-flip-hint">Geser atau sentuh kartu untuk membalik</div>
    </div>
  `;
}
