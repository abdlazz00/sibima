# Migrasi Untitled UI (Fase 0–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menaikkan Tailwind ke v4, membuang Preline, memasang token dan komponen dasar Untitled UI (gratis), dan memigrasikan halaman Daftar Aset sebagai pilot.

**Architecture:** Fase 0 hanya mengganti toolchain CSS (tampilan harus identik). Fase 1–2 menambah token (`theme.css`) dan komponen yang disalin CLI Untitled UI ke `resources/js/Components/ui/`. Fase 3 memigrasikan `Assets/Index` dan dua komponen bersama (`PrintLabelModal`, `ImportExportButtons`) ke komponen itu. Navigasi komponen diarahkan ke Inertia lewat `RouterProvider` React Aria.

**Tech Stack:** Laravel 13, Inertia 2, React 18, TypeScript, Tailwind 4, Untitled UI React (komponen gratis, React Aria Components), Vite 8, Pest (hanya untuk asap backend).

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md`

## Global Constraints

- Hanya komponen **gratis** Untitled UI; tidak ada `npx untitledui login` dan tidak ada komponen PRO.
- React tetap **18**. Naik ke 19 hanya setelah dilaporkan ke pengguna dan disetujui (Task 4 Step 6 bila diperlukan).
- Tanpa mode gelap, tanpa mengganti Chart.js, tanpa mengganti font Figtree.
- Warna brand: Sapphire `#1E40AF` (= `blue-800`); hover mengikuti Untitled UI (lebih gelap).
- Hanya halaman yang sudah dimigrasi boleh memakai `resources/js/Components/ui/`, dan halaman itu tidak boleh mencampur komponen Breeze lama. Komponen Breeze tidak dibungkus adaptor.
- Panduan UI/UX menang untuk identitas (Sapphire, tabular-nums, badge radius 4px, kartu tanpa bayangan berlebih, tanpa kartu di dalam kartu); Untitled UI menang untuk semantik, aksesibilitas, keyboard, fokus.
- Nama berkas halaman dan props Inertia **tidak berubah** (test backend tidak boleh tersentuh).
- Path impor ke komponen UI memakai huruf besar `@/Components/ui/...`. Docker build berjalan di Linux (case-sensitive); impor `@/components/...` akan gagal di sana walau lolos di Windows.
- Verifikasi frontend: `npx tsc --noEmit` dan `npm run build`. **Agen tidak menguji lewat browser**; pengecekan visual dilakukan pengguna di gerbang yang ditandai.
- Git: commit per task langsung di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit. Tanpa push dan tanpa merge ke `production`.
- Daftar komponen pilot di plan ini menggantikan spec §3.3 setelah review ponytail dan impeccable: ditambah `tooltip` dan `combobox`; `checkbox` (dibawa `table`), `dropdown`, dan `radio-buttons` tidak diambil.
- Kerapatan baris tabel mengikuti bawaan Untitled UI (keputusan pengguna 2026-10-14); jangan menambah `py-*` kustom pada sel tabel.
- Dokumen pribadi `docs/*.xlsx|pdf` tidak boleh ter-commit.

## Review Focus

Masukan atau kondisi yang tersirat dari spec tetapi tidak dijaga test (frontend tidak punya test; pagar di sini berupa perintah verifikasi pada task pemiliknya):

1. **Impor huruf kecil `@/components/...` hasil CLI** lolos di Windows tetapi gagal saat Docker build di Linux. Pagar: grep di Task 4 Step 3/5 dan Task 6 Step 2.
2. **Tombol Ekspor ditangkap `RouterProvider`** sehingga Inertia mencoba menjadikan unduhan Excel sebagai halaman. Pagar: Ekspor memakai `window.location.href`, bukan `href` (Task 5 Step 3).
3. **Pilihan baris lintas halaman**: React Aria memberi `'all'` atau `Set<Key>` hanya untuk baris yang tampil; pilihan di halaman lain tidak boleh hilang saat berpindah halaman atau memilih semua. Pagar: logika `onSelectionChange` di Task 5 Step 2 dan checklist gerbang.
4. **Nilai filter kosong** (`Semua Kategori`/`Semua Unit`/`Semua Kondisi`): kunci kosong `''` tidak valid pada Select React Aria, jadi dipetakan ke `__all` dan kembali menjadi `undefined` di URL. Pagar: Task 5 Step 2.
5. **Perubahan nilai bawaan Tailwind v4** (`rounded`, `shadow`, `ring`, `outline-none`, warna `border` bawaan) menggeser tampilan diam-diam. Pagar: alat upgrade resmi plus grep sisa nama lama di Task 1 Step 4, dan gerbang visual Fase 0.
6. **Bentrok nama utilitas `bg-primary`/`text-primary`**: tema Untitled UI memakai `primary` sebagai warna semantik (putih/abu-abu tua) sehingga `bg-primary` Sapphire kita berubah arti. Pagar: Task 3 Step 1 mengganti 13 pemakaian lama sebelum tema dipasang.
7. **`npm ci` di Docker** gagal bila `package-lock.json` tidak sinkron. Pagar: Task 6 Step 2.
8. **Menekan baris atau tautan di dalam baris ikut memilih baris** (React Aria: `selectionBehavior` toggle). Pagar: `onRowAction` kosong dan pemeriksaan penerusan prop di Task 5 Step 1, serta butir gerbang pilot.
9. **Filter kategori berupa daftar panjang tanpa pencarian** (select native lama punya `optgroup` dan ketik-untuk-lompat). Pagar: `ComboBox` untuk kategori di Task 5 Step 2 dan butir gerbang pilot.
10. **Kehilangan kenyamanan lama**: tooltip ikon, peringatan amber batas 99 label, dan jalan keluar dari hasil kosong. Pagar: `Tooltip`, `overLimit`, `resetFilters` di Task 5 Step 2.

**Catatan jujur tentang plan ini:** dokumentasi Context7 tidak memuat prop untuk `Table`/`Pagination`/`Button`. Kode Task 5 ditulis terhadap API Untitled UI v8 sebisa yang diketahui; Task 5 Step 1 mewajibkan membuka berkas hasil CLI lebih dulu dan menyesuaikan nama prop dalam commit yang sama. `tsc` adalah pagarnya.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/css/app.css` | Titik masuk CSS: `@import "tailwindcss"`, plugin, `@theme` (Sapphire, Figtree), utilitas `no-scrollbar` |
| `resources/css/theme.css` (baru, Task 3) | Token Untitled UI (skala teks, radius, breakpoint, warna semantik, skala `brand`) |
| `vite.config.js` | Menambah `@tailwindcss/vite` |
| `resources/js/app.tsx` | Bootstrap Inertia, `RouterProvider`; tanpa Preline |
| `resources/js/Components/ui/**` (baru, Task 4) | Komponen hasil CLI Untitled UI (base/*, application/*) |
| `resources/js/Pages/Assets/Index.tsx` | Halaman pilot |
| `resources/js/Components/PrintLabelModal.tsx`, `ImportExportButtons.tsx` | Dimigrasi ke komponen `ui/` |
| `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md`, `README.md` | Diperbarui di Task 6 |

Dihapus: `tailwind.config.js`, `postcss.config.js`, `resources/js/types/preline.d.ts`.

---

### Task 1: Tailwind v3 → v4 (tampilan harus identik)

**Files:**
- Modify: `package.json`, `package-lock.json`, `vite.config.js`, `resources/css/app.css`, banyak `resources/js/**/*.tsx` (diubah alat upgrade)
- Delete: `tailwind.config.js`, `postcss.config.js`

**Interfaces:**
- Produces: build Tailwind v4 dengan warna `primary` (`bg-primary`, `text-primary`, `hover:bg-primary-hover`, `bg-primary-dark`) dan font Figtree tetap berfungsi seperti sebelumnya.

- [ ] **Step 1: Pastikan working tree bersih**

Run: `git status --short`
Expected: kosong (working tree bersih).

- [ ] **Step 2: Jalankan alat upgrade resmi**

Run:
```bash
npx @tailwindcss/upgrade
```
Expected: alat memigrasikan `tailwind.config.js` ke CSS, menaikkan `tailwindcss` ke v4, dan mengganti nama utilitas di `resources/**/*.tsx` dan `resources/views/**`. Bila meminta konfirmasi, jawab setuju. Bila gagal karena versi Node (<20), jalankan `node -v` dan laporkan ke pengguna sebelum melanjutkan.

- [ ] **Step 3: Beralih ke plugin Vite dan rapikan konfigurasi**

Edit `vite.config.js` menjadi:
```js
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.tsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
});
```
Hapus `postcss.config.js` dan `tailwind.config.js` bila alat upgrade belum menghapusnya, lalu:
```bash
git rm -f postcss.config.js tailwind.config.js
npm uninstall autoprefixer postcss
```
Pastikan `resources/css/app.css` berisi (urutan ini; sesuaikan hasil alat upgrade, jangan kehilangan blok `no-scrollbar`):
```css
@import 'tailwindcss';

@plugin '@tailwindcss/forms';

@theme {
    --color-primary: #1e40af;
    --color-primary-hover: #1d4ed8;
    --color-primary-dark: #172554;
    --font-sans: 'Figtree', ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
        'Segoe UI Symbol', 'Noto Color Emoji';
}

@utility no-scrollbar {
    &::-webkit-scrollbar {
        display: none;
    }
    -ms-overflow-style: none;
    scrollbar-width: none;
}
```
Hapus baris `preline` dari plugin bila alat upgrade membawanya (Preline dibuang di Task 2).

- [ ] **Step 4: Verifikasi tidak ada nama lama yang tersisa dan build bersih**

Run:
```bash
grep -rnE "outline-none|\bshadow-sm\b" resources/js | head
grep -rn "tailwind.config\|@tailwind base" resources package.json | head
npx tsc --noEmit
npm run build 2>&1 | tail -5
```
Expected:
- `outline-none` dan `shadow-sm` tidak ada lagi (berganti `outline-hidden` dan `shadow-xs`); jika `grep` masih menemukan, ganti secara manual ke padanan v4 (`outline-none` → `outline-hidden`, `shadow-sm` → `shadow-xs`, `shadow` → `shadow-sm`, `rounded` → `rounded-sm`, `ring` → `ring-3`) dengan urutan itu agar nama tidak ditimpa dua kali.
- `tsc` tanpa error; build sukses.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.js resources/css/app.css resources/js resources/views
git add -u postcss.config.js tailwind.config.js
git commit -m "build(ui): upgrade Tailwind CSS to v4 with the Vite plugin"
```

---

### Task 2: Hapus Preline dan gerbang Fase 0

**Files:**
- Modify: `resources/js/app.tsx`, `resources/js/Layouts/AuthenticatedLayout.tsx:34-37`, `package.json`, `package-lock.json`
- Delete: `resources/js/types/preline.d.ts`

**Interfaces:**
- Produces: `app.tsx` tanpa Preline (dasar bagi Task 5); tidak ada referensi `HSStaticMethods` tersisa.

- [ ] **Step 1: Bersihkan `app.tsx`**

Ganti seluruh isi `resources/js/app.tsx` dengan:
```tsx
import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});
```

- [ ] **Step 2: Hapus `autoInit` di layout**

Di `resources/js/Layouts/AuthenticatedLayout.tsx` hapus blok berikut (sekitar baris 34–37):
```tsx
    // Keep Preline auto-init for any child components using Preline classes
    useEffect(() => {
        window.HSStaticMethods?.autoInit();
    });

```
(`useEffect` masih dipakai efek lain di berkas itu, jangan hapus impornya.)

- [ ] **Step 3: Hapus tipe dan paket**

```bash
git rm resources/js/types/preline.d.ts
npm uninstall preline
grep -rn "preline\|HSStaticMethods" resources package.json tailwind.config.js 2>/dev/null
```
Expected: `grep` tidak menemukan apa pun.

- [ ] **Step 4: Verifikasi**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```
Expected: bersih.

- [ ] **Step 5: Test asap backend**

```bash
php artisan test --compact --filter='AssetBrowse|AssetVisibility|AssetManage|DashboardController|PersetujuanController'
```
Expected: semua hijau. Jalankan juga suite penuh di latar belakang: `php artisan test --compact` (sekitar 11 menit).

- [ ] **Step 6: Commit**

```bash
git add resources/js/app.tsx resources/js/Layouts/AuthenticatedLayout.tsx package.json package-lock.json
git add -u resources/js/types/preline.d.ts
git commit -m "chore(ui): remove unused Preline"
```

- [ ] **Step 7: GERBANG FASE 0 — berhenti dan serahkan ke pengguna**

Laporkan hasil Task 1–2 (ukuran CSS sebelum/sesudah, hasil `tsc`, build, test) dan minta pengguna menjalankan `npm run dev` lalu memastikan tampilan **identik** dengan sebelumnya pada: Login, Dashboard, Data Aset, satu form (mis. Penerimaan), satu tabel (mis. Pegawai), dan modal cetak label. **Jangan lanjut ke Task 3 sebelum pengguna menyatakan lolos.** Bila ada pergeseran, perbaiki di task ini (kemungkinan penyebab: nilai bawaan v4 untuk `border`, `ring`, atau `rounded`).

---

### Task 3: Token Untitled UI (Fase 1)

**Files:**
- Modify: `resources/css/app.css`, `resources/js/Components/PasswordInput.tsx`, `resources/js/Layouts/AuthSplitLayout.tsx`, `resources/js/Pages/Auth/ForgotPassword.tsx`, `resources/js/Pages/Auth/Login.tsx`, `resources/js/Pages/Auth/ResetPassword.tsx`, `package.json`, `package-lock.json`
- Create: `resources/css/theme.css`

**Interfaces:**
- Consumes: `app.css` dari Task 1.
- Produces: token semantik Untitled UI (`bg-primary`, `text-secondary`, `bg-brand-solid`, skala `brand-*`), plugin `tailwindcss-animate` dan `tailwindcss-react-aria-components`.

- [ ] **Step 1: Ganti pemakaian warna `primary` lama dengan warna eksplisit**

Tema Untitled UI memakai `bg-primary`/`text-primary` sebagai warna semantik, jadi 13 pemakaian lama harus diganti lebih dulu. Urutan penggantian penting (varian bersufiks dulu):
```bash
FILES="resources/js/Components/PasswordInput.tsx resources/js/Layouts/AuthSplitLayout.tsx resources/js/Pages/Auth/ForgotPassword.tsx resources/js/Pages/Auth/Login.tsx resources/js/Pages/Auth/ResetPassword.tsx"
sed -i -E 's/(bg|text|ring|selection:bg)-primary-hover\b/\1-blue-700/g; s/(bg|text|ring|selection:bg)-primary-dark\b/\1-blue-950/g; s/(bg|text|ring|selection:bg)-primary\b/\1-blue-800/g' $FILES
grep -rnE "(bg|text|border|ring|from|to|via|fill|stroke)-primary(-[a-z]+)?\b" resources/js | grep -v "^resources/js/types"
```
Expected: `grep` terakhir tidak menemukan apa pun. Lalu hapus tiga baris `--color-primary*` dari blok `@theme` di `resources/css/app.css` (token itu tidak dipakai lagi dan akan bentrok dengan token semantik).

- [ ] **Step 2: Pasang dependensi token**

```bash
npm install tailwindcss-animate tailwindcss-react-aria-components @untitledui/icons react-aria-components
```
Expected: sukses tanpa konflik peer React 18. Bila `npm` melaporkan peer dependency React 19 yang tidak terpenuhi, **berhenti** dan laporkan ke pengguna (lihat Task 4 Step 6).

- [ ] **Step 3: Unduh `theme.css` resmi dan sesuaikan brand serta font**

Berkas tema resmi ada di repo starter kit Untitled UI (satu blok `@theme` + blok `.dark-mode`; tidak mereset palet bawaan Tailwind, jadi `slate-*`, `blue-*`, `emerald-*` dan seterusnya tetap berlaku):
```bash
curl -fsSL https://raw.githubusercontent.com/untitleduico/untitledui-vite-starter-kit/main/src/styles/theme.css -o resources/css/theme.css
wc -l resources/css/theme.css
grep -n "color-brand-600\|--font-body\|--font-display" resources/css/theme.css
```
Expected: sekitar 834 baris; `color-brand-600` bernilai ungu `rgb(127 86 217)`.

Ganti font ke Figtree:
```bash
sed -i -E 's#^(\s*--font-(body|display):).*#\1 "Figtree", ui-sans-serif, system-ui, sans-serif;#' resources/css/theme.css
```
Ganti skala `brand` (11 baris `--color-brand-50` … `--color-brand-950`) dengan skala Sapphire. `brand-600` = `#1E40AF` (blue-800) menjadi warna tombol utama; `brand-500` = `#1D4ED8` (hover lama); sisi gelap melanjutkan palet blue:
```css
    --color-brand-50: rgb(239 246 255);
    --color-brand-100: rgb(219 234 254);
    --color-brand-200: rgb(191 219 254);
    --color-brand-300: rgb(147 197 253);
    --color-brand-400: rgb(96 165 250);
    --color-brand-500: rgb(29 78 216);
    --color-brand-600: rgb(30 64 175);
    --color-brand-700: rgb(30 58 138);
    --color-brand-800: rgb(23 37 84);
    --color-brand-900: rgb(15 23 62);
    --color-brand-950: rgb(10 15 44);
```
Pakai alat Edit untuk mengganti blok itu, lalu:
```bash
grep -n "color-brand-600" resources/css/theme.css
```
Expected: `rgb(30 64 175)`. Bila ada baris `--color-brand-25`, biarkan.

- [ ] **Step 4: Impor tema di `app.css`**

Ubah `resources/css/app.css` menjadi (varian kustom diambil dari `globals.css` starter kit; varian `dark` terikat ke class `.dark-mode` yang tidak pernah dipasang, sehingga mode gelap tidak aktif walau OS pengguna gelap):
```css
@import 'tailwindcss';
@import './theme.css';

@plugin '@tailwindcss/forms';
@plugin 'tailwindcss-animate';
@plugin 'tailwindcss-react-aria-components';

@custom-variant dark (&:where(.dark-mode, .dark-mode *));
@custom-variant label (& [data-label]);
@custom-variant focus-input-within (&:has(input:focus));

@theme {
    --font-sans: 'Figtree', ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
        'Segoe UI Symbol', 'Noto Color Emoji';
}

@utility no-scrollbar {
    &::-webkit-scrollbar {
        display: none;
    }
    -ms-overflow-style: none;
    scrollbar-width: none;
}
```

- [ ] **Step 5: Verifikasi**

Tema menimpa skala `--text-*`, `--radius-*`, `--shadow-*`, dan `--breakpoint-xs`; selisihnya dinilai pengguna di gerbang pilot.
```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```
Expected: bersih.

- [ ] **Step 6: Commit**

```bash
git add resources/css/app.css resources/css/theme.css package.json package-lock.json resources/js/Components/PasswordInput.tsx resources/js/Layouts/AuthSplitLayout.tsx resources/js/Pages/Auth/ForgotPassword.tsx resources/js/Pages/Auth/Login.tsx resources/js/Pages/Auth/ResetPassword.tsx
git commit -m "feat(ui): add Untitled UI theme tokens and map Sapphire to the brand scale"
```

---

### Task 4: Komponen dasar lewat CLI (Fase 2)

**Files:**
- Create: `resources/js/Components/ui/**` (hasil CLI)
- Modify: `package.json`, `package-lock.json`, `resources/js/app.tsx`

**Interfaces:**
- Produces: `RouterProvider` yang meneruskan navigasi ke Inertia (Step 7) dan modul yang diimpor Task 5:
  - `@/Components/ui/base/buttons/button` → `Button`
  - `@/Components/ui/base/input/input` → `Input`
  - `@/Components/ui/base/select/select` → `Select` (dengan `Select.Item`)
  - `@/Components/ui/base/badges/badges` → `Badge`
  - `@/Components/ui/base/select/combobox` → `ComboBox` (dengan `ComboBox.Item`)
  - `@/Components/ui/base/tooltip/tooltip` → `Tooltip`
  - `@/Components/ui/application/table/table` → `Table`
  - `@/Components/ui/application/pagination/pagination` → `PaginationPageDefault`
  - `@/Components/ui/application/modals/modal` → `ModalOverlay`, `Modal`, `Dialog`

- [ ] **Step 1: Pelajari CLI tanpa mengubah apa pun**

```bash
npx untitledui@latest --help
npx untitledui@latest add --help
```
Catat: apakah CLI meminta berkas konfigurasi (mis. `untitledui.json`/`components.json`), bagaimana mengatur direktori tujuan, dan apakah ia mengubah `package.json`. Jangan jalankan `init` (itu untuk proyek baru).

- [ ] **Step 2: Tambah komponen**

Jalankan dari akar repo, jawab prompt agar direktori komponen = `resources/js/Components/ui` dan alias `@/Components/ui`:
```bash
npx untitledui@latest add button input select tooltip badges table pagination modal
```
Setelah selesai pastikan `resources/js/Components/ui/base/select/combobox.tsx` ada (biasanya ikut paket `select`); bila tidak, jalankan `npx untitledui@latest add combobox`.

Bila CLI tidak bisa diarahkan ke `resources/js/Components/ui` (struktur `src/components` dipaksa), pakai jalur cadangan: jalankan CLI di direktori sementara **di luar repo** (mis. di scratchpad sesi), lalu salin hasilnya ke `resources/js/Components/ui/` dengan struktur yang sama (`base/...`, `application/...`) (`theme.css` sudah ada dari Task 3; jangan ditimpa).

- [ ] **Step 3: Perbaiki path impor dan huruf besar-kecil**

Di semua berkas dalam `resources/js/Components/ui/`, ganti alias bawaan CLI ke alias proyek:
```bash
grep -rhoE "from ['\"]@/[^'\"]+['\"]" resources/js/Components/ui | sed -E "s/from ['\"]//; s/['\"]$//" | cut -d/ -f1-2 | sort | uniq -c
```
Lalu, untuk setiap awalan yang salah (mis. `@/components/` huruf kecil, `@/utils/cx`, `@/hooks/...`), ganti ke lokasi yang benar di proyek ini (`@/Components/ui/`, dan taruh `utils`/`hooks` pendukung di `resources/js/Components/ui/_utils/` atau `resources/js/lib/` mengikuti struktur yang ada) dengan `sed -i`, lalu:
```bash
grep -rn "@/components/" resources/js | head
```
Expected: tidak ada hasil (hanya `@/Components/` berhuruf besar).

- [ ] **Step 4: Tinjau diff sebelum commit**

```bash
git status --short resources package.json
git diff --stat
```
Pastikan hanya berkas di `Components/ui/`, `theme.css`, `package*.json` yang berubah. Berkas lain yang diubah CLI harus dikembalikan (`git checkout -- <path>`) atau dijelaskan.

- [ ] **Step 5: Verifikasi**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```
Expected: bersih. Kesalahan tipe di berkas hasil CLI yang disebabkan React 18 (mis. `ref` sebagai prop, `use`, `useActionState`) berarti jalur Step 6 berlaku; selain itu perbaiki seperlunya dan catat.

- [ ] **Step 6: Keputusan React 18/19**

Bila Step 5 bersih di React 18: lanjut. Bila ada error tipe atau runtime yang jelas disebabkan React 18, **berhenti dan laporkan ke pengguna** dengan daftar error, lalu tunggu persetujuan sebelum menaikkan React. Setelah disetujui:
```bash
npm install react@19 react-dom@19
npm install -D @types/react@19 @types/react-dom@19
```
lalu ulangi Step 5 dan periksa `@inertiajs/react`, `@headlessui/react`, `react-chartjs-2` tanpa peringatan peer.

- [ ] **Step 7: Pasang `RouterProvider` (navigasi komponen lewat Inertia)**

Ubah `resources/js/app.tsx` (versi tanpa Preline dari Task 2) menjadi:
```tsx
import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-aria-components';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <RouterProvider navigate={(to) => router.visit(to as string)}>
                <App {...props} />
            </RouterProvider>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});
```
Lalu:
```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```
Expected: bersih. Setiap `href` pada komponen `ui/` kini bernavigasi lewat `router.visit` Inertia (tanpa reload penuh).

- [ ] **Step 8: Commit**

```bash
git add resources/js/Components/ui resources/js/app.tsx package.json package-lock.json
git commit -m "feat(ui): add Untitled UI base components and route their links through Inertia"
```

---

### Task 5: Pilot Daftar Aset (Fase 3)

**Files:**
- Modify: `resources/js/Pages/Assets/Index.tsx`, `resources/js/Components/PrintLabelModal.tsx`, `resources/js/Components/ImportExportButtons.tsx`

**Interfaces:**
- Consumes: komponen `ui/` dari Task 4 dan `RouterProvider` dari Task 4 Step 7; `pageNumbersWithGaps` TIDAK lagi dipakai halaman ini (berkas `lib/pagination.ts` tetap).
- Produces: `ImportExportButtons` (props tidak berubah: `{ modul: 'aset' | 'pegawai' | 'kategori'; query?: object }`) dan `PrintLabelModal` (props tidak berubah: `{ assetIds: number[]; onClose: () => void }`).

Keputusan dari review impeccable (semua wajib): (1) tekan baris tidak boleh memilih baris; (2) filter kategori bisa dicari dengan mengetik; (3) tombol ikon punya tooltip; (4) peringatan batas 99 label tetap terlihat di tombol; (5) ada "Hapus semua filter" dan jalan keluar dari hasil kosong. Kerapatan baris tabel mengikuti **bawaan Untitled UI** (keputusan pengguna 2026-10-14); jangan menambah `py-*` kustom pada sel.

- [ ] **Step 1: Cocokkan API yang dipakai dengan berkas hasil CLI**

```bash
sed -n 1,80p resources/js/Components/ui/base/buttons/button.tsx
grep -n "export" resources/js/Components/ui/base/select/select.tsx resources/js/Components/ui/base/select/combobox.tsx resources/js/Components/ui/base/tooltip/tooltip.tsx resources/js/Components/ui/application/table/table.tsx resources/js/Components/ui/application/pagination/pagination.tsx resources/js/Components/ui/base/badges/badges.tsx resources/js/Components/ui/application/modals/modal.tsx
grep -n "selectionBehavior\|onRowAction\|\.\.\.props\|AriaTable" resources/js/Components/ui/application/table/table.tsx
```
Konfirmasi nama berikut ada dan catat bila berbeda; sesuaikan kode di Step 2–4 dalam commit yang sama: `Button` (`color`: primary/secondary/tertiary, `size`: sm/md, `iconLeading`, `href`, `onPress`, `isDisabled`, `className`), `Input` (`icon`, `value`, `onChange(value: string)`, `placeholder`, `aria-label`), `Select` dan `ComboBox` (`items`, `selectedKey`, `onSelectionChange`, `.Item`), `Tooltip` (`title`, anak = pemicu), `Table` (`Table.Header`, `Table.Head`, `Table.Body`, `Table.Row`, `Table.Cell`, `selectionMode`, `selectedKeys`, `onSelectionChange`, `selectionBehavior`, `onRowAction`), `PaginationPageDefault` (`page`, `total`, `onPageChange`), `Badge` (`color`, `size`), `ModalOverlay`/`Modal`/`Dialog`.

Pagar isu 1: bila `table.tsx` tidak meneruskan `selectionBehavior`/`onRowAction` ke tabel React Aria, tambahkan penerusan itu di berkas tersebut (satu baris `{...props}` atau dua prop eksplisit) dalam commit ini. Tanpa `onRowAction`, menekan tautan atau tombol di dalam baris dapat ikut memilih baris.

- [ ] **Step 2: Tulis ulang `Assets/Index.tsx`**

Ganti seluruh isi `resources/js/Pages/Assets/Index.tsx` dengan:
```tsx
import { PaginationPageDefault } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { ComboBox } from '@/Components/ui/base/select/combobox';
import { Select } from '@/Components/ui/base/select/select';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import ImportExportButtons from '@/Components/ImportExportButtons';
import PrintLabelModal from '@/Components/PrintLabelModal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Asset, AssetCategory, Paginated, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Edit01, Eye, Plus, Printer, SearchLg, XClose } from '@untitledui/icons';
import { FormEvent, useEffect, useState } from 'react';
import type { Selection } from 'react-aria-components';

interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

interface Option {
    value: string;
    label: string;
}

interface Filters {
    search?: string;
    category_id?: string;
    unit_id?: string;
    kondisi?: string;
    urut?: string;
}

interface IndexProps extends PageProps {
    assets: Paginated<Asset>;
    filters: Filters;
    categories: AssetCategory[];
    units: UnitOption[];
    kondisiOptions: Option[];
    sortOptions: Option[];
    can: {
        create: boolean;
        printLabel?: boolean;
        update?: boolean;
    };
}

const ALL = '__all';
const DEFAULT_SORT = 'nama_asc';
const MAX_LABELS = 99;

const KONDISI_BADGE: Record<string, 'success' | 'warning' | 'error' | 'gray'> = {
    baik: 'success',
    rusak_ringan: 'warning',
    rusak_berat: 'error',
    hilang: 'gray',
};

function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(Number(value));
}

function registerLabel(nomor: number): string {
    return String(nomor).padStart(4, '0');
}

export default function Index({ assets, filters, categories, units, kondisiOptions, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [printIds, setPrintIds] = useState<number[] | null>(null);

    const pageIds = assets.data.map((a) => a.id);
    const selectedOnPage = new Set<number>(selectedIds.filter((id) => pageIds.includes(id)));
    const overLimit = selectedIds.length > MAX_LABELS;

    const onSelectionChange = (keys: Selection) => {
        const onPage = keys === 'all' ? pageIds : pageIds.filter((id) => keys.has(id));
        setSelectedIds((prev) => [...prev.filter((id) => !pageIds.includes(id)), ...onPage]);
    };

    const applyFilters = (next: Partial<Filters>) => {
        router.get(
            route('assets.index'),
            { ...filters, ...next },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    useEffect(() => {
        const handle = setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                applyFilters({ search: search || undefined });
            }
        }, 400);

        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        applyFilters({ search: search || undefined });
    };

    const hasActiveFilter = Boolean(filters.search || filters.category_id || filters.unit_id || filters.kondisi);

    const resetFilters = () => {
        setSearch('');
        router.get(route('assets.index'), { urut: filters.urut }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const categoryItems = [
        { id: ALL, label: 'Semua Kategori' },
        ...categories.flatMap((kategori) =>
            (kategori.children ?? []).map((sub) => ({ id: String(sub.id), label: `${kategori.name} › ${sub.name}` })),
        ),
    ];
    const unitItems = [{ id: ALL, label: 'Semua Unit' }, ...units.map((u) => ({ id: String(u.id), label: u.name }))];
    const kondisiItems = [
        { id: ALL, label: 'Semua Kondisi' },
        ...kondisiOptions.map((o) => ({ id: o.value, label: o.label })),
    ];
    const sortItems = sortOptions.map((o) => ({ id: o.value, label: `Urutkan: ${o.label}` }));

    const goToPage = (page: number) =>
        router.get(route('assets.index'), { ...filters, page }, { preserveState: true, preserveScroll: true });

    return (
        <AuthenticatedLayout>
            <Head title="Data Aset" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">
                                Home
                            </Link>
                            <span aria-hidden="true">/</span>
                            <span className="font-medium text-slate-800">Data Aset</span>
                        </nav>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                            Daftar Barang Milik Daerah
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {selectedIds.length > 0 && Boolean(can.printLabel) && (
                            <Button
                                color="secondary"
                                size="md"
                                iconLeading={Printer}
                                className={overLimit ? 'bg-amber-50 text-amber-800 ring-amber-300 hover:bg-amber-100' : undefined}
                                onPress={() => setPrintIds(selectedIds)}
                            >
                                Cetak Label ({selectedIds.length}){overLimit && ` · Maks ${MAX_LABELS}`}
                            </Button>
                        )}
                        <ImportExportButtons modul="aset" query={filters} />
                        {can.create && (
                            <Button color="primary" size="md" iconLeading={Plus} href={route('assets.create')}>
                                Tambah Aset Baru
                            </Button>
                        )}
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <ComboBox
                            aria-label="Kategori"
                            size="md"
                            placeholder="Cari kategori..."
                            items={categoryItems}
                            selectedKey={filters.category_id ?? ALL}
                            onSelectionChange={(key) =>
                                applyFilters({ category_id: key == null || key === ALL ? undefined : String(key) })
                            }
                        >
                            {(item) => <ComboBox.Item id={item.id} label={item.label} />}
                        </ComboBox>
                        <Select
                            aria-label="Unit"
                            size="md"
                            items={unitItems}
                            selectedKey={filters.unit_id ?? ALL}
                            onSelectionChange={(key) => applyFilters({ unit_id: key === ALL ? undefined : String(key) })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            aria-label="Kondisi"
                            size="md"
                            items={kondisiItems}
                            selectedKey={filters.kondisi ?? ALL}
                            onSelectionChange={(key) => applyFilters({ kondisi: key === ALL ? undefined : String(key) })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            aria-label="Urutkan"
                            size="md"
                            items={sortItems}
                            selectedKey={filters.urut ?? DEFAULT_SORT}
                            onSelectionChange={(key) =>
                                applyFilters({ urut: key === DEFAULT_SORT ? undefined : String(key) })
                            }
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                    </div>
                    {hasActiveFilter && (
                        <div className="mt-3 flex justify-end">
                            <Button color="tertiary" size="sm" iconLeading={XClose} onPress={resetFilters}>
                                Hapus semua filter
                            </Button>
                        </div>
                    )}
                </div>

                {/* Data Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="border-b border-slate-200 p-4">
                        <form onSubmit={submitSearch} className="flex max-w-md items-center gap-2">
                            <div className="flex-1">
                                <Input
                                    aria-label="Cari aset"
                                    size="md"
                                    icon={SearchLg}
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="Cari nama barang, kode BMD, atau dokumen..."
                                />
                            </div>
                            {search && (
                                <Button
                                    color="tertiary"
                                    size="md"
                                    iconLeading={XClose}
                                    aria-label="Hapus pencarian"
                                    onPress={() => {
                                        setSearch('');
                                        applyFilters({ search: undefined });
                                    }}
                                />
                            )}
                        </form>
                    </div>

                    {/* onRowAction kosong: menekan baris atau tautan di dalamnya tidak memilih baris; seleksi hanya lewat checkbox. */}
                    <Table
                        aria-label="Daftar aset"
                        selectionMode="multiple"
                        selectionBehavior="toggle"
                        onRowAction={() => {}}
                        selectedKeys={selectedOnPage}
                        onSelectionChange={onSelectionChange}
                    >
                        <Table.Header>
                            <Table.Head id="foto" label="Foto" />
                            <Table.Head id="identitas" label="Identitas Barang" isRowHeader />
                            <Table.Head id="kode" label="Kode Register BMD" />
                            <Table.Head id="unit" label="Unit Pemilik" />
                            <Table.Head id="pemegang" label="Pemegang" />
                            <Table.Head id="kondisi" label="Kondisi" />
                            <Table.Head id="nilai" label="Nilai Perolehan" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={assets.data}
                            renderEmptyState={() => (
                                <div className="flex flex-col items-center gap-3 py-14 text-center">
                                    <p className="text-sm text-slate-500">
                                        Tidak ada aset yang cocok dengan pencarian/filter ini.
                                    </p>
                                    {hasActiveFilter && (
                                        <Button color="secondary" size="sm" onPress={resetFilters}>
                                            Hapus semua filter
                                        </Button>
                                    )}
                                </div>
                            )}
                        >
                            {(asset) => (
                                <Table.Row id={asset.id}>
                                    <Table.Cell>
                                        <div className="h-12 w-12 overflow-hidden rounded bg-slate-100">
                                            {asset.photos?.[0] && (
                                                <img src={asset.photos[0].url} alt="" className="h-full w-full object-cover" />
                                            )}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Link
                                            href={route('assets.show', asset.id)}
                                            className="block max-w-[260px] truncate text-sm font-semibold text-slate-900 hover:text-blue-700"
                                        >
                                            {asset.nama_aset}
                                        </Link>
                                        <p className="max-w-[260px] truncate text-xs text-slate-500">{asset.merk_type ?? '—'}</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p className="whitespace-nowrap font-mono text-[13px] text-slate-800">{asset.kode_barang}</p>
                                        <p className="text-[11px] text-slate-400">Reg. {registerLabel(asset.nomor_register)}</p>
                                    </Table.Cell>
                                    <Table.Cell>{asset.unit?.name}</Table.Cell>
                                    <Table.Cell>{asset.current_holder?.nama ?? '—'}</Table.Cell>
                                    <Table.Cell>
                                        <Badge color={KONDISI_BADGE[asset.kondisi] ?? 'gray'} size="sm" className="rounded-sm">
                                            {kondisiOptions.find((o) => o.value === asset.kondisi)?.label ?? asset.kondisi}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                                        {formatRupiah(asset.nilai_perolehan)}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Tooltip title="Lihat detail">
                                                <Button
                                                    color="secondary"
                                                    size="sm"
                                                    iconLeading={Eye}
                                                    aria-label="Lihat detail"
                                                    href={route('assets.show', asset.id)}
                                                />
                                            </Tooltip>
                                            {can.update && (
                                                <Tooltip title="Ubah aset">
                                                    <Button
                                                        color="secondary"
                                                        size="sm"
                                                        iconLeading={Edit01}
                                                        aria-label="Ubah aset"
                                                        href={route('assets.edit', asset.id)}
                                                    />
                                                </Tooltip>
                                            )}
                                            {can.printLabel && (
                                                <Tooltip title="Cetak label QR">
                                                    <Button
                                                        color="secondary"
                                                        size="sm"
                                                        iconLeading={Printer}
                                                        aria-label="Cetak label QR"
                                                        onPress={() => setPrintIds([asset.id])}
                                                    />
                                                </Tooltip>
                                            )}
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>

                    {/* Pagination */}
                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
                        <p className="text-xs text-slate-500">
                            Menampilkan{' '}
                            <span className="font-semibold tabular-nums text-slate-800">
                                {assets.from ?? 0}-{assets.to ?? 0}
                            </span>{' '}
                            dari <span className="font-semibold tabular-nums text-slate-800">{assets.total}</span> aset
                        </p>

                        {assets.last_page > 1 && (
                            <PaginationPageDefault page={assets.current_page} total={assets.last_page} onPageChange={goToPage} />
                        )}
                    </div>
                </div>
            </div>

            {printIds && <PrintLabelModal assetIds={printIds} onClose={() => setPrintIds(null)} />}
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 3: Tulis ulang `ImportExportButtons.tsx`**

Ganti seluruh isi `resources/js/Components/ImportExportButtons.tsx` dengan (Ekspor memakai `window.location.href` agar unduhan Excel tidak ditangkap `RouterProvider`):
```tsx
import { Button } from '@/Components/ui/base/buttons/button';
import { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';

type Modul = 'aset' | 'pegawai' | 'kategori';

export default function ImportExportButtons({ modul, query = {} }: { modul: Modul; query?: object }) {
    const permissions = usePage<PageProps>().props.auth.user?.permissions ?? [];
    const canImport = permissions.includes(`import-${modul}`);
    const canExport = permissions.includes(`export-${modul}`);

    if (!canImport && !canExport) return null;

    const params = Object.fromEntries(
        Object.entries(query as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );

    return (
        <>
            {canImport && (
                <Button color="secondary" size="md" href={route('import.show', modul)}>
                    Impor
                </Button>
            )}
            {canExport && (
                <Button
                    color="secondary"
                    size="md"
                    onPress={() => {
                        window.location.href = route('export', { modul, ...params });
                    }}
                >
                    Ekspor
                </Button>
            )}
        </>
    );
}
```

- [ ] **Step 4: Tulis ulang `PrintLabelModal.tsx`**

Ganti seluruh isi `resources/js/Components/PrintLabelModal.tsx` dengan. Esc dan klik di luar ditangani React Aria, jadi `useEffect` keydown dihapus; radio native dipertahankan (sudah aksesibel, tidak perlu komponen tambahan):
```tsx
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { Printer } from '@untitledui/icons';
import { useState } from 'react';

type LabelSize = 'kecil' | 'besar';

interface PrintLabelModalProps {
    assetIds: number[];
    onClose: () => void;
}

const SIZE_OPTIONS: { value: LabelSize; label: string; description: string }[] = [
    { value: 'kecil', label: 'Kecil', description: '83 x 25 mm — cocok untuk aset ukuran kecil/sedang (2 label/baris)' },
    { value: 'besar', label: 'Besar', description: '94 x 38 mm — area teks lebih leluasa untuk inventaris besar (2 label/baris)' },
];

export default function PrintLabelModal({ assetIds, onClose }: PrintLabelModalProps) {
    const [size, setSize] = useState<LabelSize>('kecil');
    const [popupBlocked, setPopupBlocked] = useState(false);
    const [printUrl, setPrintUrl] = useState<string | null>(null);

    const isExceeded = assetIds.length > 99;
    const isZero = assetIds.length === 0;

    const print = () => {
        if (isExceeded || isZero) return;
        const targetUrl = route('assets.labels', { ids: assetIds, size });
        const win = window.open(targetUrl, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            setPopupBlocked(true);
            setPrintUrl(targetUrl);
        } else {
            onClose();
        }
    };

    return (
        <ModalOverlay
            isOpen
            isDismissable
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-md">
                <Dialog aria-labelledby="print-modal-title">
                    <div className="w-full p-6">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                <Printer className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 id="print-modal-title" className="text-base font-bold text-slate-900">
                                    Cetak Label Aset BMD
                                </h3>
                                <p className="text-xs text-slate-600">
                                    {assetIds.length} aset dipilih. Pilih format ukuran label.
                                </p>
                            </div>
                        </div>

                        {isExceeded && (
                            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                <p className="font-semibold">Batas Cetak Terlampaui</p>
                                <p className="mt-0.5">
                                    Maksimal 99 label per cetak untuk menjaga performa. Saat ini Anda memilih {assetIds.length} aset. Harap kurangi jumlah pilihan.
                                </p>
                            </div>
                        )}

                        <fieldset className="mb-6 space-y-2">
                            <legend className="sr-only">Pilihan Ukuran Label</legend>
                            {SIZE_OPTIONS.map((option) => (
                                <label
                                    key={option.value}
                                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-1 ${
                                        size === option.value
                                            ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                                            : 'border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="label-size"
                                        value={option.value}
                                        checked={size === option.value}
                                        onChange={() => setSize(option.value)}
                                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>
                                        <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                                        <span className="block text-xs text-slate-600">{option.description}</span>
                                    </span>
                                </label>
                            ))}
                        </fieldset>

                        {popupBlocked && printUrl && (
                            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                                <p className="font-semibold">Popup Diblokir Browser</p>
                                <p className="mt-0.5">Browser Anda memblokir jendela baru. Klik tombol di bawah untuk membuka:</p>
                                <a
                                    href={printUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1.5 inline-block font-bold text-blue-700 underline hover:text-blue-900"
                                    onClick={onClose}
                                >
                                    Buka Label PDF &rarr;
                                </a>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3">
                            <Button color="secondary" size="md" onPress={onClose}>
                                Batal
                            </Button>
                            <Button
                                color="primary"
                                size="md"
                                iconLeading={Printer}
                                isDisabled={isExceeded || isZero}
                                onPress={print}
                            >
                                Cetak Label
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
```
Bila Step 1 menunjukkan `Dialog` menerima fungsi anak (`{(close) => ...}`) atau `Modal` sudah memberi padding/permukaan, sesuaikan pembungkus `div className="w-full p-6"` agar tidak ganda.

- [ ] **Step 5: Verifikasi dan pagar Linux**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "@/components/" resources/js | head
grep -rnE "Components/(PrimaryButton|SecondaryButton|TextInput|Checkbox|Modal|Dropdown)\b" resources/js/Pages/Assets/Index.tsx resources/js/Components/ImportExportButtons.tsx resources/js/Components/PrintLabelModal.tsx
```
Expected: `tsc` dan build bersih; dua `grep` terakhir tidak menemukan apa pun (tidak ada alias huruf kecil dan tidak ada komponen Breeze di berkas yang dimigrasi). Perbaiki error `tsc` dengan menyesuaikan nama prop sesuai Step 1.

- [ ] **Step 6: Test asap backend untuk halaman terkait**

```bash
php artisan test --compact --filter='AssetBrowse|AssetVisibility|AssetSort|AssetLabel|ExportTest|ImportControllerTest'
```
Expected: hijau (perubahan hanya frontend, tetapi kontrak props Inertia diuji di sini).

- [ ] **Step 7: Commit**

```bash
git add resources/js/Pages/Assets/Index.tsx resources/js/Components/PrintLabelModal.tsx resources/js/Components/ImportExportButtons.tsx resources/js/Components/ui
git commit -m "feat(ui): migrate the asset list page to Untitled UI components"
```

---
### Task 6: Gerbang pilot dan dokumen Fase 0–3

**Files:**
- Modify: `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md`, `README.md`

- [ ] **Step 1: Suite penuh**

Run di latar belakang: `php artisan test --compact`
Expected: 715 test hijau.

- [ ] **Step 2: Pagar terakhir**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "@/components/" resources/js | head
grep -rn "preline\|HSStaticMethods" resources package.json | head
grep -rln "scrollbar-hide\|transition-inherit-all" resources/js/Components/ui
rm -rf .tmp-npmci && mkdir .tmp-npmci && cp package.json package-lock.json .tmp-npmci/ && (cd .tmp-npmci && npm ci --ignore-scripts 2>&1 | tail -3); rm -rf .tmp-npmci
```
Expected: semua bersih; `npm ci` tanpa error. Bila `grep -rln` menemukan berkas, tambahkan utilitas yang dipakai (`@utility scrollbar-hide` / `@utility transition-inherit-all`, isinya ada di `globals.css` starter kit Untitled UI) ke `resources/css/app.css`, lalu build ulang.

- [ ] **Step 3: Perbarui dokumen**

Di `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md` tambahkan bagian baru "Token dan komponen UI (Untitled UI)" berisi: lokasi komponen (`resources/js/Components/ui/`), cara menambah komponen (`npx untitledui@latest add <nama>` lalu perbaiki alias ke `@/Components/ui/`, jangan pakai alias huruf kecil), pemetaan warna (Sapphire = `blue-800` = `brand-600`), aturan konflik (panduan menang untuk identitas, Untitled UI menang untuk perilaku), kerapatan baris tabel mengikuti bawaan Untitled UI, dan larangan mencampur komponen Breeze di halaman yang sudah dimigrasi. Di `README.md` ubah baris stack agar menyebut Tailwind 4 dan Untitled UI (React Aria), dan tambahkan satu baris tentang `npx untitledui@latest add`. Perbarui catatan memori proyek (`reference-sibima-codebase-map.md`, `reference-sibima-gotchas.md`) dengan lokasi komponen `ui/`, `RouterProvider`, jebakan huruf besar-kecil alias di Docker, bentrok `bg-primary`, dan `onRowAction` kosong agar menekan baris tidak memilih baris.

- [ ] **Step 4: Commit**

```bash
git add docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md README.md
git commit -m "docs: document Untitled UI tokens, components and conventions"
```

- [ ] **Step 5: GERBANG PILOT — berhenti**

Laporkan: hasil Task 1–5 (tsc, build, suite penuh), konflik yang ditemukan dan keputusan yang saya ambil (daftar "Rulings"), serta hal yang tidak bisa diverifikasi tanpa browser. Minta pengguna menjalankan `npm run dev` dan memeriksa halaman **Data Aset** dengan daftar ini. Nilai **komponen**-nya, bukan keseluruhan halaman: shell (sidebar/header) masih lama, jadi tampilan sementara campuran.
- Pencarian (ketik, tunggu 400 ms, tombol hapus), keempat filter termasuk "Semua …", urutan.
- Filter kategori: ketik sebagian nama subkategori dan daftar menyempit; kosongkan untuk kembali ke "Semua Kategori".
- Menekan **nama aset, tombol lihat/ubah/cetak** pada satu baris **tidak** memilih baris; baris hanya terpilih lewat checkbox.
- Pilih baris, pilih semua di halaman, pindah halaman lalu kembali (pilihan lintas halaman tetap); tombol Cetak Label menjadi amber dengan "· Maks 99" saat lebih dari 99 terpilih.
- Tooltip muncul saat hover dan saat fokus keyboard pada tombol lihat/ubah/cetak.
- "Hapus semua filter" muncul saat ada filter aktif, juga di keadaan hasil kosong, dan tidak mengubah urutan.
- Modal cetak label: Esc, klik di luar, ganti ukuran, popup diblokir.
- Impor (berpindah halaman tanpa reload penuh) dan Ekspor (berkas terunduh, halaman tidak berpindah).
- Keyboard (Tab/Enter/Esc/panah pada Select dan tabel), layar 375 px (tabel menggulir), angka rata kanan dan tabular, warna badge kondisi, kontras netral `slate-*` terhadap token Untitled UI, kerapatan baris bawaan Untitled UI (jumlah baris per layar).
**Jangan memulai Fase 4** sebelum pengguna memutuskan lanjut, revisi, atau berhenti di titik "hanya komponen dasar".

---

## Fase 4

Rollout lanjutan (shell, master data, transaksi, pengaturan, laporan/dashboard/auth, pembersihan) mengikuti `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 dan dirinci dalam plan terpisah per kelompok setelah pilot disetujui.
