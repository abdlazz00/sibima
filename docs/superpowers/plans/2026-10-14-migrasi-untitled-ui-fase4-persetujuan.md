# Migrasi Untitled UI, Fase 4: Kotak Persetujuan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan halaman Kotak Persetujuan (`Persetujuan/Index`) ke komponen Untitled UI tanpa mengubah logika, props Inertia, atau backend.

**Architecture:** Hanya frontend, satu berkas. Antrean kerja tetap berbentuk daftar baris (bukan tabel) karena tiap entri adalah satu pekerjaan yang ditinjau, bukan data berkolom: `PageHeader`, kartu berisi baris-baris, badge jenis alur, tombol "Tinjau" `secondary-brand`.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI, `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 3. Pola acuan: plan Mutasi dan Penerimaan.

## Global Constraints

- Props, bentuk data `items`, `show_url`, teks, dan perilaku tidak berubah. Tidak ada pengurutan atau filter baru (di luar lingkup migrasi).
- Tombol "Tinjau" membuka halaman detail → `secondary-brand`. Badge `type="color" size="sm" className="rounded-sm"`.
- Impor `@/Components/...` berhuruf besar; tanpa `@/Components/Icons`; tanpa dependensi baru.
- Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `--filter='Persetujuan|Approval'`. Cek runtime singkat diperbolehkan; penilaian visual oleh pengguna di gerbang.
- Git: commit di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Baris di layar sempit**: judul panjang dan tombol tidak boleh saling menekan. Pagar: `flex-col sm:flex-row` dan `min-w-0` (Task 1); butir gerbang 375 px.
2. **Tautan `show_url`** adalah URL penuh dari server; tombol memakai `href` Untitled `Button` (navigasi Inertia via `RouterProvider`) tanpa mengubah tujuan. Pagar: Task 1.

---

### Task 1: `Persetujuan/Index` dan gerbang

**Files:**
- Modify: `resources/js/Pages/Persetujuan/Index.tsx` (ganti seluruh isi)

- [ ] **Step 1: Tulis ulang `Index.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';

interface PersetujuanItem {
    id: number;
    workflow_name: string;
    title: string;
    submitted_by: string;
    current_step: number;
    created_at: string;
    show_url: string;
}

interface IndexProps extends PageProps {
    items: PersetujuanItem[];
}

export default function Index({ items }: IndexProps) {
    return (
        <AuthenticatedLayout>
            <Head title="Kotak Persetujuan" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Kotak Persetujuan' }]}
                    title="Kotak Persetujuan"
                />

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    {items.length === 0 ? (
                        <p className="py-14 text-center text-sm text-slate-400">Tidak ada pengajuan yang menunggu persetujuan Anda.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {items.map((item) => (
                                <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <Badge type="color" size="sm" color="blue" className="rounded-sm">
                                            {item.workflow_name}
                                        </Badge>
                                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                        <p className="text-xs text-slate-500">
                                            Diajukan oleh {item.submitted_by} · {item.created_at}
                                        </p>
                                    </div>
                                    <Button color="secondary-brand" size="md" href={item.show_url} aria-label={`Tinjau ${item.title}`} className="shrink-0">
                                        Tinjau
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "@/Components/Icons" resources/js/Pages/Persetujuan/Index.tsx
php artisan test --compact --filter='Persetujuan|Approval'
git add resources/js/Pages/Persetujuan/Index.tsx
git commit -m "feat(ui): migrate the approval inbox page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

- [ ] **Step 3: Cek runtime singkat dan GERBANG KOTAK PERSETUJUAN — berhenti**

Cek di browser headless dengan akun yang punya `persetujuan.view` (mis. super-admin atau camat): halaman memuat tanpa error, entri (bila ada) tampil dengan badge jenis alur dan tombol Tinjau.

Laporkan hasil dan hal yang tak bisa diverifikasi. Minta pengguna memeriksa: badge jenis alur per baris, tombol Tinjau menuju detail yang benar, keadaan kosong, layar 375 px, dan keyboard/fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.

---

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Ponytail: satu berkas, tanpa abstraksi. Badge "N menunggu" dihapus (fitur baru di luar lingkup migrasi).
- Impeccable (Operate): efek hover pada baris dihapus karena hanya tombol yang bisa diklik (hover menyiratkan baris klikabel); tombol "Tinjau" diberi `aria-label` berisi judul agar pembaca layar membedakan antar baris. Badge `Badge` tetap dipakai untuk jenis alur.
