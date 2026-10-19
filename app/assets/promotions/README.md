# GMTC Promo Images

Simpan gambar promo di folder ini: `app/assets/promotions/`.

## Cara menambahkan promo

1. Upload gambar ke folder ini melalui GitHub.
2. Buka `promotions.json`.
3. Tambahkan satu item ke dalam array `promos`, memakai nama file persis.

Contoh:

```json
{
  "promos": [
    { "file": "tennis-pilates-250k.jpg", "active": true },
    { "file": "promo-jersey.jpg", "active": true },
    { "file": "promo-drill.jpg", "active": false }
  ]
}
```

- `active: true` = tampil di Teras.
- `active: false` = tidak tampil.
- Jika semua promo nonaktif atau array kosong, aplikasi menampilkan **Belum ada promo.**
- Pastikan nama file di JSON sama persis dengan nama file gambar, termasuk ekstensi.
- Gambar harus sudah berisi informasi promonya karena aplikasi menampilkan gambar apa adanya.

Gambar promo tidak diunggah ke Firebase. File gambar dan manifest ini disimpan di repository GitHub.
