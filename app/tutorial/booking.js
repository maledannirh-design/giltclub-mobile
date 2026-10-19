const monthNames=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export function renderTutorialCalendar(){
  const year=2026, month=11; // December, 0-based
  const firstDay=new Date(year,month,1).getDay();
  const days=new Date(year,month+1,0).getDate();
  const cells=[];
  for(let i=0;i<firstDay;i++) cells.push('<span class="gt-calendar-empty"></span>');
  for(let day=1;day<=days;day++){
    cells.push(`<button type="button" class="gt-calendar-day ${day===17?'is-target':''}" data-day="${day}" aria-label="Tanggal ${day}">${day}</button>`);
  }
  return `
    <section class="gt-screen gt-booking-screen">
      <div class="gt-page-heading"><div><span class="gt-eyebrow">JADWAL GMTC</span><h3>Kalender Sesi</h3></div><span class="gt-sample-pill">SIMULASI</span></div>
      <div class="gt-calendar-card">
        <div class="gt-calendar-month"><button type="button" disabled aria-label="Bulan sebelumnya">‹</button><strong>${monthNames[month]} ${year}</strong><button type="button" disabled aria-label="Bulan berikutnya">›</button></div>
        <div class="gt-calendar-grid gt-calendar-weekdays">${["Min","Sen","Sel","Rab","Kam","Jum","Sab"].map(d=>`<span>${d}</span>`).join("")}</div>
        <div class="gt-calendar-grid gt-calendar-days">${cells.join("")}</div>
      </div>
      <p class="gt-calendar-note">Pilih tanggal yang ditunjuk maskot untuk melanjutkan tutorial.</p>
    </section>`;
}

export function renderTutorialBookingForm(){
  return `
    <section class="gt-screen gt-booking-screen">
      <div class="gt-page-heading"><div><span class="gt-eyebrow">JADWAL GMTC</span><h3>Form Booking Sesi</h3></div><span class="gt-sample-pill">SIMULASI</span></div>
      <div class="gt-booking-form">
        <label data-tutorial-field="sessionType">Jenis Sesi<select><option>Mabar</option><option>Drill</option><option>Drill + Mabar</option></select></label>
        <label data-tutorial-field="tier">Tier Sesi<select><option>Newbie</option><option>Beginner</option><option>Upper Beginner</option><option>Intermediate</option></select></label>
        <label data-tutorial-field="sessionMode">Tipe Sesi<select><option>Reguler</option><option>Semi Private</option><option>Private</option></select></label>
        <label data-tutorial-field="maxPlayers">Maksimal Pemain<input value="4" readonly></label>
        <label data-tutorial-field="sessionDate">Tanggal<input value="17 Desember 2026" readonly></label>
        <div class="gt-form-row"><label data-tutorial-field="startTime">Jam Mulai<input value="16:00" readonly></label><label data-tutorial-field="endTime">Jam Selesai<input value="18:00" readonly></label></div>
        <label data-tutorial-field="court">Lapangan<input value="Lapangan GMTC" readonly></label>
        <label data-tutorial-field="ratePerHour">Harga per jam<input value="Rp 75.000" readonly></label>
        <p class="gt-form-note">Contoh form untuk tutorial. Tidak ada booking atau transaksi yang dikirim.</p>
      </div>
    </section>`;
}
