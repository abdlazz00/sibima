# Migrasi Untitled UI, Fase 4: Scan QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan halaman Scan QR (`Pages/Scan/Index.tsx`) ke komponen Untitled UI dengan tampilan ramah ponsel, tanpa mengubah logika pemindaian, tanpa menyentuh `QrScanner.tsx`, dan tanpa mengubah props Inertia.

**Architecture:** Satu halaman. `QrScanner.tsx` (logika kamera `getUserMedia` + `jsQR` + bingkai bidik) bukan komponen UI library dan tetap apa adanya. Peta warna badge kondisi yang kini tersalin di tiga halaman (`Assets/Index`, `Assets/Show`, Scan) dipindah ke `lib/assetReport.ts` sebagai `KONDISI_BADGE_COLOR`.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 5 (Scan QR, dikerjakan sebagai modul tersendiri atas permintaan pengguna 2026-10-14). Komponen bersama: `PageHeader` (commit `c1c16e8`). Pola acuan: `docs/superpowers/plans/2026-10-14-migrasi-untitled-ui-fase4-aset.md`.

## Global Constraints

- Hanya komponen Untitled UI gratis. Panduan UI/UX menang untuk identitas; Untitled UI menang untuk semantik, keyboard, fokus.
- **Pemakaian utama di ponsel di lapangan/gudang**: semua tombol `size="lg"` (≥ 44 px) dan selebar layar pada layar sempit; teks tidak terpotong di 375 px.
- Logika tidak berubah: `scanning`/`scanKey`/`error`/`invalid`, `startScan`, `handleDetect` (`qrTokenFromScan`, `router.get(scan.show)`), `ERROR_TEXT`, props `summary`, `canViewDetail`, `notFound`. `QrScanner.tsx` dan `lib/qr.ts` tidak diubah.
- Tidak mencampur komponen Breeze atau `@/Components/Icons`; impor memakai `@/Components/...` berhuruf besar.
- Warna tombol: aksi utama `primary` (Mulai scan, Coba lagi, Lihat detail lengkap); aksi sekunder `secondary` (Scan aset lain bila ada hasil). Badge Kondisi/Status memakai `Badge type="color" size="sm" className="rounded-sm"`.
- Tanpa dependensi baru. Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `Scan`. Kamera tidak bisa diuji tanpa perangkat; ringkasan hasil diuji lewat `/scan/{token}` bila agen diizinkan membuka browser, sisanya oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Izin kamera ditolak / bukan HTTPS / kamera sibuk**: kelima keadaan galat tetap tampil dengan pesan dan tombol "Coba lagi" yang sama. Pagar: `ERROR_TEXT` dan `startScan` tidak diubah (Task 2); butir gerbang di perangkat.
2. **QR bukan label SIBIMA**: pesan "QR ini bukan label aset SIBIMA." tetap muncul sebagai peringatan dan diumumkan ke pembaca layar tanpa menghentikan pemindaian. Pagar: `role="alert"` dipertahankan (Task 2).
3. **Aset tidak ditemukan** (`notFound`) dan **tanpa izin detail** (`canViewDetail` false): tombol "Lihat detail lengkap" tidak boleh muncul tanpa izin. Pagar: kondisi `canViewDetail &&` dipertahankan (Task 2).
4. **Nilai kondisi tak dikenal** tidak boleh membuat halaman crash. Pagar: fallback `?? 'gray'` pada `KONDISI_BADGE_COLOR` (Task 1, 2).
5. **Refactor peta badge di tiga halaman**: `Assets/Index` dan `Assets/Show` harus tampil identik setelah memakai peta bersama. Pagar: `tsc` + test `Asset` (Task 1).
6. **Keadaan awal kosong tanpa penjelasan**: kartu hanya berisi satu tombol. Pagar: teks penjelasan singkat dan ikon kamera (Task 2).
7. **Kamera tak bisa ditutup** selain memindai atau meninggalkan halaman (merepotkan di ponsel). Pagar: tombol "Tutup kamera" yang memakai state `scanning` yang sudah ada (Task 2); `QrScanner` melepas stream saat dilepas dari pohon.
8. **Detail aset berdesakan di 375 px** (label tetap `w-32` + nilai). Pagar: baris menumpuk di layar sempit (Task 2).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/lib/assetReport.ts` | Menambah `KONDISI_BADGE_COLOR` (peta bersama) |
| `resources/js/Pages/Assets/Index.tsx`, `Show.tsx` | Memakai peta bersama (hapus salinan lokal) |
| `resources/js/Pages/Scan/Index.tsx` | Halaman Scan QR |

---

### Task 1: Peta badge kondisi bersama

**Files:**
- Modify: `resources/js/lib/assetReport.ts`, `resources/js/Pages/Assets/Index.tsx`, `resources/js/Pages/Assets/Show.tsx`

**Interfaces:**
- Produces: `KONDISI_BADGE_COLOR: Record<string, 'success' | 'warning' | 'error' | 'gray'>` dari `@/lib/assetReport`.

- [ ] **Step 1: Tambah peta di `lib/assetReport.ts`**

Tepat setelah `KONDISI_LABEL`:
```ts
export const KONDISI_BADGE_COLOR: Record<string, 'success' | 'warning' | 'error' | 'gray'> = {
    baik: 'success',
    rusak_ringan: 'warning',
    rusak_berat: 'error',
    hilang: 'gray',
};
```

- [ ] **Step 2: Pakai di `Assets/Index.tsx` dan `Assets/Show.tsx`**

Pada kedua berkas: hapus konstanta lokal `KONDISI_BADGE` (blok `Record<string, 'success' | …>`), tambah `import { KONDISI_BADGE_COLOR } from '@/lib/assetReport';` (urutan impor mengikuti sekitarnya), dan ganti pemakaian `KONDISI_BADGE[asset.kondisi]` menjadi `KONDISI_BADGE_COLOR[asset.kondisi]`.

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "const KONDISI_BADGE:" resources/js/Pages/Assets
php artisan test --compact --filter='Asset'
git add resources/js/lib/assetReport.ts resources/js/Pages/Assets/Index.tsx resources/js/Pages/Assets/Show.tsx
git commit -m "refactor(ui): share the asset condition badge colors"
```
Expected: bersih; `grep` kosong; test hijau.

---

### Task 2: Halaman Scan QR

**Files:**
- Modify: `resources/js/Pages/Scan/Index.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `Button`, `Badge`, `KONDISI_BADGE_COLOR`/`KONDISI_LABEL` (`@/lib/assetReport`), `QrScanner`/`ScanError` (tidak berubah), ikon `Camera01`, `RefreshCw01`, `AlertCircle`.
- Produces: halaman dengan props Inertia sama.

- [ ] **Step 1: Tulis ulang `Index.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import QrScanner, { ScanError } from '@/Components/QrScanner';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL } from '@/lib/assetReport';
import { qrTokenFromScan } from '@/lib/qr';
import { AssetScanSummary, PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Camera01, RefreshCw01 } from '@untitledui/icons';
import { useState } from 'react';

interface ScanProps extends PageProps {
    summary: AssetScanSummary | null;
    canViewDetail: boolean;
    notFound: boolean;
}

const ERROR_TEXT: Record<ScanError, string> = {
    insecure: 'Kamera hanya bisa dipakai lewat koneksi aman (HTTPS). Buka SIBIMA dengan alamat https:// lalu coba lagi.',
    denied: 'Izin kamera ditolak. Izinkan akses kamera untuk situs ini di pengaturan browser, lalu tekan Coba lagi.',
    'no-camera': 'Kamera tidak ditemukan di perangkat ini.',
    busy: 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu tekan Coba lagi.',
    unknown: 'Kamera tidak dapat dibuka. Tekan Coba lagi atau muat ulang halaman.',
};

export default function Index({ summary, canViewDetail, notFound }: ScanProps) {
    const [scanning, setScanning] = useState(summary === null && !notFound);
    const [scanKey, setScanKey] = useState(0);
    const [error, setError] = useState<ScanError | null>(null);
    const [invalid, setInvalid] = useState(false);

    const startScan = () => {
        setError(null);
        setInvalid(false);
        setScanKey((k) => k + 1);
        setScanning(true);
    };

    const handleDetect = (text: string) => {
        const token = qrTokenFromScan(text);

        if (token === null) {
            setInvalid(true);
            return;
        }

        setInvalid(false);
        setScanning(false);
        router.get(route('scan.show', { token }));
    };

    const rows: [string, string][] = summary
        ? [
              ['Kode Barang', summary.kode_barang],
              ['No. Register', summary.nomor_register],
              ['Merk / Tipe', summary.merk_type ?? '—'],
              ['Kategori', summary.kategori ?? '—'],
              ['Unit', summary.unit ?? '—'],
              ['Pemegang', summary.pemegang ?? '—'],
          ]
        : [];

    return (
        <AuthenticatedLayout>
            <Head title="Scan QR" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Scan QR' }]} title="Scan QR Aset" />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                        {scanning && !error ? (
                            <>
                                <QrScanner key={scanKey} onDetect={handleDetect} onError={setError} />
                                <p className="text-center text-sm text-slate-600">Arahkan kamera ke QR pada label aset.</p>
                                <Button color="secondary" size="lg" className="w-full" onPress={() => setScanning(false)}>
                                    Tutup kamera
                                </Button>
                                {invalid && (
                                    <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                        QR ini bukan label aset SIBIMA.
                                    </p>
                                )}
                            </>
                        ) : error ? (
                            <div role="alert" className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-5">
                                <p className="text-sm text-red-800">{ERROR_TEXT[error]}</p>
                                <Button color="primary" size="lg" iconLeading={RefreshCw01} className="w-full sm:w-auto" onPress={startScan}>
                                    Coba lagi
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                                {!summary && !notFound && (
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                                            <Camera01 className="size-5" aria-hidden="true" />
                                        </div>
                                        <p className="text-sm text-slate-600">
                                            Arahkan kamera ke QR pada label aset untuk melihat ringkasan aset di lapangan.
                                        </p>
                                    </div>
                                )}
                                <Button
                                    color={summary || notFound ? 'secondary' : 'primary'}
                                    size="lg"
                                    iconLeading={Camera01}
                                    className="w-full"
                                    onPress={startScan}
                                >
                                    {summary || notFound ? 'Scan aset lain' : 'Mulai scan'}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div>
                        {notFound && (
                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                                <p className="text-base font-semibold text-slate-900">Aset tidak ditemukan</p>
                                <p className="mt-1 text-sm text-slate-600">
                                    Aset dengan QR ini sudah tidak ada di SIBIMA. Periksa label atau hubungi admin unit.
                                </p>
                            </div>
                        )}

                        {summary && (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                                {summary.foto && <img src={summary.foto} alt={summary.nama_aset} className="h-48 w-full object-cover" />}
                                <div className="space-y-4 p-5">
                                    <div>
                                        <p className="text-lg font-bold text-slate-900">{summary.nama_aset}</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[summary.kondisi] ?? 'gray'} className="rounded-sm">
                                                {KONDISI_LABEL[summary.kondisi] ?? summary.kondisi}
                                            </Badge>
                                            <Badge type="color" size="sm" color={summary.status === 'aktif' ? 'brand' : 'warning'} className="rounded-sm">
                                                {summary.status === 'aktif' ? 'Aktif' : 'Dalam Proses'}
                                            </Badge>
                                        </div>
                                    </div>

                                    <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                                        {rows.map(([label, value], i) => (
                                            <div
                                                key={label}
                                                className={`flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:gap-4 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}
                                            >
                                                <dt className="shrink-0 font-medium text-slate-500 sm:w-32">{label}</dt>
                                                <dd className="wrap-break-word text-slate-900">{value}</dd>
                                            </div>
                                        ))}
                                    </dl>

                                    {canViewDetail && (
                                        <Button color="primary" size="lg" href={route('assets.show', summary.id)} className="w-full">
                                            Lihat detail lengkap
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```
Nama ikon (`Camera01`, `RefreshCw01`) harus ada di `@untitledui/icons`; bila tidak, pakai padanan terdekat dan catat sebagai `Ruling`.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "@/Components/Icons\|ChevronRight" resources/js/Pages/Scan/Index.tsx
php artisan test --compact --filter='Scan'
git add resources/js/Pages/Scan/Index.tsx
git commit -m "feat(ui): migrate the QR scan page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau (bila tidak ada test berfilter `Scan`, jalankan `--filter='QrToken|Scan'`).

- [ ] **Step 3: GERBANG SCAN QR — berhenti**

Laporkan hasil Task 1–2, `Ruling`, dan hal yang tak bisa diverifikasi tanpa perangkat. Minta pengguna memeriksa **di ponsel** (atau desktop dengan kamera, lewat HTTPS atau `localhost`):
- Kamera terbuka: tombol "Tutup kamera" mengembalikan ke kartu awal dan lampu kamera padam.
- Keadaan awal: kartu dengan ikon dan penjelasan; tombol "Mulai scan" besar dan selebar layar; menekannya meminta izin kamera dan menampilkan bingkai bidik.
- Pindai label aset: pindah ke ringkasan; foto, nama, badge Kondisi/Status, daftar detail (menumpuk rapi di 375 px), tombol "Lihat detail lengkap" hanya untuk yang berhak, "Scan aset lain" membuka kamera lagi.
- QR bukan SIBIMA: peringatan kuning muncul dan kamera tetap berjalan.
- Izin kamera ditolak (dan buka lewat HTTP biasa di ponsel): pesan galat sesuai dan tombol "Coba lagi" bekerja.
- QR aset yang sudah dihapus: kartu "Aset tidak ditemukan" dan tombol "Scan aset lain".
- Data Aset (daftar dan detail) tampak sama seperti sebelumnya (peta badge bersama).
- Keyboard dan cincin fokus pada tombol.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.
