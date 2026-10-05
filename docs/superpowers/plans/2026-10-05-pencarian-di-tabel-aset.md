# Pencarian di Dalam Kartu Tabel Data Aset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kotak pencarian halaman Data Aset pindah ke baris atas di dalam kartu tabel; kartu filter hanya berisi Kategori, Unit, Kondisi, dan Urutkan dalam grid rata.

**Architecture:** Perubahan JSX murni di `Assets/Index.tsx`. Satu skrip Python memotong blok `<form onSubmit={submitSearch}>` apa adanya dari kartu filter, menyisipkannya (dengan indentasi disesuaikan) sebagai baris pertama kartu tabel, dan mengubah kelas tata letak kartu filter. State, efek tertunda, dan handler pencarian tidak disentuh.

**Tech Stack:** React/TypeScript, Tailwind v3, Inertia.

**Spec:** `docs/superpowers/specs/2026-10-05-pencarian-di-tabel-aset-design.md`

## Global Constraints

- Hanya `resources/js/Pages/Assets/Index.tsx`; tanpa perubahan backend, route, atau test PHP.
- Isi form pencarian (ikon `Search`, input, tombol `X`, `submitSearch`, efek 400 ms) tidak berubah; hanya `className` form dan `aria-label="Cari aset"` pada input yang ditambah/diubah.
- Kartu filter: `grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`; dropdown tanpa `min-w-[...]`.
- Commit: stage dengan path eksplisit, **tanpa trailer `Co-Authored-By` atau atribusi Claude**, jangan push.
- Jangan menguji lewat browser kecuali pengguna memerintahkan; verifikasi dengan `npx tsc --noEmit`, `npm run build`, dan pemeriksaan hasil edit di Step 2.
- Skrip TSX tanpa backslash boleh lewat Python dari berkas (simpan dengan alat Write).

## Review Focus

Kondisi yang tersirat di spec; frontend tidak punya test otomatis di repo ini, jadi masing-masing dibuktikan lewat pemeriksaan hasil edit di Step 2 dan pengecekan visual oleh pengguna:

1. **Pencarian tetap berfungsi setelah pindah (debounce, Enter, tombol X):** form dipindah utuh; Step 2 memastikan `submitSearch` dan `setSearch('')` masih tepat satu kali di berkas.
2. **Layar sempit:** form `max-w-sm` tidak membuat input lebih sempit dari kartu di ponsel; kelas `max-w-sm` hanya membatasi, tidak mengunci lebar. Dicek visual oleh pengguna.
3. **Kartu filter tidak kehilangan dropdown:** Step 2 menghitung empat `<select` di kartu filter dan satu `aria-label="Cari aset"`.
4. **Tombol Cetak Label dan tombol aksi atas tidak berubah:** diff tidak menyentuh bagian header halaman (Step 2 memeriksa `git diff --stat` hanya satu berkas).

---

### Task 1: Pindahkan pencarian ke kartu tabel

**Files:**
- Modify: `resources/js/Pages/Assets/Index.tsx`

**Interfaces:**
- Consumes: `search`, `setSearch`, `submitSearch`, `applyFilters` yang sudah ada di komponen.
- Produces: tata letak baru; tidak ada antarmuka baru.

- [ ] **Step 1: Skrip edit**

Simpan dengan alat Write ke `C:/Users/ABDULA~1/AppData/Local/Temp/claude/C--Users-abdulaziz-Documents-pribadi-SIBIMA/b39db684-e281-401f-8853-ec1e845ccf18/scratchpad/search_move.py`, lalu jalankan dari root repo:

```python
path = 'resources/js/Pages/Assets/Index.tsx'
s = open(path, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')


def once(text, old, new):
    assert text.count(old) == 1, (old[:70], text.count(old))
    return text.replace(old, new)


# 1. potong blok form pencarian dari kartu filter
FORM_OPEN = '                    <form onSubmit={submitSearch} className="relative flex-1">\n'
start = s.index(FORM_OPEN)
end = s.index('                    </form>\n', start) + len('                    </form>\n')
form = s[start:end]
s = s[:start] + s[end:].lstrip('\n')

# 2. sesuaikan form: lebar dan label, lalu geser indentasi 4 spasi
form = once(form, 'className="relative flex-1"', 'className="relative max-w-sm"')
form = once(form, '                            type="text"\n', '                            type="text"\n                            aria-label="Cari aset"\n')
form = ''.join(('    ' + line if line.strip() else line) for line in form.splitlines(keepends=True))
wrapper = '                    <div className="border-b border-slate-200 p-4">\n' + form + '                    </div>\n'

# 3. sisipkan sebagai baris pertama kartu tabel
CARD = '                <div className="shadow-xs overflow-hidden rounded-xl border border-slate-200 bg-white">\n'
s = once(s, CARD, CARD + wrapper)

# 4. kartu filter: kartu polos + grid rata, dropdown tanpa lebar minimum
s = once(s, '<div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">',
         '<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">')
s = once(s, '<div className="flex flex-wrap items-center gap-3">', '<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">')
for w in ('170', '160', '150', '210'):
    s = once(s, f'<div className="relative min-w-[{w}px]">', '<div className="relative">')

open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))
print('ok')
```

- [ ] **Step 2: Periksa hasil edit**

Run (dari root repo):

```bash
python <path skrip>
git diff --stat
grep -c "submitSearch" resources/js/Pages/Assets/Index.tsx
grep -c "setSearch('')" resources/js/Pages/Assets/Index.tsx
grep -c 'aria-label="Cari aset"' resources/js/Pages/Assets/Index.tsx
grep -c "min-w-\[1[567]0px\]\|min-w-\[210px\]" resources/js/Pages/Assets/Index.tsx
grep -n "Filter Toolbar" -A3 resources/js/Pages/Assets/Index.tsx
grep -n "Data Table" -A8 resources/js/Pages/Assets/Index.tsx
```

Expected: skrip mencetak `ok`; `git diff --stat` hanya `resources/js/Pages/Assets/Index.tsx`; `submitSearch` muncul 2 kali (definisi dan `onSubmit`), `setSearch('')` 1 kali, `aria-label="Cari aset"` 1 kali, `min-w-` lama 0 kali; kartu filter berisi `grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`, dan baris pertama kartu tabel adalah `<div className="border-b border-slate-200 p-4">` berisi form.

- [ ] **Step 3: tsc, build, dan test halaman**

Run: `npx tsc --noEmit` lalu `npm run build` lalu `php artisan test --filter="AssetBrowseTest|AssetSortTest"`
Expected: `tsc` tanpa error, build sukses, test PASS (halaman tetap mengirim props yang sama).

- [ ] **Step 4: Commit**

```bash
git add resources/js/Pages/Assets/Index.tsx
git commit -m "refactor(assets): move the asset search into the table card and lay filters out in an even grid"
```
