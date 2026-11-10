import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Wrench,
  CheckCircle2,
  X,
  Calendar,
  Layers,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

export const CURRENT_APP_VERSION = 'v4.0.2';

interface PatchNoteItem {
  type: 'feature' | 'fix' | 'ui';
  title: string;
  description: string;
}

interface PatchRelease {
  version: string;
  date: string;
  codename: string;
  isLatest?: boolean;
  highlights: string;
  changes: PatchNoteItem[];
}

export const PATCH_RELEASES: PatchRelease[] = [
  {
    version: 'v4.0.2',
    date: '10 November 2026',
    codename:
      'Perbaikan Perhitungan Fee Perantara sebagai Biaya Tambahan (Netto × Fee) & Total Modal = Netto × (Harga + Fee)',
    isLatest: true,
    highlights:
      'Memperbaiki rumus perhitungan Fee Perantara pada pembelian tembakau mentah agar dihitung murni sebagai Biaya Tambahan (Added Cost), bukan keuntungan: Netto = Bruto − Tarra, Biaya Fee = Netto × Fee/KG, dan Total Modal = Netto × (Harga Tembakau + Fee/KG). Contoh: 50 kg dengan potongan 10% + 2 kg menghasilkan Netto = 50 − 5 − 2 = 43 kg; dengan harga Rp 50.000/kg dan fee Rp 1.000/kg, maka Biaya Fee = 43 × Rp 1.000 = Rp 43.000 dan Total Modal = 43 × Rp 51.000 = Rp 2.193.000.',
    changes: [
      {
        type: 'fix',
        title: 'Fee Perantara Dihitung sebagai Biaya Tambahan: Netto × Fee/KG (Bukan Profit)',
        description:
          'Menghapus perhitungan "Untung Timbangan" yang keliru saat menambah fee dan menggantinya dengan rincian biaya yang akurat: Netto = Bruto − Tarra (misal 50 − 5 − 2 = 43 kg), Biaya Tambahan Fee = Netto × Fee (43 × Rp 1.000 = Rp 43.000).',
      },
      {
        type: 'fix',
        title: 'Total Harga Modal = Netto × (Harga Tembakau + Fee/KG)',
        description:
          'Jika harga tembakau Rp 50.000/kg dan fee Rp 1.000/kg, maka harga modal per kg otomatis menjadi Rp 51.000/kg dikalikan Netto (43 kg × Rp 51.000 = Rp 2.193.000).',
      },
      {
        type: 'ui',
        title: 'Tampilan 3 Kotak Rincian Biaya di Form, Kartu Gudang & Rumus ƒx',
        description:
          'Menampilkan 3 rincian jelas di seluruh panel: (1) Harga Tembakau Dasar (Netto × Harga), (2) Biaya Tambahan Fee (Netto × Fee), dan (3) Total Modal Kita Bayar (Netto × (Harga + Fee)).',
      },
    ],
  },
  {
    version: 'v4.0.1',
    date: '10 November 2026',
    codename:
      'Tombol Kunci Semua & Buka Semua di Edit, Panel Rapi per Bagian Tanpa Teks Tutorial Sempit, & Urutan Grade A, A+, B, B+ s/d F+',
    highlights:
      'Menambahkan tombol "Kunci Semua" dan "Buka Semua" pada panel Edit/Tambah Tembakau Mentah maupun Edit Seri, merapikan seluruh panel menjadi tab bagian yang fokus (tidak menumpuk terlalu banyak data di satu layar), menghapus teks tutorial/contoh yang memakan tempat di ruang sempit, serta memperbarui urutan Grade Tembakau menjadi A, A+, B, B+, C, C+, D, D+, E, E+, F, F+.',
    changes: [
      {
        type: 'feature',
        title: 'Tombol "Kunci Semua" & "Buka Semua" pada Panel Edit',
        description:
          'Menyediakan tombol "Kunci Semua" dan "Buka Semua" berdampingan di bagian atas panel Edit/Tambah Tembakau Mentah serta Edit Seri Jadi untuk mengunci atau membuka seluruh kolom sekaligus dengan 1 klik.',
      },
      {
        type: 'ui',
        title: 'Panel Lebih Rapi per Bagian & Bebas Teks Tutorial Sempit',
        description:
          'Membagi panel Edit Data Tembakau Mentah dan Edit Seri ke dalam tab bagian yang rapi (1. Data, Timbangan & Fee | 2. Grade & 6 Karakter | Semua) serta menghapus kotak/teks tutorial panjang yang menghabiskan ruang.',
      },
      {
        type: 'feature',
        title: 'Urutan Grade Tembakau A, A+, B, B+ s/d F+',
        description:
          'Memperbarui daftar dan urutan Grade Tembakau di seluruh aplikasi menjadi berurutan dari A, A+, B, B+, C, C+, D, D+, E, E+, F, hingga F+.',
      },
    ],
  },
  {
    version: 'v4.0.0',
    date: '10 November 2026',
    codename:
      'Revisi Pembulatan Potongan Tarra (Beli & Jual): Desimal .5 ke Atas Bulat Naik (Contoh: 58 kg Potongan 2 kg + 10% = 2 + 6 = 8 kg)',
    highlights:
      'Menyeragamkan aturan pembulatan potongan timbangan (Tarra) untuk Pembelian (Beli Bahan Mentah) maupun Penjualan/Setoran Pabrik (Jual Seri Gulungan & Simulator): setiap hasil hitungan persen tarra dan potongan yang bernilai desimal ≥ 0.5 otomatis dibulatkan ke atas menjadi bilangan bulat berikutnya (contoh: 10% dari 50–54 kg = 5 kg, namun 55–59 kg = 6 kg; Seri AK 1 58 kg dengan potongan 2 kg + 10% menghasilkan 2 kg + 6 kg = 8 kg).',
    changes: [
      {
        type: 'fix',
        title: 'Pembulatan Otomatis .5 ke Atas pada Potongan Persen (%) untuk Beli & Jual',
        description:
          'Setiap potongan persen (misal 10%) kini membulatkan nilai ≥ 0.5 ke atas: 10% dari 50 kg = 5 kg, sedangkan 55 kg s/d 59 kg (5.5 s/d 5.9) otomatis dibulatkan menjadi 6 kg potongan baik saat Beli Bahan Mentah maupun Jual/Setor Pabrik.',
      },
      {
        type: 'feature',
        title: 'Kalkulator Potongan Flat (KG) + Potongan (%) di Edit Seri & Rincian Rumus ƒx',
        description:
          'Contoh nyata: Seri AK 1 dengan Bruto 58 kg dan potongan 2 kg + 10% akan menghitung 10% × 58 kg = 5.8 kg (dibulatkan ke atas menjadi 6 kg) + 2 kg = Total Potongan 8 kg (bukan 7.8 kg), sehingga Netto Tagih menjadi 50 kg.',
      },
      {
        type: 'ui',
        title: 'Sinkronisasi Pembulatan pada Simulator Tarra, Racik Campuran & Data Tersimpan',
        description:
          'Seluruh modul (Tambah/Edit Barang, Racik Campuran, Edit Seri, Simulator Tarra, dan Rincian Rumus ƒx) kini menampilkan proses pembulatan secara transparan (misal: 5.8 kg → dibulatkan 6 kg).',
      },
    ],
  },
  {
    version: 'v3.9.9',
    date: '10 November 2026',
    codename:
      'Fitur Multi-Fee Pencari Barang / Perantara per KG (Bisa >1 Orang) & Auto-Remember Nama Agen di Tambah Barang',
    highlights:
      'Menambahkan fitur "Fee Pencari Barang / Perantara" per kilogram (Rp/kg) pada panel Tambah/Edit Barang yang dapat ditambahkan lebih dari 1 orang (misal Pak Yohan Rp 1.000/kg + Bu Menik Rp 1.000/kg = +Rp 2.000/kg khusus untuk barang tersebut), lengkap dengan memori otomatis (Auto-Remember) untuk Nama Agen/Perantara.',
    changes: [
      {
        type: 'feature',
        title: 'Tambah Lebih dari 1 Fee Perantara / Pencari Barang per KG (Rp/kg)',
        description:
          'Memungkinkan penambahan 1 atau lebih orang pencari barang/perantara pada setiap stok tembakau mentah, di mana masing-masing orang memiliki nominal fee per kg yang otomatis dijumlahkan ke harga per kg khusus untuk barang tersebut saja (misal Pak Yohan Rp 1.000/kg + Bu Menik Rp 1.000/kg = tambahan +Rp 2.000/kg).',
      },
      {
        type: 'feature',
        title: 'Auto-Remember Nama Agen / Pencari Barang',
        description:
          'Setiap nama agen/perantara yang pernah diinput otomatis diingat oleh aplikasi dan muncul sebagai teks bayangan (shadow), saran ketik otomatis (autocomplete), serta tombol klik cepat "+ Nama Agen" agar tidak perlu mengetik ulang.',
      },
      {
        type: 'ui',
        title: 'Rincian Rumus ƒx & Kartu Stok Menampilkan Breakdown Fee Perantara',
        description:
          'Kartu stok mentah, detail barang, serta rincian rumus ƒx (Paid Value, Real Value, dan Weight Profit) otomatis menampilkan rincian harga beli dasar ditambah daftar fee perantara per kg.',
      },
    ],
  },
  {
    version: 'v3.9.8',
    date: '10 November 2026',
    codename:
      'Panel Tambah Barang Sistem Dicicil: Textbox Kosong Berbayang (Shadow), Auto-Ingat Nama Tembakau & Penjual, Parameter Default 0 & Kunci Edit per Kolom',
    highlights:
      'Merombak panel Tambah Barang agar mendukung penginputan bertahap (dicicil): seluruh kotak isian dimulai dalam keadaan kosong dengan teks bayangan (shadow placeholder), otomatis mengingat Nama Tembakau & Nama Penjual terakhir, seluruh parameter karakter dimulai dari 0 (0.0/5), serta setiap kolom dilengkapi tombol Kunci/Buka Edit (terbuka secara default) dan indikator Kosong vs Terisi.',
    changes: [
      {
        type: 'feature',
        title: 'Seluruh Textbox Kosong dengan Teks Bayangan (Shadow Placeholder) & Indikator Kosong/Terisi',
        description:
          'Saat membuka Tambah Barang, seluruh kotak teks dan angka dimulai dalam keadaan kosong (tidak terisi angka awal) namun menampilkan teks bayangan (shadow) sebagai contoh, dilengkapi penanda "Kosong" vs "Terisi" serta garis putus-putus pada data yang belum diisi agar mudah dicicil.',
      },
      {
        type: 'feature',
        title: 'Auto-Remember Nama Tembakau & Nama Penjual / Pengepul',
        description:
          'Otomatis mengingat riwayat Nama Tembakau dan Nama Penjual yang pernah diinput dan menampilkannya sebagai bayangan (shadow), saran ketik otomatis (autocomplete), serta tombol klik cepat (Ingat Cepat) di bawah kolom.',
      },
      {
        type: 'feature',
        title: 'Parameter Karakter Default 0 (0.0/5) & Tombol Kunci/Buka Edit per Kolom (Unlocked by Default)',
        description:
          'Seluruh 6 parameter karakter (Power, Impact, Bitter, Burn, Sugar, Aroma) dimulai dari nilai 0 secara default, dan setiap textbox maupun parameter memiliki tombol Kunci/Buka (terbuka secara default) serta tombol "Kunci yang Sudah Terisi" agar data yang sudah diinput aman saat mencicil data barang berikutnya.',
      },
    ],
  },
  {
    version: 'v3.9.7',
    date: '10 November 2026',
    codename:
      'Status Diterima/Accepted & Status Bayar Terpisah (Cair vs Belum Cair), Grafik Total Gulungan & Per Pabrik, serta UI Transfer Google Sheets Ringkas',
    highlights:
      'Memisahkan status penerimaan barang menjadi "Diterima / Accepted" dengan status pembayaran terpisah yaitu "Cair (Paid)" dan "Belum Cair (Not Paid)", mengganti grafik per gulungan menjadi Grafik Total Semua Gulungan & Per Pabrik (baik di aplikasi maupun di Google Sheets), serta menghapus kotak hasil transfer yang besar menjadi notifikasi sementara dengan tombol pintasan kecil untuk membuka Google Sheets.',
    changes: [
      {
        type: 'feature',
        title: 'Pemisahan Status "Diterima / Accepted" dengan Status Pembayaran "Cair (Paid)" vs "Belum Cair (Not Paid)"',
        description:
          'Mengubah label "Terima Cair / Diterima Cair" menjadi "Diterima / Accepted", serta menambahkan status pembayaran tersendiri yaitu "Cair (Paid)" dan "Belum Cair (Not Paid)" pada tiap Nomor Seri, filter Status Barang, dan menu Riwayat.',
      },
      {
        type: 'feature',
        title: 'Grafik Perbandingan untuk Total Semua Gulungan & Per Pabrik (Menggantikan Grafik Per Gulungan)',
        description:
          'Mengganti grafik lama yang menampilkan per gulungan menjadi Grafik Total Semua Gulungan beserta perbandingan Per Pabrik Tujuan (mis. CELLO MUNTILAN, PT Gudang Garam Tbk - Kediri) baik di menu Riwayat aplikasi maupun pada grafik otomatis di Google Sheets.',
      },
      {
        type: 'ui',
        title: 'Penghapusan Panel Besar Hasil Transfer & Tombol Kecil Redirect Google Sheets',
        description:
          'Menghapus kotak besar "Transfer ke Google Sheets Berhasil!" agar tidak memakan tempat, menggantinya dengan status sementara (auto-hide toast/strip) dan tombol link kecil "Buka di Sheets" yang hemat ruang.',
      },
    ],
  },
  {
    version: 'v3.9.6',
    date: '10 November 2026',
    codename:
      'Memori Nama & Link Spreadsheet Khusus Akun Google Pribadi, Tabel Google Sheets Rapi (2 Sel Vertikal & Text-Wrap), Grafik Profit & Tombol CSV',
    highlights:
      'Aplikasi kini otomatis mengingat Nama File & Link Google Spreadsheet secara privat khusus untuk Akun Google yang sedang login (terkunci per email Google sehingga tidak dapat dilihat atau diedit oleh orang lain/mode tamu). Dilengkapi perbaikan otomatis format tabel Google Sheets (2 sel vertikal, Text-Wrap, ukuran kolom & garis tabel), Grafik Perbandingan Pendapatan, Modal, Profit & Reject, serta penataan tombol Salin & Unduh CSV.',
    changes: [
      {
        type: 'feature',
        title: 'Memori Nama & Link Google Spreadsheet Khusus Akun Google yang Sama (Privasi Terkunci)',
        description:
          'Menyimpan dan mengisi ulang otomatis Nama File Spreadsheet serta Link Spreadsheet yang terhubung secara eksklusif ketika menggunakan Akun Google yang sama. Jika belum login Google atau berbeda akun, data nama & link spreadsheet disembunyikan sepenuhnya agar orang lain tidak dapat melihat atau mengeditnya.',
      },
      {
        type: 'fix',
        title: 'Perbaikan Otomatis Format Tabel Google Sheets (2 Sel Vertikal, Text-Wrap & Garis Tabel)',
        description:
          'Menerapkan format otomatis Google Sheets API (wrapStrategy: WRAP, penggabungan sel judul, 2 sel vertikal atas-bawah untuk informasi Gulungan/Pabrik/Tanggal, lebar kolom otomatis, serta garis bingkai tabel penuh) baik saat Membuat Sheet Baru maupun Update Sheet yang Ada sehingga seluruh kata terlihat utuh sekaligus.',
      },
      {
        type: 'feature',
        title: 'Grafik Perbandingan Profit vs Pendapatan (Nota), Modal & Reject (Di Aplikasi & Google Sheets)',
        description:
          'Menambahkan visualisasi Grafik Perbandingan Pendapatan Nota, Modal Produksi, Profit Bersih, dan Nilai Reject/Loss langsung di menu Riwayat serta membuat Tab khusus "Ringkasan & Grafik Profit" berisi grafik batang otomatis di dalam Google Sheets.',
      },
      {
        type: 'ui',
        title: 'Penataan Rapi Tombol Salin & Unduh CSV pada Modal Google Sheets',
        description:
          'Menyusun ulang bagian Alternatif Cepat menjadi 2 kartu simetris dengan tombol "Unduh CSV" tepat di bawah tombol "Salin Riwayat Nota" dan "Salin Status Seri" agar rapi di layar HP maupun desktop.',
      },
    ],
  },
  {
    version: 'v3.9.5',
    date: '9 November 2026',
    codename:
      'Filter Pabrik Dinamis pada Angka Riwayat, Penggabungan Fitur Gulungan & Status Barang (Tombol Kirim ke Pabrik), Istilah Menunggu Pabrik & Simulator Slide-Down di Header Atas',
    highlights:
      '4 Kartu Ringkasan Angka di menu Riwayat kini otomatis mengikuti filter pilihan Pabrik & pencarian, penyatuan seluruh fitur lengkap antara menu Gulungan (masih di gudang kita) dan Status Barang (sudah dikirim ke pabrik) lengkap dengan tombol "Kirim ke Pabrik", penggantian istilah "QC" menjadi "Menunggu Pabrik", serta pemindahan Simulator ke tombol animasi di bar atas layar.',
    changes: [
      {
        type: 'feature',
        title: '4 Angka Utama di Menu Riwayat Otomatis Mengikuti Filter Pilihan Pabrik',
        description:
          'Saat memilih "Semua Pabrik", kartu Total Nilai Nota, Diterima & Uang Cair, Nilai Menunggu Pabrik, serta Total Profit Bersih menampilkan total keseluruhan. Saat memilih pabrik tertentu (mis. PT Gudang Garam Tbk - Kediri), keempat angka beserta rincian rumus ƒx otomatis menghitung khusus pabrik tersebut.',
      },
      {
        type: 'feature',
        title: 'Penyatuan Fitur Lengkap Gulungan & Status Barang + Tombol "Kirim ke Pabrik"',
        description:
          'Menghilangkan input ganda dengan menyatukan seluruh fitur lengkap (Gulungan 3D, 5 Panel Rumus, Daftar Seri Terima Cair/Reject, Tabel Nota Sheet, dan Komposisi Per Grade). Menu Gulungan menampilkan gulungan yang masih di gudang kita dengan tombol "Kirim ke Pabrik →" untuk memindahkannya ke menu Status Barang.',
      },
      {
        type: 'ui',
        title: 'Penggantian Istilah "QC" Menjadi "Menunggu Pabrik" / "Status Pabrik"',
        description:
          'Mengganti seluruh istilah "Menunggu QC" dan "Status QC" menjadi kata yang lebih familiar yaitu "Menunggu Pabrik" dan "Status Pabrik" di seluruh aplikasi.',
      },
      {
        type: 'ui',
        title: 'Simulator Dipindahkan ke Header Atas Layar dengan Animasi Slide-Down',
        description:
          'Memindahkan menu Simulator keluar dari bar navigasi utama ke tombol "Simulator" di bagian atas layar (dilengkapi laci modal animasi slide-down yang rapi di HP maupun desktop) agar navigasi utama lebih lega.',
      },
    ],
  },
  {
    version: 'v3.9.4',
    date: '9 November 2026',
    codename:
      'Auto-Slide ke Form Edit, Ringkasan Komposisi Grade Poin-per-Poin (+Harga/KG), Huruf & Tombol Besar Ramah HP & Parameter Karakter Tetap',
    highlights:
      'Kemudahan otomatis geser layar ke atas (Auto-Slide) setiap menekan tombol Edit, format baru Ringkasan Komposisi Grade poin per poin lengkap dengan persentase, berat KG, dan harga per KG, ukuran tombol & teks yang jauh lebih besar dan mudah dibaca di HP, serta penguncian parameter karakter campuran Gulungan menjadi tetap (hanya menyisakan input Nama Grader & Tanggal Evaluasi).',
    changes: [
      {
        type: 'ui',
        title: 'Format Poin-per-Poin pada Ringkasan Komposisi Grade (Lengkap Persentase, KG & Harga)',
        description:
          'Ringkasan Komposisi tiap Grade kini disusun rapi poin per poin ke bawah (contoh: Grade D+ lalu baris "- Muntilan Yohan 50% (50 KG) (Rp 50.000)" dan "- Temanggung Samuel 50% (50 KG) (Rp 75.000)") sehingga langsung jelas dan mudah dibaca.',
      },
      {
        type: 'ui',
        title: 'Tombol "Komposisi Tembakau Per Grade" & "Rata-Rata Karakter" Lebih Besar (Ramah Layar HP)',
        description:
          'Memperbesar ukuran tombol navigasi Komposisi Tembakau Per Grade, tombol filter tiap Grade, kartu Rata-Rata Karakter Tembakau Per Gulungan (2 kolom besar di layar HP), serta seluruh ukuran huruf agar terbaca jelas di ponsel.',
      },
      {
        type: 'feature',
        title: 'Otomatis Geser Layar ke Atas (Auto-Slide) Saat Menekan Tombol Edit',
        description:
          'Setiap kali menekan tombol Edit pada daftar Kemasan, Pabrik, atau Gulungan di menu Format, layar otomatis bergeser halus ke bagian atas menuju form Mode Edit.',
      },
      {
        type: 'fix',
        title: 'Parameter Karakter Gulungan Tetap (Uneditable) & Penyederhanaan Form Grader',
        description:
          'Menghapus Vonis Grader Pabrik dan slider evaluasi karakter yang tidak diperlukan karena campuran Seri di dalam Gulungan sudah bersifat tetap. Bagian bawah kini fokus pada pencatatan Nama Grader dan Tanggal Evaluasi.',
      },
    ],
  },
  {
    version: 'v3.9.3',
    date: '9 November 2026',
    codename:
      'Komposisi & Evaluasi Per Grade Gulungan, 6 Karakter Asli (+Aroma & Burn), 3 Tab Gulungan, Warna Gulungan Natural & Edit Format',
    isLatest: false,
    highlights:
      'Pembaruan besar pada Arsip Gulungan (3 Tab navigasi jelas: Daftar Seri, Tabel Nota Sheet, dan Komposisi & Evaluasi Per Grade), rincian komposisi tiap Grade secara terpisah (contoh: Grade D = Muntilan Bu Menik 50% (50 kg), Windusari Pak Yohan 50% (50 kg)), standarisasi 6 Parameter Karakter Asli (Power, Impact, Bitter, Burn, Sugar, Aroma) di seluruh aplikasi tanpa Skor Kelembutan/Wangi/Kualitas Abu, warna Gulungan natural kayu & daun tembakau matang (tanpa tombol Animasi Gulungan), serta fitur Edit penuh pada menu Format.',
    changes: [
      {
        type: 'feature',
        title: 'Komposisi & Evaluasi Per Grade di Tiap Gulungan + Rata-Rata Karakter Gulungan',
        description:
          'Setiap Gulungan kini menampilkan rata-rata karakter tembakau di dalam gulungan serta rincian komposisi yang dipisahkan per Grade (tidak lagi digabung sekaligus). Contoh: Grade D = Muntilan Bu Menik 50% (50 kg), Windusari Pak Yohan 50% (50 kg), lengkap dengan rata-rata karakter tiap Grade.',
      },
      {
        type: 'feature',
        title: 'Standarisasi 6 Parameter Karakter Asli: Power, Impact, Bitter, Burn, Sugar & Aroma',
        description:
          'Menghapus Skor Kelembutan, Skor Wangi, Kualitas Abu, dan Laju Bakaran pada evaluasi gulungan. Mengganti istilah "Bakar" menjadi "Burn" serta menambahkan parameter ke-6 yaitu "Aroma" di Stok Tembakau Mentah, Kalkulator Racikan, Seri Jadi, hingga Evaluasi Gulungan.',
      },
      {
        type: 'ui',
        title: '3 Tab Navigasi Jelas di Dalam Gulungan (Daftar Seri, Tabel Nota Sheet, Komposisi & Evaluasi)',
        description:
          'Mengganti tombol "Sembunyikan Seri" dan "Buka Nota Sheet" yang membingungkan dengan 3 Tab Pemindah Tampilan langsung di dalam Gulungan: (1) Daftar Seri, (2) Tabel Nota Sheet, dan (3) Komposisi & Evaluasi Per Grade.',
      },
      {
        type: 'ui',
        title: 'Warna Gulungan Tembakau Lebih Natural & Penghapusan Tombol Animasi Gulungan',
        description:
          'Menghapus tombol "Animasi Gulungan" yang tidak diperlukan serta menyelaraskan warna luar dan dalam Gulungan menggunakan gradasi natural kayu walnut panggang dan daun tembakau maduro matang (tidak lagi putih di luar dan hitam pekat di dalam).',
      },
      {
        type: 'feature',
        title: 'Fitur Edit pada Menu Format (Kemasan, Pabrik & Gulungan)',
        description:
          'Menambahkan tombol Edit (pensil) pada setiap item di dalam modal Format sehingga pengguna kini dapat mengubah data Kemasan, Pabrik / Tujuan, maupun Gulungan yang sudah ada selain menambah dan menghapus.',
      },
    ],
  },
  {
    version: 'v3.9.2',
    date: '8 November 2026',
    codename:
      'Panel Rumus Interaktif (Angka Langsung di Bawah Rumus Utama + Rincian Tersembunyi di Langkah 2), Backup JSON HP & Domain Resmi',
    isLatest: false,
    highlights:
      'Penyempurnaan seluruh Panel Tutorial Rumus (Langkah 1: Rumus Utama + penerapan angka nyata dari Langkah 2 tepat di bawahnya; Langkah 2: Daftar sumber tiap angka dengan tombol "Lihat Rumus" yang tersembunyi dulu hingga ditekan), fitur Backup & Restore Data JSON khusus HP (iPhone/Android), serta integrasi domain resmi tobaccolab.vercel.app.',
    changes: [
      {
        type: 'ui',
        title: 'Penerapan Angka Nyata Tepat di Bawah "1. Rumus Utama" + Sumber Angka di "2. Angka pada Rumus"',
        description:
          'Pada seluruh panel rincian rumus (ƒx), kotak "1. Rumus Utama" kini langsung menampilkan penerapan angka nyata dari Langkah 2 tepat di bawah teks rumus (contoh: Total Kita Bayar = 43 kg × Rp 70.000 = Rp 3.010.000 | Netto Bayar = 50 kg − 7 kg = 43 kg). Di bawahnya, bagian "2. Angka pada Rumus" menampilkan daftar nilai tiap variabel dengan tombol "Lihat Rumus" untuk mengecek dari mana angka tersebut didapat.',
      },
      {
        type: 'feature',
        title: 'Backup & Restore Data JSON Kompatibel Penuh di HP (iPhone Safari / Files & Android)',
        description:
          'Menambahkan modal khusus Backup & Restore Data JSON yang mendukung "Simpan ke Files iPhone / Bagikan File JSON" (Web Share API), Unduh File .json langsung, Salin & Tempel (Copy-Paste) kode teks JSON anti-gagal, serta pemilih file .json yang kompatibel dengan iOS Files.',
      },
      {
        type: 'feature',
        title: 'Domain Resmi tobaccolab.vercel.app & Tautan Bagikan Cepat',
        description:
          'Menetapkan https://tobaccolab.vercel.app/ sebagai tautan resmi di modal Install & Bagikan Aplikasi serta mendukung otorisasi lintas domain untuk Login Cloud dan ekspor Google Sheets.',
      },
      {
        type: 'fix',
        title: 'Perbaikan Cloud Sync iPhone (iOS Safari) & Proteksi Anti-Timpa Data Demo',
        description:
          'Mengunci koneksi database utama dengan Dual-Path Cloud Pull (unduh langsung dari server + real-time listener + tombol ketuk segarkan Cloud) dan memisahkan izin Google Sheets dari Login Cloud utama. Menambahkan pengaman agar data demo tidak pernah menimpa data lama di Cloud saat aplikasi dihapus atau dipasang ulang di Home Screen iPhone.',
      },
      {
        type: 'ui',
        title: 'Penyederhanaan Kolom Nota Setor Pabrik & Status ACCEPTED / REJECTED di Riwayat',
        description:
          'Menghapus kata "PABRIK" dan kolom "STATUS" pada Nota Setor Pabrik serta mengubah "SERI ASAL -> BARU" menjadi "SERI" (menyisakan SERI, HARGA, dan JUMLAH yang bersih untuk pabrik). Pada Nota Arsip Personal, status kini ditampilkan tegas sebagai ACCEPTED atau REJECTED.',
      },
      {
        type: 'ui',
        title: 'Segmen Riwayat di Ujung Paling Kanan & Anti-Tabrakan Panel Atas',
        description:
          'Menempatkan tombol Riwayat pada posisi paling kanan dengan animasi transisi pegas (spring pill), serta memperbaiki tata letak bar atas agar tidak bertumpuk di ukuran layar antara HP dan PC.',
      },
    ],
  },
  {
    version: 'v3.8.0',
    date: '8 November 2026',
    codename:
      'Tobacco Lab Rebrand, Riwayat Nota & Seri, Ganti Seri Reject (AK 1 -> AL 1), Google Sheets & Edit Seri Lock Guard',
    isLatest: false,
    highlights:
      'Rebranding penuh menjadi Tobacco Lab (85% Hitam / 10% Putih / 5% Amber), Segmen Riwayat Nota Gulungan & Status Semua Seri, Integrasi Langsung Google Sheets, Ganti Nomor Seri Barang Reject saat masuk Gulungan/Pabrik baru (mis. AK 1 -> AL 1), Edit Lengkap Seri Jadi + Gembok Pengaman (Lock/Unlock) yang tersinkron dua arah dengan Gulungan, serta Auto-Slide KPI berangka besar.',
    changes: [
      {
        type: 'feature',
        title: 'Segmen Riwayat (Riwayat Nota Gulungan & Data Status Semua Seri)',
        description:
          'Menambahkan segmen Riwayat khusus untuk melihat kembali seluruh Nota Gulungan yang pernah dikirim ke pabrik (lengkap dengan mode Arsip Personal Profit vs Nota Setor Pabrik) serta tabel komprehensif status seluruh Nomor Seri di dalam aplikasi.',
      },
      {
        type: 'feature',
        title: 'Ganti Nomor Seri Barang Reject ke Gulungan & Pabrik Baru (AK 1 -> AL 1)',
        description:
          'Saat barang yang di-reject kembali ke Stok Tembakau Jadi dan dimasukkan ke Gulungan baru (maupun ke Pabrik tujuan baru), kini tersedia opsi untuk mengganti Nomor Serinya (contoh: AK 1 di Cello 1 reject -> diubah menjadi AL 1 untuk Djarum 1) dengan tampilan riwayat seri "AK 1 -> AL 1" di seluruh aplikasi.',
      },
      {
        type: 'feature',
        title: 'Integrasi Langsung Google Sheets (Buat Baru & Update Spreadsheet)',
        description:
          'Dukungan transfer langsung Riwayat Nota Gulungan, Status Semua Seri (beserta jejak AK 1 -> AL 1), dan Stok Bahan Mentah ke akun Google Sheets Anda secara otomatis maupun salin TSV/CSV sekali klik.',
      },
      {
        type: 'feature',
        title: 'Fitur Edit Seri Jadi & Sinkronisasi Otomatis Dua Arah dengan Gulungan',
        description:
          'Setiap Nomor Seri pada Tembakau Jadi dan di dalam Arsip Gulungan kini dapat diedit langsung (Harga Pabrik, Nomor Seri, Grade, Gulungan Terkait, Kemasan, Bruto, Wadah, Tarra, HPP, dan 5 Karakteristik /5). Setiap perubahan pada Seri Jadi otomatis memperbarui daftar seri, tabel nota, dan rata-rata di Gulungan terkait secara real-time.',
      },
      {
        type: 'feature',
        title: 'Tombol Kunci Pengaman (Lock / Unlock) pada Edit Nomor Seri',
        description:
          'Untuk mencegah perubahan data yang tidak disengaja, seluruh kolom pada Edit Seri Jadi dikunci secara otomatis kecuali kolom Harga Pabrik / KG yang siap langsung diedit. Tersedia tombol gembok di tiap kolom maupun tombol "Buka Semua" di bagian atas modal bila ingin mengubah data tetap.',
      },
      {
        type: 'ui',
        title: 'Panel Auto-Slide Nilai Bayar, Nilai Riil & Weight Profit Berangka Besar',
        description:
          'Mengganti 3 kotak kecil yang memakan layar menjadi 1 panel Auto-Slide (bergeser otomatis satu per satu) dengan angka Rupiah dan KG berukuran besar yang sangat jelas dibaca, dilengkapi tab pilih cepat dan tombol fx rincian rumus.',
      },
      {
        type: 'ui',
        title: 'Penghapusan Header Judul Atas & Penyederhanaan Navigasi Segmen',
        description:
          'Menghapus panel judul atas yang berulang di Stok, Simulator, Seri Jadi, Status, Kalkulator, dan Gulungan sehingga menyisakan bar tombol segmen geser yang hemat ruang layar.',
      },
      {
        type: 'ui',
        title: 'Outline & Efek 3D pada Setiap Kartu Bahan & Seri + Angka Karakter (/5) Amber Besar',
        description:
          'Memberikan garis tepi kontras 2px dan bayangan kedalaman 3D pada setiap kartu Bahan di Stok dan Seri Jadi agar tampak terpisah tegas, serta memperbesar ukuran angka 5 Karakteristik Rasa (/5) dengan warna Amber terang.',
      },
      {
        type: 'ui',
        title: 'Rebranding Aplikasi menjadi Tobacco Lab & Tema 85% Hitam / 10% Putih / 5% Amber',
        description:
          'Memperbarui identitas aplikasi menjadi Tobacco Lab serta menyempurnakan komposisi warna menjadi 85% Hitam Pekat, 10% Putih Tajam, dan 5% Aksen Amber pilihan.',
      },
    ],
  },
  {
    version: 'v3.7.0',
    date: '7 November 2026',
    codename: 'Real vs Paid Value & Weight Profit/Loss (Untung/Rugi Timbangan)',
    isLatest: false,
    highlights:
      'Kalkulasi lengkap Nilai Bayar Nota (Paid Value) vs Nilai Barang Riil Sebenarnya (Real Value) di Stok Mentah untuk melacak Weight Profit Beli (sebelum kirim sampel), serta pelacakan Untung/Rugi Timbangan Kemasan saat Setor ke Pabrik di seluruh segmen aplikasi.',
    changes: [
      {
        type: 'feature',
        title: 'Perbandingan Paid Value vs Real Value & Weight Profit Beli di Stok Mentah',
        description:
          'Memisahkan Berat Wadah Riil (mis. Karung Goni 2 kg) dari Potongan Tarra Nota (mis. 10% + 2 kg = 7 kg pada Bruto 50 kg), sehingga menampilkan perbandingan langsung Nilai Bayar (43 kg × Harga) vs Nilai Barang Riil (48 kg × Harga) = +5 kg Weight Profit sebelum barang dikirim ke pabrik.',
      },
      {
        type: 'feature',
        title: 'Kalkulasi Untung / Rugi Timbangan Kemasan Saat Setor ke Pabrik (Seri & Gulungan)',
        description:
          'Menghitung otomatis keuntungan timbangan pabrik (mis. Wadah Riil 3 kg tetapi pabrik hanya memotong Tarra 2 kg = +1 kg × Harga Pabrik) maupun kerugian potongan pabrik (mis. Keranjang Muntilan Wadah Riil 6 kg tetapi dipotong 10% + 2 = 7 kg = -1 kg × Harga Pabrik).',
      },
      {
        type: 'feature',
        title: 'Integrasi Penuh di Kalkulator Racikan, Arsip Gulungan 3D & Simulator Multi-Bahan',
        description:
          'Menampilkan Weight Profit Beli Terkandung dan Selisih Timbangan Pabrik per Nomor Seri di Kalkulator HPP, Arsip Gulungan 3D (Nota Personal), Seri Jadi, Format Kemasan, dan Simulator.',
      },
    ],
  },
  {
    version: 'v3.6.0',
    date: '7 November 2026',
    codename: 'Google Cloud Sync, iPhone Notch Safe Area & AWD Master White-on-Black Logo',
    isLatest: false,
    highlights:
      'Sinkronisasi Cloud Real-Time menggunakan Login Google (Firebase Firestore), penyesuaian ukuran layar penuh iPhone agar tidak terpotong Apple Notch & Home Bar, serta pembaruan logo daun putih berlatar hitam pekat untuk Home Screen iPhone.',
    changes: [
      {
        type: 'feature',
        title: 'Penyimpanan Cloud Otomatis & Login Google (Sinkron Lintas Perangkat)',
        description:
          'Seluruh data Stok Mentah, Nomor Seri Jadi, Arsip Gulungan 3D, Format Kemasan, dan Daftar Pabrik kini otomatis tersimpan di Google Cloud (Firestore) saat Anda login dengan akun Google, sehingga data yang sama dapat diakses dari iPhone, Samsung, maupun PC.',
      },
      {
        type: 'ui',
        title: 'Penyesuaian Rasio Layar iPhone, Apple Notch & Home Indicator Bar',
        description:
          'Menambahkan ruang aman (Safe Area Inset) pada header atas, navigasi bawah, dan gulungan layar penuh agar tampilan aplikasi tidak terpotong oleh poni kamera (Apple Notch / Dynamic Island) maupun garis bar bawah iPhone.',
      },
      {
        type: 'fix',
        title: 'Pembaruan Logo Home Screen iPhone (Daun Putih di Atas Latar Hitam)',
        description:
          'Memperbarui ikon aplikasi (Apple Touch Icon & PWA Manifest) menjadi logo daun putih tajam di atas latar belakang hitam pekat sesuai tema AWD Master dengan URL baru untuk melewati cache ikon lama iOS.',
      },
    ],
  },
  {
    version: 'v3.5.0',
    date: '7 November 2026',
    codename: 'Full-Screen Scroll Animation & Multi-Tobacco Simulator',
    isLatest: false,
    highlights:
      'Animasi membuka gulungan kertas (Old Paper Scroll) layar penuh untuk melihat setiap Nomor Seri dengan leluasa, Simulator Gabungan Multi-Bahan Tembakau sebelum dijual ke pabrik, serta peningkatan kompatibilitas Safari iPhone.',
    changes: [
      {
        type: 'feature',
        title: 'Animasi Gulungan Kertas Klasik & Panel Gulungan Layar Penuh',
        description:
          'Menekan kartu Gulungan di Arsip Gulungan maupun Status Barang kini membuka gulungan kertas berornamen rol atas-bawah dari tengah layar hingga layar penuh (Full Screen), sehingga seluruh Nomor Seri, Nota, dan status Terima/Reject terlihat jauh lebih jelas.',
      },
      {
        type: 'feature',
        title: 'Simulator Racikan Multi-Bahan (Gabungan Beberapa Jenis Tembakau)',
        description:
          'Memperbarui Simulator agar mendukung penggabungan berbagai jenis tembakau (bisa ambil langsung dari Stok Mentah, muat dari Gulungan, atau tambah manual) lengkap dengan kalkulasi HPP gabungan, pembagian ke beberapa keranjang/seri, dan proyeksi Profit Pabrik.',
      },
      {
        type: 'fix',
        title: 'Perbaikan Kompatibilitas Safari iOS & Panduan Link Publik',
        description:
          'Menyesuaikan registrasi Service Worker agar tidak terblokir di Safari iPhone serta menambahkan panduan pembuatan tautan akses langsung dan tombol Bagikan/Salin Tautan di bar atas.',
      },
    ],
  },
  {
    version: 'v3.4.0',
    date: '7 November 2026',
    codename: '5-Character Ticker & Locked Navigator Update',
    isLatest: false,
    highlights:
      'Semua 5 parameter karakter (/5) kini tampil di dalam panel bergerak kartu, ukuran kartu lebih proporsional tanpa teks terpotong, posisi tombol navigator < > dikunci permanen, dan tombol Format lebih ringkas.',
    changes: [
      {
        type: 'feature',
        title: 'Semua 5 Parameter Karakter (/5) di Dalam Panel Bergerak',
        description:
          'Panel statistik berputar otomatis (Spinning Stat Ticker) pada kartu Stok Bahan dan Seri Jadi kini menampilkan kelima parameter karakter sekaligus: Power (Pwr), Impact (Imp), Bitter (Bit), Bakar (Bkr), dan Sugar (Sgr) dalam skala /5.',
      },
      {
        type: 'ui',
        title: 'Kartu Lebih Panjang Secara Vertikal & Nominal Utuh Tanpa Terpotong (...)',
        description:
          'Menambahkan kotak ringkasan 2 baris permanen (Sisa Stok & Modal/KG pada Stok Bahan; Netto Tagih & Harga Pabrik pada Seri Jadi) sehingga seluruh angka Rupiah dan KG tampil utuh di layar HP (2 kartu per baris).',
      },
      {
        type: 'fix',
        title: 'Penghapusan Kode SERI-RAW yang Membingungkan pada Barang Mentah',
        description:
          'Mengganti tampilan kode SERI-RAW-104 pada statistik bahan mentah menjadi rincian nyata: Timbangan Netto/Bruto, Potongan Tarra, Harga Beli, Total Modal Asal, serta Nama Penjual & Daerah Asal.',
      },
      {
        type: 'fix',
        title: 'Posisi Tombol Navigator Kiri (<) & Kanan (>) Dikunci Permanen',
        description:
          'Mengunci lebar penuh bar segmen di seluruh halaman sehingga saat menekan tombol < atau >, posisi tombol navigator tidak lagi bergeser, melompat, atau berubah ukuran.',
      },
      {
        type: 'ui',
        title: 'Perbaikan Tombol + Bahan & Penggantian Nama Tombol menjadi "Format"',
        description:
          'Mengganti tombol "Kemasan & Pabrik" menjadi "Format" yang lebih singkat dan merapikan tata letak bar atas agar tombol "+ Bahan" tampil 100% utuh tanpa terpotong di tepi layar HP.',
      },
      {
        type: 'feature',
        title: 'Fitur Log Pembaruan (Patch Notes) di Dalam Aplikasi',
        description:
          'Menambahkan tombol Patch Notes di bar atas aplikasi untuk melihat riwayat fitur baru, peningkatan UI, dan perbaikan bug setiap kali aplikasi diperbarui secara online.',
      },
    ],
  },
  {
    version: 'v3.3.0',
    date: '6 November 2026',
    codename: '3D Gulungan Tembakau & Grouped QC Workflow',
    highlights:
      'Visualisasi 3D Gulungan Tembakau yang membuka saat ditekan, pengelompokan Status Barang per Gulungan, dan layout 2 kartu per baris di layar HP.',
    changes: [
      {
        type: 'feature',
        title: 'Animasi 3D Gulungan Tembakau (TobaccoRoll3D)',
        description:
          'Setiap kartu Gulungan dilengkapi visual silinder 3D gulungan sampel tembakau lengkap dengan tanggal pembuatan dan nama gulungan yang beranimasi membuka rajangan saat ditekan.',
      },
      {
        type: 'feature',
        title: 'Pengelompokan Status Barang (Terima Cair & Reject) per Gulungan',
        description:
          'Tombol Terima Cair dan Reject disembunyikan di dalam kartu Gulungan hingga Gulungan ditekan. Seri yang diterima maupun direject tetap berada di dalam wadah Gulungannya agar selalu jelas asal gulungannya.',
      },
      {
        type: 'ui',
        title: 'Navigasi Atas Khusus PC & Bottom Bar Khusus HP + Urutan Status Barang di Akhir',
        description:
          'Menyembunyikan bar segmen atas pada tampilan HP untuk menghemat ruang layar dan menempatkan segmen Status Barang di panel paling akhir sesuai alur kerja nyata.',
      },
      {
        type: 'fix',
        title: 'Rincian Multi-Grade Akurat di Komposisi & Evaluasi Gulungan',
        description:
          'Mengganti indikator Grade tunggal pada modal Evaluasi Gulungan menjadi rincian jumlah Nomor Seri per Grade (mis. Grade E, Grade D+, Grade D) beserta Grade masing-masing bahan daun.',
      },
    ],
  },
  {
    version: 'v3.2.0',
    date: '5 November 2026',
    codename: 'Minimalist Requiem UI, Personal Profit Ledger & CSV Sync',
    highlights:
      'Pemisahan Surat Jalan Pabrik vs Arsip Personal (Profit), Sinkronisasi CSV Google Sheets, serta tema hitam-putih-amber bergaya arsitektural.',
    changes: [
      {
        type: 'feature',
        title: 'Dua Mode Nota: Surat Jalan Pabrik vs Arsip Personal (Profit Kita)',
        description:
          'Menyembunyikan tabel nota hingga ditekan, serta memisahkan Surat Jalan Pabrik (tanpa harga modal/profit) dengan Arsip Personal Kita (lengkap dengan Modal/KG, Harga Pabrik/KG, dan Profit Bersih per seri).',
      },
      {
        type: 'feature',
        title: 'Sinkronisasi Data Batch ke CSV & Google Sheets',
        description:
          'Fitur ekspor & salin sekali klik dalam format CSV maupun Tab-Separated (siap tempel langsung ke Google Sheets) lengkap dengan kolom Modal Produksi dan Harga Tagih.',
      },
      {
        type: 'ui',
        title: 'Tema 85% Hitam, 10% Putih, 5% Amber Outline',
        description:
          'Mengubah seluruh permukaan menjadi 85% hitam pekat, 10% tipografi & garis tepi putih tajam, dan 5% aksen amber selektif.',
      },
    ],
  },
  {
    version: 'v3.0.0',
    date: '3 November 2026',
    codename: 'PRO /5 Sensory Standard, Reject Stock Loop & PWA Offline',
    highlights:
      'Standarisasi penilaian /5, alur barang Reject kembali ke Stok Tembakau Jadi dengan kemasan utuh, ongkos kemasan/press otomatis, dan dukungan instalasi iPhone/Samsung/PC.',
    changes: [
      {
        type: 'feature',
        title: 'Skala Penilaian Maksimal /5 (Power, Impact, Bitter, Bakar, Sugar)',
        description:
          'Memudahkan penilaian karakteristik tembakau dengan skala maksimal /5 dan kalkulasi rata-rata tertimbang otomatis saat meracik.',
      },
      {
        type: 'feature',
        title: 'Panel Stok Tembakau Jadi (Eks-Reject) & Masuk ke Gulungan Terbaru',
        description:
          'Nomor Seri yang direject pabrik otomatis kembali ke Stok Tembakau Jadi dengan kemasan & berat tetap utuh, lengkap dengan catatan eks-gulungan sebelumnya dan siap dimasukkan ke Gulungan terbaru.',
      },
      {
        type: 'feature',
        title: 'Format Kemasan (Tarra, Harga Kemasan & Ongkos Press) + Pabrik',
        description:
          'Pendaftaran jenis kemasan otomatis mengisi berat kemasan, potongan Tarra (flat maupun % + kg), ongkos kemasan, ongkos press, dan potongan sampel pabrik (seperti ekstra sampel 2 kg).',
      },
      {
        type: 'feature',
        title: 'Progressive Web App (PWA) untuk iPhone, Samsung & PC',
        description:
          'Dapat di-install ke layar utama iOS, Android, dan Desktop dengan penyimpanan lokal offline serta pembaruan versi online otomatis (Network-First Service Worker).',
      },
    ],
  },
];

interface PatchNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PatchNotesModal: React.FC<PatchNotesModalProps> = ({ isOpen, onClose }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'feature' | 'fix'>('ALL');

  if (!isOpen) return null;

  const getBadgeStyle = (type: PatchNoteItem['type']) => {
    if (type === 'feature') {
      return {
        label: 'FITUR BARU',
        icon: <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />,
        className: 'bg-black text-white border-zinc-700',
      };
    }
    if (type === 'fix') {
      return {
        label: 'PERBAIKAN BUG',
        icon: <Wrench className="w-3 h-3 text-zinc-300 shrink-0" />,
        className: 'bg-black text-zinc-200 border-zinc-800',
      };
    }
    return {
      label: 'PENINGKATAN UI',
      icon: <Layers className="w-3 h-3 text-white shrink-0" />,
      className: 'bg-zinc-900 text-white border-zinc-700',
    };
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 14 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 14 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.95)] text-white overflow-hidden"
        >
          {/* Modal Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-zinc-800 bg-black flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-black border border-zinc-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-lg font-black text-white truncate">
                    Patch Notes & Riwayat Update
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-black text-amber-400 border border-amber-500/70 font-mono font-black text-xs">
                    {CURRENT_APP_VERSION}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-200 border border-zinc-700 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3 text-amber-400" /> Auto-Update Aktif
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                  Daftar fitur baru, penyempurnaan tampilan, dan perbaikan bug yang telah terpasang
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer shrink-0"
              aria-label="Tutup Patch Notes"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Bar & Auto-Update Info Banner */}
          <div className="px-4 sm:px-6 py-3 bg-zinc-950 border-b border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'ALL' as const, label: 'Semua Perubahan' },
                { id: 'feature' as const, label: 'Fitur Baru' },
                { id: 'fix' as const, label: 'Bug Fix & UI' },
              ].map((tab) => {
                const active = filterType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterType(tab.id)}
                    className={`h-8 px-3 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      active
                        ? 'bg-black text-amber-400 border border-amber-500/80'
                        : 'bg-black/60 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Smartphone className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
              <span>Sinkron otomatis di iPhone, Samsung & PC saat online</span>
            </div>
          </div>

          {/* Scrollable Releases List */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
            {PATCH_RELEASES.map((release) => {
              const filteredChanges = release.changes.filter((c) => {
                if (filterType === 'ALL') return true;
                if (filterType === 'feature') return c.type === 'feature';
                return c.type === 'fix' || c.type === 'ui';
              });

              if (filteredChanges.length === 0) return null;

              return (
                <div
                  key={release.version}
                  className={`rounded-2xl border p-4 sm:p-5 space-y-3.5 ${
                    release.isLatest
                      ? 'bg-black border-zinc-700'
                      : 'bg-black/80 border-zinc-800/90'
                  }`}
                >
                  {/* Release Version Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/90">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-black text-white border border-zinc-700 font-mono font-black text-xs sm:text-sm">
                        {release.version}
                      </span>
                      <h3 className="font-extrabold text-white text-sm sm:text-base">
                        {release.codename}
                      </h3>
                      {release.isLatest && (
                        <span className="px-2 py-0.5 rounded bg-black text-amber-400 border border-amber-500/70 text-[10px] font-black uppercase tracking-wider">
                          Versi Saat Ini
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      {release.date}
                    </span>
                  </div>

                  {/* Release Summary */}
                  <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/90 p-3 rounded-xl border border-zinc-800/80">
                    {release.highlights}
                  </p>

                  {/* Detailed Changes List */}
                  <div className="space-y-2.5">
                    {filteredChanges.map((item, idx) => {
                      const badge = getBadgeStyle(item.type);
                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-900 hover:border-zinc-800 transition-colors space-y-1"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black tracking-wider border ${badge.className}`}
                            >
                              {badge.icon}
                              {badge.label}
                            </span>
                            <h4 className="font-bold text-white text-xs sm:text-sm">
                              {item.title}
                            </h4>
                          </div>
                          <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed pl-0.5">
                            {item.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal Footer */}
          <div className="px-4 sm:px-6 py-3.5 border-t border-zinc-800 bg-black flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-zinc-300 shrink-0" />
              <span>Data lokal gudang Anda tetap aman setiap kali versi baru di-update.</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-amber-outline min-h-9 px-4 py-1.5 rounded-xl font-black text-xs cursor-pointer"
            >
              Tutup Patch Notes
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
