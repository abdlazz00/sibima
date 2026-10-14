# SIBIMA

Sistem Informasi Barang Milik Daerah (BMD) Kecamatan Sagulung, Kota Batam. Mengelola aset kecamatan dan enam kelurahan binaan: data aset dan label QR, penerimaan, mutasi, permohonan, lapor rusak/hilang, persetujuan berjenjang, laporan Excel, serta import/ekspor.

**Stack:** Laravel 13, Inertia + React/TypeScript, Tailwind + Preline, Spatie Permission, PhpSpreadsheet, Pest. Produksi: Docker Compose (nginx, PHP-FPM, queue, scheduler, MySQL, certbot).

## Pengembangan lokal

```bash
composer install && npm install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed     # akun demo *@simaset.test, password: password
composer dev                   # server, queue listener, Vite
```

Tes: `php artisan test --compact` (SQLite in-memory; penuh sekitar 12 menit di Windows, gunakan `--filter` untuk sebagian).

## Dokumentasi

| Dokumen | Isi |
|---|---|
| `docs/superpowers/specs/2026-09-24-simaset-design.md` | Desain awal sistem (lihat catatan revisi di bagian atas) |
| `docs/DETAIL_RBAC_SISTEM.md` | Otorisasi: permission, cakupan unit, mesin persetujuan |
| `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md` | Panduan UI/UX |
| `docs/ops/deployment.md` | Deploy produksi, backup, rollback |
| `docs/ops/queue-setup.md` | Queue worker dan scheduler |
| `docs/superpowers/specs`, `docs/superpowers/plans` | Spec dan rencana per fitur |
