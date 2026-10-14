# Migrasi Untitled UI, Fase 4: Halaman Autentikasi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan halaman autentikasi (`Login`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `ConfirmPassword`) ke komponen Untitled UI tanpa mengubah alur, props Inertia, atau tata letak dua panel (`AuthSplitLayout`).

**Architecture:** `AuthSplitLayout` (panel kiri bergambar, panel kanan formulir) sudah sesuai identitas dan tidak diubah. Field memakai `Input` (label, bantuan/galat, dan tombol tampil/sembunyi sandi bawaan `type="password"`), tombol memakai `Button`, "Ingat saya" memakai `Checkbox`. Komponen `PasswordInput.tsx` buatan sendiri menjadi tidak terpakai dan dihapus. `VerifyEmail` dan `ConfirmPassword` (masih bawaan Breeze, berbahasa Inggris, memakai `GuestLayout`) dipindah ke `AuthSplitLayout` dengan teks berbahasa Indonesia sebagai task terpisah.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 5 (Auth, dikerjakan sebagai modul tersendiri atas permintaan pengguna). Pola acuan: plan Aset, Kategori Aset, Scan QR, dan Pegawai di `docs/superpowers/plans/`.

## Global Constraints

- Hanya komponen Untitled UI gratis. Panduan UI/UX menang untuk identitas; Untitled UI menang untuk semantik, keyboard, fokus.
- **Halaman pertama yang dilihat setiap pengguna dan sering dibuka di ponsel**: semua field `size="lg"` (44 px) dan tombol `size="lg"` selebar formulir; tidak ada perubahan lebar kolom (`max-w-[400px]`), judul `text-[28px]`, atau panel kiri.
- Logika tidak berubah: `useForm` (nilai awal, `post`, `reset('password')` di `onFinish`, `reset('password', 'password_confirmation')`), props (`status`, `canResetPassword`, `token`, `email`), pemindahan fokus ke judul sukses di `ForgotPassword`, pemisahan tampilan "tautan tidak berlaku" di `ResetPassword`, dan atribut peramban: `name`, `autoComplete`, `autoFocus` dipertahankan agar pengelola kata sandi tetap bekerja.
- Penanda wajib (`*`) disembunyikan (`hideRequiredIndicator`) karena form satu-tujuan; `isRequired` tetap memberi validasi bawaan peramban.
- Galat lewat `hint={errors.x}` + `isInvalid={Boolean(errors.x)}`; teks bantuan biasa saat tidak ada galat.
- Tautan teks ("Lupa kata sandi?", "Kembali ke Halaman Masuk") tetap `Link` Inertia dengan kelas yang sudah ada (target sentuh `min-h-11` dipertahankan).
- Tidak mencampur komponen Breeze di halaman yang dimigrasi; impor memakai `@/Components/...` berhuruf besar. Tanpa dependensi baru.
- Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `--filter='Auth|Password|Email|Login'`. Cek runtime singkat di browser diperbolehkan untuk menangkap error (halaman tamu, tanpa data sensitif); penilaian visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Tombol tampil/sembunyi sandi berlabel bahasa Inggris** ("Toggle password visibility") pada `Input` hasil CLI, sementara komponen lama berlabel "Tampilkan/Sembunyikan kata sandi". Pagar: label diubah di `input.tsx` lokal menjadi Indonesia dan bergantung pada keadaan (Task 1 Step 1).
2. **Pengelola kata sandi dan isian otomatis**: `name`, `autoComplete` (`username`, `current-password`, `new-password`, `email`) harus tetap terpasang pada `<input>` yang sebenarnya, bukan pembungkus. Pagar: periksa atribut di DOM saat cek runtime (Task 1).
3. **Galat login** (kredensial salah) tampil di bawah Email/NIP dan sandi dikosongkan; fokus tidak boleh hilang ke `body`. Pagar: logika `reset('password')` tidak diubah; butir gerbang.
4. **Pengiriman ganda**: `isLoading` pada tombol harus mencegah penekanan kedua; teks "Memproses…" berganti spinner. Pagar: `Button isLoading`.
5. **"Ingat saya"** tetap terkirim sebagai boolean. Pagar: `Checkbox` dengan `isSelected`/`onChange` (Task 1).
6. **Email read-only di `ResetPassword`** harus tetap ikut terkirim dan tidak bisa diubah, serta tampak nonaktif. Pagar: `isReadOnly` + gaya (Task 2).
7. **Dua keadaan alternatif** (`ForgotPassword` sukses, `ResetPassword` tautan tidak berlaku) tetap tampil sama dan tetap mengumumkan diri (`role="alert"`, fokus ke judul). Pagar: struktur kondisi tidak diubah (Task 2).
8. **Perubahan bahasa pada `VerifyEmail`/`ConfirmPassword`**: teks bawaan Breeze (Inggris) diganti Indonesia, dan halaman pindah tata letak. Keduanya masih bisa dijangkau (`verification.notice`, `password.confirm`) dan diuji test bawaan. Pagar: Task 3 terpisah agar bisa ditolak tanpa mengganggu Task 1–2.
9. **Warna fokus dan seleksi**: `selection:bg-blue-800` pada `AuthSplitLayout` dan cincin fokus Untitled UI (`ring-brand`) harus serasi dengan Sapphire. Pagar: skala `brand` sudah Sapphire (Fase 1); butir gerbang.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/Components/ui/base/input/input.tsx` | Label tombol tampil/sembunyi sandi berbahasa Indonesia |
| `resources/js/Pages/Auth/Login.tsx` | Halaman masuk |
| `resources/js/Pages/Auth/ForgotPassword.tsx`, `ResetPassword.tsx` | Pemulihan kata sandi |
| `resources/js/Components/PasswordInput.tsx` | Dihapus (digantikan `Input type="password"`) |
| `resources/js/Pages/Auth/VerifyEmail.tsx`, `ConfirmPassword.tsx` | Task 3 |

---

### Task 1: `Login`

**Files:**
- Modify: `resources/js/Components/ui/base/input/input.tsx`, `resources/js/Pages/Auth/Login.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `Input`, `Button`, `Checkbox`.
- Produces: halaman dengan props Inertia sama (`status?`, `canResetPassword`).

- [ ] **Step 1: Label tombol sandi berbahasa Indonesia**

Di `resources/js/Components/ui/base/input/input.tsx` ganti
```tsx
aria-label="Toggle password visibility"
```
dengan
```tsx
aria-label={isPasswordVisible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
```
(salinan lokal hasil CLI; perubahan ini perlu diingat bila komponen suatu saat ditimpa).

- [ ] **Step 2: Tulis ulang `Login.tsx`**

```tsx
import { Button } from '@/Components/ui/base/buttons/button';
import { Checkbox } from '@/Components/ui/base/checkbox/checkbox';
import { Input } from '@/Components/ui/base/input/input';
import AuthSplitLayout from '@/Layouts/AuthSplitLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthSplitLayout>
            <Head title="Masuk - SIBIMA" />

            <h1 className="mb-7 text-[28px] font-bold tracking-tight text-gray-900">Masuk</h1>

            {status && (
                <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3.5 text-sm font-medium text-green-700">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-5">
                <Input
                    label="Email / NIP"
                    name="email"
                    size="lg"
                    autoComplete="username"
                    autoFocus
                    isRequired
                    hideRequiredIndicator
                    placeholder="Masukkan email atau NIP"
                    value={data.email}
                    onChange={(v) => setData('email', v)}
                    isInvalid={Boolean(errors.email)}
                    hint={errors.email}
                />

                <Input
                    label="Kata Sandi"
                    name="password"
                    type="password"
                    size="lg"
                    autoComplete="current-password"
                    isRequired
                    hideRequiredIndicator
                    placeholder="••••••••"
                    value={data.password}
                    onChange={(v) => setData('password', v)}
                    isInvalid={Boolean(errors.password)}
                    hint={errors.password}
                />

                <div className="flex items-center justify-between pt-1">
                    <Checkbox
                        name="remember"
                        label="Ingat saya"
                        isSelected={data.remember}
                        onChange={(checked) => setData('remember', checked)}
                    />

                    {canResetPassword && (
                        <Link
                            href={route('password.request')}
                            className="rounded-sm text-sm font-medium text-blue-800 hover:text-blue-700 hover:underline focus:outline-hidden focus:ring-2 focus:ring-blue-800 focus:ring-offset-1"
                        >
                            Lupa kata sandi?
                        </Link>
                    )}
                </div>

                <div className="pt-2">
                    <Button type="submit" color="primary" size="lg" className="w-full" isLoading={processing}>
                        Masuk
                    </Button>
                </div>
            </form>
        </AuthSplitLayout>
    );
}
```

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "InputError\|PasswordInput" resources/js/Pages/Auth/Login.tsx
php artisan test --compact --filter='AuthenticationTest'
git add resources/js/Components/ui/base/input/input.tsx resources/js/Pages/Auth/Login.tsx
git commit -m "feat(ui): migrate the login page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau. Prop yang berbeda dari yang diasumsikan (`name`, `autoFocus`, `autoComplete` pada `Input`; `name` pada `Checkbox`) disesuaikan dan dicatat sebagai `Ruling`.

---

### Task 2: `ForgotPassword` dan `ResetPassword`

**Files:**
- Modify: `resources/js/Pages/Auth/ForgotPassword.tsx`, `resources/js/Pages/Auth/ResetPassword.tsx`
- Delete: `resources/js/Components/PasswordInput.tsx`

**Interfaces:**
- Consumes: `Input`, `Button`; ikon `Mail01`.
- Produces: halaman dengan props Inertia sama.

- [ ] **Step 1: `ForgotPassword.tsx` (ubah bagian tertentu)**

Tambah impor dan ganti penggunaan `InputError`, `<input>`, ikon `<svg>`, dan tombol kirim:
```tsx
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import AuthSplitLayout from '@/Layouts/AuthSplitLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Mail01 } from '@untitledui/icons';
import { FormEventHandler, useEffect, useRef } from 'react';
```
(hapus impor `InputError`). Pada keadaan sukses ganti `<svg ...>…</svg>` di dalam lingkaran hijau dengan:
```tsx
<Mail01 className="size-6" />
```
(lingkaran `aria-hidden="true"` dan kelasnya tidak berubah). Pada formulir ganti blok `<div><label …/><input …/><InputError …/></div>` dan tombol kirim dengan:
```tsx
<Input
    label="Email Kedinasan"
    name="email"
    type="email"
    size="lg"
    autoComplete="email"
    autoFocus
    isRequired
    hideRequiredIndicator
    placeholder="Masukkan email kedinasan"
    value={data.email}
    onChange={(v) => setData('email', v)}
    isInvalid={Boolean(errors.email)}
    hint={errors.email}
/>

<Button type="submit" color="primary" size="lg" className="w-full" isLoading={processing}>
    Kirim Tautan Pemulihan
</Button>
```
Konstanta `backLink`, `successHeading`/`useEffect` fokus, struktur `if (status)`, teks, dan tautan kembali tidak berubah.

- [ ] **Step 2: `ResetPassword.tsx` (ubah bagian tertentu)**

Impor: ganti `InputError` dan `PasswordInput` dengan
```tsx
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
```
Pada keadaan "Tautan Tidak Berlaku" ganti `<Link …>Minta Tautan Baru</Link>` dengan:
```tsx
<Button color="primary" size="lg" className="w-full" href={route('password.request')}>
    Minta Tautan Baru
</Button>
```
(tautan "Kembali ke Halaman Masuk" tetap `Link`). Pada formulir ganti ketiga blok field dan tombol dengan:
```tsx
<Input
    label="Email"
    name="email"
    type="email"
    size="lg"
    autoComplete="username"
    isReadOnly
    wrapperClassName="bg-gray-50"
    inputClassName="cursor-not-allowed text-gray-500"
    value={data.email}
/>

<Input
    label="Kata Sandi Baru"
    name="password"
    type="password"
    size="lg"
    autoComplete="new-password"
    autoFocus
    isRequired
    hideRequiredIndicator
    value={data.password}
    onChange={(v) => setData('password', v)}
    isInvalid={Boolean(errors.password)}
    hint={errors.password ?? 'Minimal 8 karakter.'}
/>

<Input
    label="Konfirmasi Kata Sandi Baru"
    name="password_confirmation"
    type="password"
    size="lg"
    autoComplete="new-password"
    isRequired
    hideRequiredIndicator
    value={data.password_confirmation}
    onChange={(v) => setData('password_confirmation', v)}
    isInvalid={Boolean(errors.password_confirmation)}
    hint={errors.password_confirmation}
/>

<Button type="submit" color="primary" size="lg" className="w-full" isLoading={processing}>
    Simpan Kata Sandi Baru
</Button>
```
`useForm`, `submit`, dan cabang `if (errors.email)` tidak berubah.

- [ ] **Step 3: Hapus `PasswordInput.tsx` dan verifikasi**

```bash
grep -rn "PasswordInput" resources/js | grep -v "Components/PasswordInput.tsx"
git rm resources/js/Components/PasswordInput.tsx
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "InputError\|PasswordInput" resources/js/Pages/Auth/ForgotPassword.tsx resources/js/Pages/Auth/ResetPassword.tsx
php artisan test --compact --filter='PasswordResetTest'
```
Expected: `grep` pertama kosong (tidak ada pemakai lain; hentikan dan laporkan bila ada), `tsc`/build bersih, `grep` kedua kosong, test hijau.

- [ ] **Step 4: Commit**

```bash
git add resources/js/Pages/Auth/ForgotPassword.tsx resources/js/Pages/Auth/ResetPassword.tsx
git commit -m "feat(ui): migrate the password recovery pages to Untitled UI components"
```
(`git rm` sudah men-stage penghapusan `PasswordInput.tsx`, ikut ter-commit.)

---

### Task 3: `VerifyEmail` dan `ConfirmPassword` (bahasa dan tata letak)

**Files:**
- Modify: `resources/js/Pages/Auth/VerifyEmail.tsx`, `resources/js/Pages/Auth/ConfirmPassword.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `AuthSplitLayout`, `Input`, `Button`.
- Produces: halaman dengan props Inertia sama (`VerifyEmail`: `status?`; `ConfirmPassword`: tanpa props). **Perubahan teks yang disengaja**: dari Inggris bawaan Breeze ke Indonesia, dan dari `GuestLayout` ke `AuthSplitLayout`.

- [ ] **Step 1: `VerifyEmail.tsx`**

```tsx
import { Button } from '@/Components/ui/base/buttons/button';
import AuthSplitLayout from '@/Layouts/AuthSplitLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function VerifyEmail({ status }: { status?: string }) {
    const { post, processing } = useForm({});

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('verification.send'));
    };

    return (
        <AuthSplitLayout>
            <Head title="Verifikasi Email - SIBIMA" />

            <h1 className="mb-2 text-[28px] font-bold tracking-tight text-gray-900">Verifikasi Email</h1>
            <p className="mb-7 text-sm text-gray-600">
                Sebelum mulai, mohon verifikasi alamat email Anda dengan menekan tautan yang baru kami kirim ke email
                Anda. Jika belum menerimanya, kami dapat mengirim ulang.
            </p>

            {status === 'verification-link-sent' && (
                <div
                    role="status"
                    className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3.5 text-sm font-medium text-green-700"
                >
                    Tautan verifikasi baru telah dikirim ke alamat email yang Anda daftarkan.
                </div>
            )}

            <form onSubmit={submit} className="space-y-3">
                <Button type="submit" color="primary" size="lg" className="w-full" isLoading={processing}>
                    Kirim Ulang Email Verifikasi
                </Button>
                <Button color="tertiary" size="lg" className="w-full" onPress={() => router.post(route('logout'))}>
                    Keluar
                </Button>
            </form>
        </AuthSplitLayout>
    );
}
```

- [ ] **Step 2: `ConfirmPassword.tsx`**

```tsx
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import AuthSplitLayout from '@/Layouts/AuthSplitLayout';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('password.confirm'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthSplitLayout>
            <Head title="Konfirmasi Kata Sandi - SIBIMA" />

            <h1 className="mb-2 text-[28px] font-bold tracking-tight text-gray-900">Konfirmasi Kata Sandi</h1>
            <p className="mb-7 text-sm text-gray-600">
                Ini adalah area aman aplikasi. Mohon konfirmasi kata sandi Anda sebelum melanjutkan.
            </p>

            <form onSubmit={submit} className="space-y-5">
                <Input
                    label="Kata Sandi"
                    name="password"
                    type="password"
                    size="lg"
                    autoComplete="current-password"
                    autoFocus
                    isRequired
                    hideRequiredIndicator
                    placeholder="••••••••"
                    value={data.password}
                    onChange={(v) => setData('password', v)}
                    isInvalid={Boolean(errors.password)}
                    hint={errors.password}
                />

                <Button type="submit" color="primary" size="lg" className="w-full" isLoading={processing}>
                    Konfirmasi
                </Button>
            </form>
        </AuthSplitLayout>
    );
}
```

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "InputError\|PrimaryButton\|TextInput\|InputLabel\|GuestLayout" resources/js/Pages/Auth
php artisan test --compact --filter='EmailVerification|PasswordConfirmation'
git add resources/js/Pages/Auth/VerifyEmail.tsx resources/js/Pages/Auth/ConfirmPassword.tsx
git commit -m "feat(ui): migrate the email verification and password confirmation pages to Untitled UI"
```
Expected: bersih; `grep` kosong; test hijau. `GuestLayout.tsx` tidak lagi dipakai halaman mana pun; dihapus pada pembersihan akhir Fase 4, bukan di sini.

- [ ] **Step 4: Cek runtime singkat dan GERBANG AUTH — berhenti**

Cek di browser headless (halaman tamu): `/login` (atribut `name`/`autoComplete` pada `<input>`, tombol sandi berlabel Indonesia, tidak ada error console), `/forgot-password`, `/reset-password/{token}`; keluar dulu dari sesi bila perlu.

Laporkan hasil Task 1–3, `Ruling`, dan hal yang tak bisa diverifikasi. Minta pengguna memeriksa **di ponsel dan desktop**:
- **Masuk**: field dan tombol 44 px, tombol mata menampilkan/menyembunyikan sandi (dengan keyboard Tab+Enter), "Ingat saya", kredensial salah (galat merah di bawah Email/NIP dan sandi terkosongkan), tombol berputar saat memproses, pengelola kata sandi peramban menawarkan simpan/isi otomatis, "Lupa kata sandi?".
- **Lupa kata sandi**: kirim email (tampilan sukses dengan ikon surat dan fokus ke judul), email tak terdaftar (galat), "Gunakan email lain".
- **Atur ulang**: tautan valid (email terkunci abu-abu, sandi ≥ 8 karakter, konfirmasi tidak cocok menampilkan galat), tautan kedaluwarsa (kartu "Tautan Tidak Berlaku" dan tombol "Minta Tautan Baru").
- **Verifikasi email** dan **Konfirmasi kata sandi** (dibuka lewat `/verify-email` dan `/confirm-password` saat login): teks Indonesia dan tata letak dua panel.
- Warna fokus dan tombol Sapphire, layar 375 px, keyboard.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.
