export function renderWalletTutorial(step){
  return `
    <section class="gt-screen gt-wallet-screen">
      <div class="gt-home-profile"><span class="gt-avatar">💳</span><div><strong>G-WALLET</strong><small>Simulasi saldo & keanggotaan</small></div></div>
      <div class="gt-wallet-card">
        <div class="gt-wallet-top" data-wallet-field="balance"><span>G-Saldo</span><button type="button" class="gt-wallet-eye" aria-label="Tampilkan atau sembunyikan saldo">◉</button></div>
        <strong class="gt-wallet-amount">Rp ******</strong>
        <div class="gt-member-card" data-wallet-field="memberCard"><div class="gt-member-card-label">GMTC MEMBER CARD</div><strong>MEMBER NAME</strong><small>Member ID: GMTC-0000</small><div class="gt-member-card-actions"><button type="button" class="gt-sim-card-action">Scan Check-In</button><button type="button" class="gt-sim-card-action">Print Card</button></div></div>
      </div>
      <div class="gt-wallet-actions">
        <button type="button" class="gt-wallet-action" data-wallet-field="topup"><span>＋</span><strong>Top Up</strong><small>Isi saldo Rupiah</small></button>
        <button type="button" class="gt-wallet-action"><span>↗</span><strong>Tarik Saldo</strong><small>Hubungi admin</small></button>
        <button type="button" class="gt-wallet-action" data-wallet-field="rupiahMutation"><span>▤</span><strong>Mutasi Saldo</strong><small>Riwayat Rupiah</small></button>
        <button type="button" class="gt-wallet-action" data-wallet-field="gpointMutation"><span>⭐</span><strong>Mutasi G-Point</strong><small>Riwayat poin</small></button>
      </div>
      <div class="gt-wallet-demo-topup" hidden><strong>Simulasi Deposit / Top Up</strong><p>Masukkan nominal contoh (minimal Rp10.000).</p><input type="number" min="10000" step="1000" value="10000" aria-label="Nominal top up simulasi"><button type="button" class="gt-sim-topup-submit">Simulasikan pengajuan</button><p class="gt-wallet-demo-message" aria-live="polite"></p></div>
      <div class="gt-wallet-demo-note">Layar contoh • tidak terhubung ke saldo atau transaksi sungguhan.</div>
    </section>`;
}
