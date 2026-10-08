# AP Hub — Account Payable Management System

Aplikasi web untuk mengelola siklus **Account Payable** dari tagihan vendor diterima sampai dibayar:

```
PR  →  PO  →  SPK  →  BAST/GR  →  Tagihan Vendor  →  Pengajuan Pembayaran (otorisasi berjenjang)  →  Pembayaran
```

Dibangun dengan **React 19 + TypeScript + Vite**, **Tailwind CSS v4**, **Recharts**, **Zustand**, ikon **Lucide** (SVG, tanpa emoji) dan **Tesseract.js / PDF.js** untuk membaca dokumen tagihan.

## Fitur Utama

| Modul | Isi |
| --- | --- |
| **Dashboard** | KPI (total outstanding, overdue, tagihan masuk bulan ini, menunggu otorisasi, sisa SPK), tren tagihan vs pembayaran, aging hutang, pipeline proses tagihan, top vendor outstanding, tabel tagihan terbaru, jatuh tempo terdekat & SPK outstanding |
| **Scan Tagihan (OCR)** | Unggah file / ambil foto (kamera HP) / PDF. Sistem membaca vendor, **NPWP**, no. invoice, tanggal, jatuh tempo, no. faktur pajak, no. SPK/PO/PR, DPP, PPN, total & rekening — lalu **menarik otomatis dokumen internal** (Vendor via NPWP, SPK, PO, PR, BAST/GR) dan menjalankan **3-way matching** serta deteksi duplikat. Tersedia contoh tagihan untuk uji coba. |
| **Tagihan Masuk** | Register tagihan, filter status/vendor, export CSV, detail tagihan dengan alur dokumen (PR→PO→SPK→BAST→Invoice→PP→Bayar), hasil matching, lampiran & riwayat proses, verifikasi / tolak / ubah rujukan |
| **Outstanding & Aging** | Aging bucket (belum jatuh tempo, 1-30, 31-60, 61-90, >90 hari), filter overdue & jatuh tempo ≤ 7 hari, ringkasan per vendor |
| **SPK** | Nilai kontrak, progres fisik, realisasi tagihan, sisa outstanding, jadwal termin, BAST, update progres |
| **PR & PO** | Data Purchase Requisition, Purchase Order & penerimaan (GR/BAST) sebagai rujukan |
| **Vendor Master** | CRUD vendor: identitas, **NPWP (15/16 digit, tervalidasi & unik)**, NIB, status PKP, jenis PPh, alamat, kontak, rekening bank, termin |
| **Pengajuan Pembayaran** | Form pengajuan dari tagihan terverifikasi, jalur otorisasi otomatis dari **matriks otorisasi** berdasarkan nilai, **tanda tangan digital** tiap PIC (AP Staff → AP Supervisor → Finance Manager → Finance Director → Presiden Direktur), tolak dengan alasan, **formulir siap cetak** dengan terbilang |
| **Persetujuan Saya** | Antrean tanda tangan per peran & riwayat |
| **Realisasi Pembayaran** | Eksekusi pembayaran atas pengajuan yang disetujui penuh, bukti kas keluar & referensi bank |
| **Pengaturan** | Profil perusahaan, tarif PPN, rekening sumber dana, matriks otorisasi, reset data demo |

> Gunakan menu profil di kanan atas untuk **berganti pengguna** dan mensimulasikan tanda tangan berjenjang oleh masing-masing PIC.

## Deploy ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new) → **Import** repository `account-payable-app`.
2. Pilih branch yang berisi kode ini (atau merge ke `main` terlebih dahulu).
3. Konfigurasi sudah otomatis dari `vercel.json` (Framework **Vite**, build `npm run build`, output `dist`) — cukup klik **Deploy**.

Catatan:
- `vercel.json` sudah berisi *rewrite* SPA, sehingga URL seperti `/invoices/...` atau `/spk/...` bisa dibuka langsung / di-refresh tanpa 404.
- Aset OCR (worker, WASM, model bahasa) disalin otomatis ke `dist/tesseract` saat build, jadi OCR berjalan dari domain Vercel Anda sendiri (tanpa CDN pihak ketiga).
- Tidak ada environment variable yang perlu diisi. Node.js ≥ 20.19 (default Vercel sudah sesuai).
- Data tersimpan di `localStorage` browser masing-masing pengguna (mode demo) dan dapat direset dari menu **Pengaturan**.

### Catatan OCR
- OCR berjalan sepenuhnya di browser (dokumen tidak dikirim ke server). Mesin & model bahasa Tesseract disajikan dari aplikasi sendiri (`/tesseract`) dan di-cache browser setelah pemakaian pertama.
- PDF digital dibaca langsung dari text layer (akurasi ~100%); PDF hasil scan & foto dibaca dengan OCR setelah pra-proses (grayscale + kontras).
- Field yang terisi otomatis ditandai hijau (**OCR** / **AUTO**) dan tetap dapat dikoreksi sebelum registrasi.

## Struktur

```
src/
  types/            model domain (Vendor, PR, PO, SPK, GR, Invoice, PaymentRequest, Payment)
  data/seed.ts      data awal demo yang konsisten (vendor, PR/PO/SPK, tagihan, pengajuan, pembayaran)
  store/            state global (Zustand + persist) & aksi workflow
  lib/              kalkulasi pajak & aging, 3-way matching, NPWP, OCR + parser, resolver dokumen, format
  components/       UI kit, layout, komponen domain (alur dokumen, matching, otorisasi, chart)
  pages/            halaman per modul
```
