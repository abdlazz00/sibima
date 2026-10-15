# Profil Akun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti halaman Profil (Breeze mentah) dengan halaman akun lengkap bergaya Untitled UI berbahasa Indonesia: identitas, ubah nama/email/sandi lewat dialog, foto profil, keamanan sesi, dan riwayat aktivitas.

**Architecture:** Empat tahap bergerbang; tiap tahap menghasilkan perangkat lunak yang dapat diuji sendiri. Backend (Laravel) dikerjakan dengan tes Pest lebih dulu; tampilan (Inertia + React) diverifikasi dengan `tsc`, build, dan cek runtime singkat. Sesi dibaca/dicabut langsung dari tabel `sessions` (driver `database`); riwayat kerja digabung saat dibaca dari `approval_requests`/`approval_actions`; hanya catatan login yang berupa tabel baru.

**Tech Stack:** Laravel 13, Pest, Inertia 2 (`Inertia::optional`), React 19, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-15-profil-akun-design.md`

## Global Constraints

- Teks antarmuka dan pesan galat Profil **berbahasa Indonesia**; pesan ditulis langsung di Form Request/validator (tidak ada folder `lang/`, jangan menambahnya).
- Tidak ada dependensi baru (Composer/npm). Penguraian user-agent ditulis sendiri.
- Semua rute Profil hanya bekerja pada `$request->user()`; tidak ada policy baru.
- Email wajib `current_password` hanya bila nilainya berubah; nama saja tidak.
- Foto: jpg/png/webp, maks 2 MB, disk `public`, folder `profile-photos`. Izin tidak ditampilkan di Profil.
- Sesi: aksi cabut selalu meminta `current_password`; sesi yang sedang dipakai tidak dapat dicabut lewat daftar; identitas sesi di antarmuka berupa `sha256` dari id sesi (bukan id mentah).
- Catatan login: `login`/`gagal`/`logout`; dipangkas otomatis setelah 90 hari.
- Tampilan: komponen Untitled UI yang sudah ada (`PageHeader`, `Tabs`, `Badge`, `Button`, `ModalOverlay`/`Dialog`, `Input`, `ConfirmDialog`); tanpa `@/Components/Icons`, Headless UI, atau komponen Breeze. Warna tombol: aksi utama `primary`, Ubah/Ganti `secondary`, hapus/keluarkan `secondary-destructive`/`primary-destructive`, Batal `secondary`. Badge `type="color" size="sm" className="rounded-sm"`.
- Tidak ada fitur di luar spec (2FA, preferensi notifikasi, hapus akun, ubah NIP/role/unit).
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.
- Pint: jalankan hanya pada berkas PHP yang diubah task (daftar eksplisit di langkah verifikasi), **jangan pernah** pada `routes/web.php` (mengubah urutan `use` yang tak terkait). Jalankan tes yang relevan setelah tiap perubahan.

## Review Focus

1. **Ubah email dengan sandi kosong/salah** harus ditolak dengan pesan Indonesia dan email tidak berubah; mengganti nama saja tidak boleh meminta sandi dan tidak boleh menggeser `password_changed_at` (Task 1).
2. **Akun minimal** (tanpa role, tanpa unit, tanpa data pegawai) harus tetap membuka halaman Profil dan Aktivitas tanpa galat; NIP tampil "—" (Task 1, 4).
3. **Unggah foto** berkas bukan gambar / > 2 MB / format salah ditolak; mengganti atau menghapus foto tidak meninggalkan berkas yatim di disk (Task 2).
4. **Pencabutan sesi** tidak boleh menyentuh sesi milik pengguna lain maupun sesi yang sedang dipakai; sandi salah tidak mencabut apa pun (Task 3).
5. **Riwayat aktivitas** halaman di luar jangkauan menghasilkan daftar kosong (bukan galat); pengajuan yang dokumennya sudah dihapus dilewati; catatan login akun lain tidak pernah muncul (Task 4).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `database/migrations/2026_10_15_000001_add_password_changed_at_to_users_table.php` | Kolom `password_changed_at` |
| `database/migrations/2026_10_15_000002_add_foto_profile_to_users_table.php` | Kolom `foto_profile` |
| `database/migrations/2026_10_15_000003_create_login_logs_table.php` | Tabel `login_logs` |
| `app/Models/User.php` | Hook sandi, cast, `foto_profile`, aksesor foto |
| `app/Models/LoginLog.php` | Model catatan login (dipangkas 90 hari) |
| `app/Support/LoginActivityRecorder.php` | Perekam event Login/Failed/Logout |
| `app/Support/SessionDevice.php` | Label perangkat dari user-agent |
| `app/Services/ActivityFeed.php` | Penggabung riwayat aktivitas |
| `app/Http/Requests/ProfileUpdateRequest.php` | Validasi nama/email |
| `app/Http/Controllers/ProfileController.php` | Halaman Profil + props |
| `app/Http/Controllers/Auth/PasswordController.php` | Ubah sandi (pesan Indonesia) |
| `app/Http/Controllers/ProfilePhotoController.php` | Foto profil |
| `app/Http/Controllers/ProfileSessionController.php` | Cabut sesi |
| `resources/js/Components/InfoRow.tsx`, `FormDialog.tsx` | Baris label–nilai–aksi; cangkang dialog form |
| `resources/js/Pages/Profile/Edit.tsx` + `Partials/*` | Halaman dan potongannya |

---

### Task 1 (Tahap 1 – Dasar): halaman baru, info akun, ubah nama/email/sandi

**Files:**
- Create: `database/migrations/2026_10_15_000001_add_password_changed_at_to_users_table.php`, `resources/js/Components/InfoRow.tsx`, `resources/js/Components/FormDialog.tsx`, `resources/js/Pages/Profile/Partials/{ProfileHeader,AccountInfoCard,CredentialsCard,EditNameDialog,EditEmailDialog,ChangePasswordDialog}.tsx`
- Modify: `app/Models/User.php`, `app/Http/Requests/ProfileUpdateRequest.php`, `app/Http/Controllers/ProfileController.php`, `app/Http/Controllers/Auth/PasswordController.php`, `resources/js/Pages/Profile/Edit.tsx`, `resources/js/types/index.d.ts`, `tests/Feature/ProfileTest.php`
- Delete: `resources/js/Pages/Profile/Partials/UpdateProfileInformationForm.tsx`, `resources/js/Pages/Profile/Partials/UpdatePasswordForm.tsx`

**Interfaces:**
- Produces: prop Inertia `akun: { nip: string|null; role: string|null; unit: string|null; cakupan: string; aktif: boolean; sandi_diubah: string|null }` (ditambah `punya_foto` di Task 2, `sessions` di Task 3, `aktivitas` di Task 4); komponen `FormDialog` (`{ title, description?, submitLabel?, destructive?, processing, onSubmit, onClose, children }`) dan `InfoRow` (`{ label, children, action? }`); rute `profile.update` (PATCH, nama/email), `password.update` (PUT).

- [ ] **Step 1: Tulis tes yang gagal** — ganti isi `tests/Feature/ProfileTest.php`:

```php
<?php

use App\Models\Pegawai;
use App\Models\User;

beforeEach(function () {
    $this->unit = makeKecamatan();
});

test('profile page shows the account summary', function () {
    $user = userWithRole('admin_kecamatan', $this->unit);
    Pegawai::factory()->create(['user_id' => $user->id, 'unit_id' => $this->unit->id, 'nip' => '198001012005011001']);

    $this->actingAs($user)->get('/profile')->assertOk()->assertInertia(fn ($page) => $page
        ->component('Profile/Edit')
        ->where('akun.nip', '198001012005011001')
        ->where('akun.unit', 'Kecamatan Sagulung')
        ->where('akun.aktif', true)
        ->has('akun.role')
        ->has('akun.cakupan')
        ->has('akun.sandi_diubah'));
});

test('profile page opens for a minimal account without role, unit, or pegawai', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/profile')->assertOk()->assertInertia(fn ($page) => $page
        ->where('akun.nip', null)
        ->where('akun.role', null)
        ->where('akun.unit', null));
});

test('the name can be changed without the current password', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch('/profile', ['name' => 'Nama Baru', 'email' => $user->email])
        ->assertSessionHasNoErrors()
        ->assertRedirect('/profile');

    expect($user->refresh()->name)->toBe('Nama Baru');
});

test('changing the email requires the current password', function () {
    $user = User::factory()->create(['email' => 'lama@example.com']);

    $this->actingAs($user)
        ->patch('/profile', ['name' => $user->name, 'email' => 'baru@example.com'])
        ->assertSessionHasErrors(['current_password' => 'Sandi saat ini wajib diisi untuk mengubah email.']);

    expect($user->refresh()->email)->toBe('lama@example.com');
});

test('changing the email rejects a wrong current password', function () {
    $user = User::factory()->create(['email' => 'lama@example.com']);

    $this->actingAs($user)
        ->patch('/profile', ['name' => $user->name, 'email' => 'baru@example.com', 'current_password' => 'salah'])
        ->assertSessionHasErrors(['current_password' => 'Sandi saat ini salah.']);

    expect($user->refresh()->email)->toBe('lama@example.com');
});

test('the email can be changed with the correct current password and loses its verification', function () {
    $user = User::factory()->create(['email' => 'lama@example.com']);

    $this->actingAs($user)
        ->patch('/profile', ['name' => $user->name, 'email' => 'baru@example.com', 'current_password' => 'password'])
        ->assertSessionHasNoErrors()
        ->assertRedirect('/profile');

    $user->refresh();

    expect($user->email)->toBe('baru@example.com')->and($user->email_verified_at)->toBeNull();
});

test('an email already used by another account is rejected in Indonesian', function () {
    User::factory()->create(['email' => 'dipakai@example.com']);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch('/profile', ['name' => $user->name, 'email' => 'dipakai@example.com', 'current_password' => 'password'])
        ->assertSessionHasErrors(['email' => 'Email sudah dipakai akun lain.']);
});

test('email verification status is unchanged when the email address is unchanged', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch('/profile', ['name' => 'Test User', 'email' => $user->email])
        ->assertSessionHasNoErrors();

    expect($user->refresh()->email_verified_at)->not->toBeNull();
});

test('password_changed_at only moves when the password changes', function () {
    $user = User::factory()->create();
    $first = $user->password_changed_at;

    expect($first)->not->toBeNull();

    $this->travel(2)->hours();
    $user->update(['name' => 'Nama Lain']);
    expect($user->refresh()->password_changed_at->equalTo($first))->toBeTrue();

    $this->actingAs($user)
        ->put('/password', ['current_password' => 'password', 'password' => 'sandi-baru-123', 'password_confirmation' => 'sandi-baru-123'])
        ->assertSessionHasNoErrors();

    expect($user->refresh()->password_changed_at->greaterThan($first))->toBeTrue();
});

test('the password change rejects a wrong current password and a short new password in Indonesian', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put('/password', ['current_password' => 'salah', 'password' => 'abc', 'password_confirmation' => 'abc'])
        ->assertSessionHasErrors(['current_password' => 'Sandi saat ini salah.', 'password' => 'Sandi minimal 8 karakter.']);
});

test('the password change rejects a mismatched confirmation in Indonesian', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put('/password', ['current_password' => 'password', 'password' => 'sandi-baru-123', 'password_confirmation' => 'beda-123456'])
        ->assertSessionHasErrors(['password' => 'Konfirmasi sandi tidak cocok.']);
});

test('users cannot delete their own account', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->delete('/profile', ['password' => 'password'])->assertStatus(405);

    expect($user->fresh())->not->toBeNull();
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `php artisan test --compact tests/Feature/ProfileTest.php`
Expected: FAIL (prop `akun` belum ada, `password_changed_at` belum ada, pesan masih Inggris).

- [ ] **Step 3: Migrasi `password_changed_at`**

```bash
php artisan make:migration add_password_changed_at_to_users_table --table=users --no-interaction
```
Ubah berkas hasilnya (nama harus `2026_10_15_000001_add_password_changed_at_to_users_table.php`; ganti tanggal bila perlu dengan `git mv`) menjadi:
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('password_changed_at')->nullable()->after('password');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('password_changed_at');
        });
    }
};
```

- [ ] **Step 4: Model `User`** — di `app/Models/User.php`:
  - tambahkan di `casts()`: `'password_changed_at' => 'datetime',`
  - tambahkan metode (di atas `unit()`):
```php
    protected static function booted(): void
    {
        static::saving(function (User $user): void {
            if ($user->isDirty('password')) {
                $user->password_changed_at = now();
            }
        });
    }
```

- [ ] **Step 5: `ProfileUpdateRequest`** — ganti isi:
```php
<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProfileUpdateRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($this->user()->id),
            ],
            'current_password' => [
                Rule::requiredIf(fn () => $this->input('email') !== $this->user()->email),
                'nullable',
                'current_password',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama wajib diisi.',
            'name.max' => 'Nama maksimal :max karakter.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.lowercase' => 'Email harus berhuruf kecil.',
            'email.max' => 'Email maksimal :max karakter.',
            'email.unique' => 'Email sudah dipakai akun lain.',
            'current_password.required' => 'Sandi saat ini wajib diisi untuk mengubah email.',
            'current_password.current_password' => 'Sandi saat ini salah.',
        ];
    }
}
```

- [ ] **Step 6: `ProfileController`** — ganti isi:
```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the account page.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user()->loadMissing(['pegawai', 'unit', 'roles']);
        $role = $user->roles->first();

        return Inertia::render('Profile/Edit', [
            'akun' => [
                'nip' => $user->pegawai?->nip,
                'role' => $role?->display_name ?? $role?->name,
                'unit' => $user->unit?->name,
                'cakupan' => $user->resolveUnitScope(),
                'aktif' => (bool) $user->is_active,
                'sandi_diubah' => $user->password_changed_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Update the user's name and email.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $user->fill($request->safe()->only(['name', 'email']));

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        return Redirect::route('profile.edit')->with('success', 'Profil diperbarui.');
    }
}
```

- [ ] **Step 7: `PasswordController`** — ganti isi:
```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class PasswordController extends Controller
{
    /**
     * Update the user's password.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', Password::defaults(), 'confirmed'],
        ], [
            'current_password.required' => 'Sandi saat ini wajib diisi.',
            'current_password.current_password' => 'Sandi saat ini salah.',
            'password.required' => 'Sandi baru wajib diisi.',
            'password.min' => 'Sandi minimal :min karakter.',
            'password.confirmed' => 'Konfirmasi sandi tidak cocok.',
        ]);

        $request->user()->update([
            'password' => Hash::make($validated['password']),
        ]);

        return back()->with('success', 'Kata sandi diperbarui.');
    }
}
```

- [ ] **Step 8: Jalankan migrasi lokal dan tes sampai hijau**

```bash
php artisan migrate --no-interaction
php artisan test --compact tests/Feature/ProfileTest.php
```
Expected: PASS (semua tes ProfileTest).

- [ ] **Step 9: Tipe frontend** — tambahkan di `resources/js/types/index.d.ts` (dekat deklarasi lain):
```ts
export interface ProfileAkun {
    nip: string | null;
    role: string | null;
    unit: string | null;
    cakupan: string;
    aktif: boolean;
    sandi_diubah: string | null;
}
```

- [ ] **Step 10: Komponen bersama** 

`resources/js/Components/InfoRow.tsx`:
```tsx
import { ReactNode } from 'react';

export default function InfoRow({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-3.5">
            <dt className="w-28 shrink-0 text-sm font-medium text-slate-500 sm:w-36">{label}</dt>
            <dd className="min-w-0 flex-1 truncate text-sm text-slate-900">{children}</dd>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
```

`resources/js/Components/FormDialog.tsx`:
```tsx
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { FormEvent, ReactNode } from 'react';

export default function FormDialog({
    title,
    description,
    submitLabel = 'Simpan',
    destructive = false,
    processing,
    onSubmit,
    onClose,
    children,
}: {
    title: string;
    description?: string;
    submitLabel?: string;
    destructive?: boolean;
    processing: boolean;
    onSubmit: () => void;
    onClose: () => void;
    children: ReactNode;
}) {
    const submit = (e: FormEvent) => {
        e.preventDefault();
        onSubmit();
    };

    return (
        <ModalOverlay
            isOpen
            isDismissable={!processing}
            isKeyboardDismissDisabled={processing}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-md">
                <Dialog aria-labelledby="form-dialog-title">
                    <form onSubmit={submit} className="w-full p-6">
                        <h3 id="form-dialog-title" className="text-base font-bold text-slate-900">
                            {title}
                        </h3>
                        {description && <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>}
                        <div className="mt-4 space-y-4">{children}</div>
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <Button color="secondary" size="md" isDisabled={processing} onPress={onClose}>
                                Batal
                            </Button>
                            <Button type="submit" color={destructive ? 'primary-destructive' : 'primary'} size="md" isLoading={processing}>
                                {submitLabel}
                            </Button>
                        </div>
                    </form>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
```

- [ ] **Step 11: Dialog Profil**

`resources/js/Pages/Profile/Partials/EditNameDialog.tsx`:
```tsx
import FormDialog from '@/Components/FormDialog';
import { Input } from '@/Components/ui/base/input/input';
import { useForm } from '@inertiajs/react';

export default function EditNameDialog({ name, email, onClose }: { name: string; email: string; onClose: () => void }) {
    const form = useForm({ name, email });

    return (
        <FormDialog
            title="Ubah nama"
            processing={form.processing}
            onClose={onClose}
            onSubmit={() => form.patch(route('profile.update'), { preserveScroll: true, onSuccess: onClose })}
        >
            <Input
                label="Nama"
                autoFocus
                value={form.data.name}
                onChange={(v) => form.setData('name', v)}
                isInvalid={Boolean(form.errors.name)}
                hint={form.errors.name}
            />
        </FormDialog>
    );
}
```

`resources/js/Pages/Profile/Partials/EditEmailDialog.tsx`:
```tsx
import FormDialog from '@/Components/FormDialog';
import { Input } from '@/Components/ui/base/input/input';
import { useForm } from '@inertiajs/react';

export default function EditEmailDialog({ name, email, onClose }: { name: string; email: string; onClose: () => void }) {
    const form = useForm({ name, email, current_password: '' });

    return (
        <FormDialog
            title="Ubah email"
            description="Email dipakai untuk masuk. Masukkan sandi saat ini untuk mengonfirmasi perubahan."
            processing={form.processing}
            onClose={onClose}
            onSubmit={() =>
                form.patch(route('profile.update'), {
                    preserveScroll: true,
                    onSuccess: onClose,
                    onError: () => form.reset('current_password'),
                })
            }
        >
            <Input
                label="Email baru"
                type="email"
                autoFocus
                value={form.data.email}
                onChange={(v) => form.setData('email', v)}
                isInvalid={Boolean(form.errors.email)}
                hint={form.errors.email}
            />
            <Input
                label="Sandi saat ini"
                type="password"
                value={form.data.current_password}
                onChange={(v) => form.setData('current_password', v)}
                isInvalid={Boolean(form.errors.current_password)}
                hint={form.errors.current_password}
            />
        </FormDialog>
    );
}
```

`resources/js/Pages/Profile/Partials/ChangePasswordDialog.tsx`:
```tsx
import FormDialog from '@/Components/FormDialog';
import { Input } from '@/Components/ui/base/input/input';
import { useForm } from '@inertiajs/react';

export default function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
    const form = useForm({ current_password: '', password: '', password_confirmation: '' });

    return (
        <FormDialog
            title="Ubah kata sandi"
            description="Gunakan sandi yang panjang dan acak agar akun tetap aman."
            processing={form.processing}
            onClose={onClose}
            onSubmit={() =>
                form.put(route('password.update'), {
                    preserveScroll: true,
                    onSuccess: onClose,
                    onError: () => form.reset('password', 'password_confirmation'),
                })
            }
        >
            <Input
                label="Sandi saat ini"
                type="password"
                autoFocus
                value={form.data.current_password}
                onChange={(v) => form.setData('current_password', v)}
                isInvalid={Boolean(form.errors.current_password)}
                hint={form.errors.current_password}
            />
            <Input
                label="Sandi baru"
                type="password"
                value={form.data.password}
                onChange={(v) => form.setData('password', v)}
                isInvalid={Boolean(form.errors.password)}
                hint={form.errors.password}
            />
            <Input
                label="Ulangi sandi baru"
                type="password"
                value={form.data.password_confirmation}
                onChange={(v) => form.setData('password_confirmation', v)}
            />
        </FormDialog>
    );
}
```

- [ ] **Step 12: Kartu dan kepala profil**

`resources/js/Pages/Profile/Partials/ProfileHeader.tsx`:
```tsx
import { Badge } from '@/Components/ui/base/badges/badges';
import { PageProps, ProfileAkun } from '@/types';
import { usePage } from '@inertiajs/react';

const initials = (name: string) =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

export default function ProfileHeader({ akun }: { akun: ProfileAkun }) {
    const user = usePage<PageProps>().props.auth.user;
    const name = user?.name ?? 'Pengguna';

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
            {user?.foto_profile_url ? (
                <img src={user.foto_profile_url} alt={name} className="size-16 shrink-0 rounded-full border border-slate-200 object-cover" />
            ) : (
                <div className="flex size-16 shrink-0 select-none items-center justify-center rounded-full bg-blue-800 text-xl font-bold text-white">
                    {initials(name)}
                </div>
            )}
            <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold text-slate-900">{name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    {akun.role && (
                        <Badge type="color" size="sm" color="blue" className="rounded-sm">
                            {akun.role}
                        </Badge>
                    )}
                    {akun.unit && <span>{akun.unit}</span>}
                    <Badge type="color" size="sm" color={akun.aktif ? 'success' : 'gray'} className="rounded-sm">
                        {akun.aktif ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                </div>
            </div>
        </div>
    );
}
```

`resources/js/Pages/Profile/Partials/AccountInfoCard.tsx`:
```tsx
import InfoRow from '@/Components/InfoRow';
import { UNIT_SCOPE_LABEL } from '@/lib/unitScope';
import { ProfileAkun } from '@/types';

export default function AccountInfoCard({ akun }: { akun: ProfileAkun }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-semibold text-slate-900">Info akun</h2>
            <p className="text-xs text-slate-500">Data ini diatur oleh administrator.</p>
            <dl className="mt-3 divide-y divide-slate-100">
                <InfoRow label="NIP">{akun.nip ?? '—'}</InfoRow>
                <InfoRow label="Role">{akun.role ?? '—'}</InfoRow>
                <InfoRow label="Unit">{akun.unit ?? '—'}</InfoRow>
                <InfoRow label="Cakupan data">{UNIT_SCOPE_LABEL[akun.cakupan] ?? akun.cakupan}</InfoRow>
            </dl>
        </div>
    );
}
```

`resources/js/Pages/Profile/Partials/CredentialsCard.tsx`:
```tsx
import InfoRow from '@/Components/InfoRow';
import { Button } from '@/Components/ui/base/buttons/button';
import { tanggal } from '@/lib/format';
import { PageProps, ProfileAkun } from '@/types';
import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import ChangePasswordDialog from './ChangePasswordDialog';
import EditEmailDialog from './EditEmailDialog';
import EditNameDialog from './EditNameDialog';

type DialogKey = 'nama' | 'email' | 'sandi' | null;

export default function CredentialsCard({ akun }: { akun: ProfileAkun }) {
    const user = usePage<PageProps>().props.auth.user;
    const [dialog, setDialog] = useState<DialogKey>(null);
    const close = () => setDialog(null);
    const name = user?.name ?? '';
    const email = user?.email ?? '';

    const change = (key: DialogKey, label: string) => (
        <Button color="secondary" size="sm" aria-label={`Ubah ${label}`} onPress={() => setDialog(key)}>
            Ubah
        </Button>
    );

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-semibold text-slate-900">Data masuk</h2>
            <p className="text-xs text-slate-500">Nama, email, dan kata sandi yang Anda pakai untuk masuk.</p>
            <dl className="mt-3 divide-y divide-slate-100">
                <InfoRow label="Nama" action={change('nama', 'nama')}>
                    {name}
                </InfoRow>
                <InfoRow label="Email" action={change('email', 'email')}>
                    {email}
                </InfoRow>
                <InfoRow label="Kata sandi" action={change('sandi', 'kata sandi')}>
                    {akun.sandi_diubah ? `Terakhir diubah ${tanggal(akun.sandi_diubah)}` : '••••••••'}
                </InfoRow>
            </dl>

            {dialog === 'nama' && <EditNameDialog name={name} email={email} onClose={close} />}
            {dialog === 'email' && <EditEmailDialog name={name} email={email} onClose={close} />}
            {dialog === 'sandi' && <ChangePasswordDialog onClose={close} />}
        </div>
    );
}
```

- [ ] **Step 13: Halaman `Edit.tsx`** — ganti isi:
```tsx
import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, ProfileAkun } from '@/types';
import { Head } from '@inertiajs/react';
import AccountInfoCard from './Partials/AccountInfoCard';
import CredentialsCard from './Partials/CredentialsCard';
import ProfileHeader from './Partials/ProfileHeader';

export default function Edit({ akun }: PageProps<{ akun: ProfileAkun }>) {
    return (
        <AuthenticatedLayout>
            <Head title="Profil Saya" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Profil' }]} title="Profil Saya" />
                <ProfileHeader akun={akun} />
                <AccountInfoCard akun={akun} />
                <CredentialsCard akun={akun} />
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 14: Hapus form Breeze lama, verifikasi, commit**

```bash
git rm resources/js/Pages/Profile/Partials/UpdateProfileInformationForm.tsx resources/js/Pages/Profile/Partials/UpdatePasswordForm.tsx
npx tsc --noEmit
npm run build 2>&1 | tail -5
vendor/bin/pint --format agent app/Models/User.php app/Http/Requests/ProfileUpdateRequest.php app/Http/Controllers/ProfileController.php app/Http/Controllers/Auth/PasswordController.php tests/Feature/ProfileTest.php database/migrations/2026_10_15_000001_add_password_changed_at_to_users_table.php
php artisan test --compact --filter='Profile|Password'
git add database/migrations/2026_10_15_000001_add_password_changed_at_to_users_table.php app/Models/User.php app/Http/Requests/ProfileUpdateRequest.php app/Http/Controllers/ProfileController.php app/Http/Controllers/Auth/PasswordController.php tests/Feature/ProfileTest.php resources/js/types/index.d.ts resources/js/Components/InfoRow.tsx resources/js/Components/FormDialog.tsx resources/js/Pages/Profile
git commit -m "feat(profile): redesign the profile page with account info and dialog forms"
```
Expected: `tsc` dan build bersih; tes hijau. Periksa `git status`: hanya berkas task ini yang berubah.

- [ ] **Step 15: Cek runtime singkat dan GERBANG TAHAP 1 — berhenti**

Di browser headless (akun demo, password `password`): `/profile` memuat tanpa error; kepala profil, kartu Info akun, kartu Data masuk tampil; tiga tombol Ubah membuka dialog; kirim dialog nama dengan nilai valid mengubah nama tanpa menyimpan data permanen yang merugikan (kembalikan nilai awal) — atau cukup buka-tutup dialog dan kirim dialog sandi kosong untuk melihat galat Indonesia.

Laporkan hasil, lalu minta pengguna menilai: kepala profil, kartu Info akun, baris Data masuk (Ubah → dialog), pesan galat Indonesia pada email tanpa sandi/sandi salah/sandi pendek, pesan sukses (flash) setelah menyimpan, tombol tampilkan-sembunyikan sandi, keyboard/fokus, layar 375 px. **Jangan memulai Task 2** sebelum pengguna menyatakan lolos.

---

### Task 2 (Tahap 2 – Foto profil)

**Files:**
- Create: `database/migrations/2026_10_15_000002_add_foto_profile_to_users_table.php`, `app/Http/Controllers/ProfilePhotoController.php`, `tests/Feature/ProfilePhotoTest.php`, `resources/js/Pages/Profile/Partials/ChangePhotoDialog.tsx`
- Modify: `app/Models/User.php`, `app/Http/Controllers/ProfileController.php`, `routes/web.php` (tambah dua rute; jangan jalankan Pint pada berkas ini), `resources/js/types/index.d.ts`, `resources/js/Pages/Profile/Partials/ProfileHeader.tsx`

**Interfaces:**
- Consumes: Task 1 (`akun`, `ProfileHeader`, `ConfirmDialog` yang sudah ada).
- Produces: `akun.punya_foto: boolean`; rute `profile.photo.store` (POST, field berkas `foto`), `profile.photo.destroy` (DELETE); aksesor `foto_profile_url` memakai foto user lalu cadangan foto Pegawai.

- [ ] **Step 1: Tulis tes yang gagal** — `tests/Feature/ProfilePhotoTest.php`:

```php
<?php

use App\Models\Pegawai;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
});

test('a user can upload a profile photo', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/profile/photo', ['foto' => UploadedFile::fake()->image('saya.jpg')])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $path = $user->refresh()->foto_profile;

    expect($path)->toStartWith('profile-photos/');
    Storage::disk('public')->assertExists($path);
    expect($user->foto_profile_url)->not->toBeNull();
});

test('replacing the photo removes the previous file', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/profile/photo', ['foto' => UploadedFile::fake()->image('a.jpg')]);
    $first = $user->refresh()->foto_profile;

    $this->actingAs($user)->post('/profile/photo', ['foto' => UploadedFile::fake()->image('b.png')]);
    $second = $user->refresh()->foto_profile;

    expect($second)->not->toBe($first);
    Storage::disk('public')->assertMissing($first);
    Storage::disk('public')->assertExists($second);
});

test('the photo can be removed and leaves no file behind', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post('/profile/photo', ['foto' => UploadedFile::fake()->image('a.jpg')]);
    $path = $user->refresh()->foto_profile;

    $this->actingAs($user)->delete('/profile/photo')->assertRedirect();

    expect($user->refresh()->foto_profile)->toBeNull();
    Storage::disk('public')->assertMissing($path);
});

test('a non-image, a wrong format, and an oversized file are rejected in Indonesian', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/profile/photo', ['foto' => UploadedFile::fake()->create('dokumen.pdf', 100, 'application/pdf')])
        ->assertSessionHasErrors('foto');

    $this->actingAs($user)
        ->post('/profile/photo', ['foto' => UploadedFile::fake()->image('animasi.gif')])
        ->assertSessionHasErrors(['foto' => 'Foto harus berformat JPG, PNG, atau WEBP.']);

    $this->actingAs($user)
        ->post('/profile/photo', ['foto' => UploadedFile::fake()->image('besar.jpg')->size(3000)])
        ->assertSessionHasErrors(['foto' => 'Ukuran foto maksimal 2 MB.']);

    expect($user->refresh()->foto_profile)->toBeNull();
});

test('without an own photo the linked pegawai photo is the fallback', function () {
    $user = User::factory()->create();
    Pegawai::factory()->create(['user_id' => $user->id, 'foto_profile' => 'pegawai/foto.jpg']);

    expect($user->refresh()->foto_profile_url)->toContain('pegawai/foto.jpg');

    $this->actingAs($user)->post('/profile/photo', ['foto' => UploadedFile::fake()->image('a.jpg')]);

    expect($user->refresh()->foto_profile_url)->toContain('profile-photos/');
});

test('the profile props tell whether the user has an own photo', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/profile')->assertInertia(fn ($page) => $page->where('akun.punya_foto', false));

    $this->actingAs($user)->post('/profile/photo', ['foto' => UploadedFile::fake()->image('a.jpg')]);

    $this->actingAs($user)->get('/profile')->assertInertia(fn ($page) => $page->where('akun.punya_foto', true));
});
```

- [ ] **Step 2: Jalankan, pastikan gagal** — `php artisan test --compact tests/Feature/ProfilePhotoTest.php` → FAIL (rute/kolom belum ada).

- [ ] **Step 3: Migrasi**

```bash
php artisan make:migration add_foto_profile_to_users_table --table=users --no-interaction
```
Namai `2026_10_15_000002_add_foto_profile_to_users_table.php`, isi:
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('foto_profile')->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('foto_profile');
        });
    }
};
```

- [ ] **Step 4: Model `User`** — tambahkan `'foto_profile'` ke atribut `#[Fillable([...])]`, dan ganti aksesor `fotoProfileUrl`:
```php
    protected function fotoProfileUrl(): Attribute
    {
        return Attribute::make(
            get: function () {
                $path = $this->foto_profile ?: $this->pegawai?->foto_profile;

                return $path ? Storage::disk('public')->url($path) : null;
            }
        );
    }
```

- [ ] **Step 5: Controller foto** — `app/Http/Controllers/ProfilePhotoController.php`:
```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfilePhotoController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $request->validate(
            ['foto' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048']],
            [
                'foto.required' => 'Pilih foto terlebih dahulu.',
                'foto.image' => 'Berkas harus berupa gambar.',
                'foto.mimes' => 'Foto harus berformat JPG, PNG, atau WEBP.',
                'foto.max' => 'Ukuran foto maksimal 2 MB.',
                'foto.uploaded' => 'Foto gagal diunggah. Periksa ukuran dan formatnya.',
            ],
        );

        $user = $request->user();
        $old = $user->foto_profile;

        $user->update(['foto_profile' => $request->file('foto')->store('profile-photos', 'public')]);

        if ($old) {
            Storage::disk('public')->delete($old);
        }

        return back()->with('success', 'Foto profil diperbarui.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->foto_profile) {
            Storage::disk('public')->delete($user->foto_profile);
            $user->update(['foto_profile' => null]);
        }

        return back()->with('success', 'Foto profil dihapus.');
    }
}
```

- [ ] **Step 6: Rute** — di `routes/web.php`, tambahkan impor `use App\Http\Controllers\ProfilePhotoController;` (sisipkan di dekat impor `ProfileController`, edit manual) dan, setelah baris `profile.update`:
```php
    Route::post('/profile/photo', [ProfilePhotoController::class, 'store'])->name('profile.photo.store');
    Route::delete('/profile/photo', [ProfilePhotoController::class, 'destroy'])->name('profile.photo.destroy');
```

- [ ] **Step 7: Prop `punya_foto`** — di `ProfileController::edit`, tambahkan ke array `akun`: `'punya_foto' => filled($user->foto_profile),`.

- [ ] **Step 8: Jalankan tes sampai hijau**

```bash
php artisan test --compact tests/Feature/ProfilePhotoTest.php tests/Feature/ProfileTest.php
```
Expected: PASS.

- [ ] **Step 9: Frontend** — tambahkan `punya_foto: boolean;` ke `ProfileAkun` di `types/index.d.ts`.

`resources/js/Pages/Profile/Partials/ChangePhotoDialog.tsx`:
```tsx
import FormDialog from '@/Components/FormDialog';
import { useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Button } from '@/Components/ui/base/buttons/button';
import { Camera01 } from '@untitledui/icons';
import { FileTrigger } from 'react-aria-components';

export default function ChangePhotoDialog({ onClose }: { onClose: () => void }) {
    const form = useForm<{ foto: File | null }>({ foto: null });
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!form.data.foto) {
            setPreview(null);
            return;
        }
        const url = URL.createObjectURL(form.data.foto);
        setPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [form.data.foto]);

    return (
        <FormDialog
            title="Ganti foto profil"
            description="Format JPG, PNG, atau WEBP, maksimal 2 MB."
            processing={form.processing}
            onClose={onClose}
            onSubmit={() => {
                if (!form.data.foto) return;
                form.post(route('profile.photo.store'), { forceFormData: true, preserveScroll: true, onSuccess: onClose });
            }}
        >
            <div className="flex flex-col items-center gap-3">
                {preview ? (
                    <img src={preview} alt="Pratinjau foto" className="size-28 rounded-full border border-slate-200 object-cover" />
                ) : (
                    <div className="flex size-28 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Camera01 className="size-8" aria-hidden="true" />
                    </div>
                )}
                <FileTrigger acceptedFileTypes={['image/jpeg', 'image/png', 'image/webp']} onSelect={(files) => form.setData('foto', files?.[0] ?? null)}>
                    <Button color="secondary" size="md">
                        Pilih foto
                    </Button>
                </FileTrigger>
                {form.errors.foto && <p className="text-sm text-red-700">{form.errors.foto}</p>}
            </div>
        </FormDialog>
    );
}
```
(Rapikan urutan impor sesuai gaya berkas lain; `tsc` memverifikasi nama ikon.)

`ProfileHeader.tsx` — tambahkan di akhir kolom kanan tombol aksi foto dan dialognya. Ganti isi komponen dengan versi ini (menambah state, `router`, dan dua dialog):
```tsx
import ConfirmDialog from '@/Components/ConfirmDialog';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { PageProps, ProfileAkun } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { Camera01 } from '@untitledui/icons';
import { useState } from 'react';
import ChangePhotoDialog from './ChangePhotoDialog';

const initials = (name: string) =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

export default function ProfileHeader({ akun }: { akun: ProfileAkun }) {
    const user = usePage<PageProps>().props.auth.user;
    const name = user?.name ?? 'Pengguna';
    const [changing, setChanging] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [busy, setBusy] = useState(false);

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
            {user?.foto_profile_url ? (
                <img src={user.foto_profile_url} alt={name} className="size-16 shrink-0 rounded-full border border-slate-200 object-cover" />
            ) : (
                <div className="flex size-16 shrink-0 select-none items-center justify-center rounded-full bg-blue-800 text-xl font-bold text-white">
                    {initials(name)}
                </div>
            )}
            <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold text-slate-900">{name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    {akun.role && (
                        <Badge type="color" size="sm" color="blue" className="rounded-sm">
                            {akun.role}
                        </Badge>
                    )}
                    {akun.unit && <span>{akun.unit}</span>}
                    <Badge type="color" size="sm" color={akun.aktif ? 'success' : 'gray'} className="rounded-sm">
                        {akun.aktif ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button color="secondary" size="md" iconLeading={Camera01} onPress={() => setChanging(true)}>
                    Ganti foto
                </Button>
                {akun.punya_foto && (
                    <Button color="secondary-destructive" size="md" onPress={() => setRemoving(true)}>
                        Hapus foto
                    </Button>
                )}
            </div>

            {changing && <ChangePhotoDialog onClose={() => setChanging(false)} />}
            {removing && (
                <ConfirmDialog
                    title="Hapus foto profil"
                    confirmLabel="Ya, Hapus Foto"
                    isLoading={busy}
                    onConfirm={() => {
                        setBusy(true);
                        router.delete(route('profile.photo.destroy'), {
                            preserveScroll: true,
                            onFinish: () => {
                                setBusy(false);
                                setRemoving(false);
                            },
                        });
                    }}
                    onClose={() => setRemoving(false)}
                >
                    Foto profil akan dihapus. Bila akun terhubung ke data pegawai yang punya foto, foto itulah yang tampil.
                </ConfirmDialog>
            )}
        </div>
    );
}
```

- [ ] **Step 10: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
vendor/bin/pint --format agent app/Models/User.php app/Http/Controllers/ProfilePhotoController.php app/Http/Controllers/ProfileController.php tests/Feature/ProfilePhotoTest.php database/migrations/2026_10_15_000002_add_foto_profile_to_users_table.php
php artisan test --compact --filter='Profile'
git add database/migrations/2026_10_15_000002_add_foto_profile_to_users_table.php app/Models/User.php app/Http/Controllers/ProfilePhotoController.php app/Http/Controllers/ProfileController.php routes/web.php tests/Feature/ProfilePhotoTest.php resources/js/types/index.d.ts resources/js/Pages/Profile
git commit -m "feat(profile): add profile photo upload with a pegawai photo fallback"
```
Expected: bersih; tes hijau.

- [ ] **Step 11: Cek runtime singkat dan GERBANG TAHAP 2 — berhenti**

Cek buka/tutup dialog Ganti foto dan Hapus foto tanpa mengunggah. Minta pengguna menilai: tombol Ganti/Hapus foto, dialog (pratinjau bundar, pilih foto, galat format/ukuran), foto baru tampil di kepala profil **dan** di topbar, hapus kembali ke inisial (atau foto Pegawai), akun super-admin (tanpa data pegawai) bisa punya foto. Catat: `php artisan storage:link` harus sudah ada di server agar foto terlihat. **Jangan memulai Task 3** sebelum lolos.

---

### Task 3 (Tahap 3 – Keamanan sesi)

**Files:**
- Create: `app/Support/SessionDevice.php`, `app/Http/Controllers/ProfileSessionController.php`, `tests/Unit/SessionDeviceTest.php`, `tests/Feature/ProfileSessionTest.php`, `resources/js/Pages/Profile/Partials/{SessionsCard,PasswordConfirmDialog}.tsx`
- Modify: `app/Http/Controllers/ProfileController.php`, `routes/web.php` (dua rute), `bootstrap/app.php` (`trustProxies`), `resources/js/types/index.d.ts`, `resources/js/Pages/Profile/Edit.tsx`

**Interfaces:**
- Consumes: Task 1–2 (`akun`, `Edit.tsx`, `FormDialog`).
- Produces: prop `sessions: ProfileSession[]` (`{ ref: string; perangkat: string; ip: string|null; terakhir_aktif: string; ini: boolean }`); rute `profile.sessions.destroy` (DELETE `/profile/sessions/{ref}`), `profile.sessions.destroy-others` (DELETE `/profile/sessions`); `SessionDevice::label(?string): string`.

- [ ] **Step 1: Tulis tes yang gagal**

`tests/Unit/SessionDeviceTest.php`:
```php
<?php

use App\Support\SessionDevice;

it('describes the browser and operating system', function (string $ua, string $expected) {
    expect(SessionDevice::label($ua))->toBe($expected);
})->with([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', 'Chrome di Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0', 'Edge di Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:109.0) Gecko/20100101 Firefox/121.0', 'Firefox di macOS'],
    ['Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36', 'Chrome di Android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'Safari di iOS'],
]);

it('falls back for an empty or unknown user agent', function () {
    expect(SessionDevice::label(null))->toBe('Perangkat tidak dikenal')
        ->and(SessionDevice::label(''))->toBe('Perangkat tidak dikenal')
        ->and(SessionDevice::label('curl/8.0'))->toBe('Peramban');
});
```

`tests/Feature/ProfileSessionTest.php`:
```php
<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function insertSession(string $id, ?int $userId, string $ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36', string $ip = '10.0.0.5', ?int $last = null): void
{
    DB::table('sessions')->insert([
        'id' => $id,
        'user_id' => $userId,
        'ip_address' => $ip,
        'user_agent' => $ua,
        'payload' => '',
        'last_activity' => $last ?? now()->timestamp,
    ]);
}

test('the profile lists only the sessions of the signed-in user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    insertSession('mine-1', $user->id);
    insertSession('theirs-1', $other->id);

    $this->actingAs($user)->get('/profile')->assertInertia(fn ($page) => $page
        ->has('sessions', 1)
        ->where('sessions.0.perangkat', 'Chrome di Windows')
        ->where('sessions.0.ip', '10.0.0.5')
        ->where('sessions.0.ini', false)
        ->where('sessions.0.ref', hash('sha256', 'mine-1')));
});

test('a single other session can be revoked with the correct password', function () {
    $user = User::factory()->create();
    insertSession('mine-1', $user->id);
    insertSession('mine-2', $user->id);

    $this->actingAs($user)
        ->delete('/profile/sessions/'.hash('sha256', 'mine-1'), ['current_password' => 'password'])
        ->assertSessionHasNoErrors();

    expect(DB::table('sessions')->where('id', 'mine-1')->exists())->toBeFalse()
        ->and(DB::table('sessions')->where('id', 'mine-2')->exists())->toBeTrue();
});

test('a wrong password revokes nothing', function () {
    $user = User::factory()->create();
    insertSession('mine-1', $user->id);

    $this->actingAs($user)
        ->delete('/profile/sessions/'.hash('sha256', 'mine-1'), ['current_password' => 'salah'])
        ->assertSessionHasErrors(['current_password' => 'Sandi saat ini salah.']);

    expect(DB::table('sessions')->where('id', 'mine-1')->exists())->toBeTrue();
});

test('a session of another user cannot be revoked', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    insertSession('theirs-1', $other->id);

    $this->actingAs($user)
        ->delete('/profile/sessions/'.hash('sha256', 'theirs-1'), ['current_password' => 'password'])
        ->assertNotFound();

    expect(DB::table('sessions')->where('id', 'theirs-1')->exists())->toBeTrue();
});

test('the running session is marked, excluded from revocation, and spared by revoke-all', function () {
    $user = User::factory()->create();
    $current = Str::random(40);
    $cookie = config('session.cookie');
    insertSession($current, $user->id);
    insertSession('mine-2', $user->id);

    $this->actingAs($user)->withCookie($cookie, $current)->get('/profile')->assertInertia(fn ($page) => $page
        ->where('sessions', fn ($sessions) => collect($sessions)->firstWhere('ref', hash('sha256', $current))['ini'] === true));

    $this->actingAs($user)->withCookie($cookie, $current)
        ->delete('/profile/sessions/'.hash('sha256', $current), ['current_password' => 'password'])
        ->assertNotFound();

    $this->actingAs($user)->withCookie($cookie, $current)
        ->delete('/profile/sessions', ['current_password' => 'password'])
        ->assertSessionHasNoErrors();

    expect(DB::table('sessions')->where('id', $current)->exists())->toBeTrue()
        ->and(DB::table('sessions')->where('id', 'mine-2')->exists())->toBeFalse();
});

test('revoking all other sessions requires the password and spares other users', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    insertSession('mine-1', $user->id);
    insertSession('theirs-1', $other->id);

    $this->actingAs($user)->delete('/profile/sessions', ['current_password' => 'salah'])->assertSessionHasErrors('current_password');
    expect(DB::table('sessions')->where('id', 'mine-1')->exists())->toBeTrue();

    $this->actingAs($user)->delete('/profile/sessions', ['current_password' => 'password'])->assertSessionHasNoErrors();

    expect(DB::table('sessions')->where('id', 'mine-1')->exists())->toBeFalse()
        ->and(DB::table('sessions')->where('id', 'theirs-1')->exists())->toBeTrue();
});
```
Catatan: id sesi yang dipakai request di tes ditentukan lewat cookie sesi (`withCookie`) dengan id 40 karakter; `startSession()` tidak menjamin id yang sama.

- [ ] **Step 2: Jalankan, pastikan gagal** — `php artisan test --compact tests/Unit/SessionDeviceTest.php tests/Feature/ProfileSessionTest.php` → FAIL.

- [ ] **Step 3: `SessionDevice`** — `app/Support/SessionDevice.php`:
```php
<?php

namespace App\Support;

class SessionDevice
{
    public static function label(?string $userAgent): string
    {
        if (blank($userAgent)) {
            return 'Perangkat tidak dikenal';
        }

        $browser = match (true) {
            str_contains($userAgent, 'Edg/') => 'Edge',
            str_contains($userAgent, 'OPR/') || str_contains($userAgent, 'Opera') => 'Opera',
            str_contains($userAgent, 'Firefox/') => 'Firefox',
            str_contains($userAgent, 'Chrome/') => 'Chrome',
            str_contains($userAgent, 'Safari/') => 'Safari',
            default => 'Peramban',
        };

        $os = match (true) {
            str_contains($userAgent, 'Windows') => 'Windows',
            str_contains($userAgent, 'Android') => 'Android',
            str_contains($userAgent, 'iPhone') || str_contains($userAgent, 'iPad') => 'iOS',
            str_contains($userAgent, 'Mac OS X') || str_contains($userAgent, 'Macintosh') => 'macOS',
            str_contains($userAgent, 'Linux') => 'Linux',
            default => null,
        };

        return $os ? "{$browser} di {$os}" : $browser;
    }
}
```

- [ ] **Step 4: Controller cabut sesi** — `app/Http/Controllers/ProfileSessionController.php`:
```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProfileSessionController extends Controller
{
    public function destroy(Request $request, string $ref): RedirectResponse
    {
        $this->confirmPassword($request);

        $current = $request->session()->getId();

        $session = DB::table('sessions')
            ->where('user_id', $request->user()->id)
            ->where('id', '!=', $current)
            ->get(['id'])
            ->first(fn ($row) => hash_equals(hash('sha256', $row->id), $ref));

        abort_if($session === null, 404);

        DB::table('sessions')->where('id', $session->id)->delete();

        return back()->with('success', 'Sesi dikeluarkan.');
    }

    public function destroyOthers(Request $request): RedirectResponse
    {
        $this->confirmPassword($request);

        DB::table('sessions')
            ->where('user_id', $request->user()->id)
            ->where('id', '!=', $request->session()->getId())
            ->delete();

        return back()->with('success', 'Semua perangkat lain telah dikeluarkan.');
    }

    private function confirmPassword(Request $request): void
    {
        $request->validate(
            ['current_password' => ['required', 'current_password']],
            [
                'current_password.required' => 'Sandi saat ini wajib diisi.',
                'current_password.current_password' => 'Sandi saat ini salah.',
            ],
        );
    }
}
```

- [ ] **Step 5: Rute** — di `routes/web.php` tambahkan impor `use App\Http\Controllers\ProfileSessionController;` dan, setelah rute foto:
```php
    Route::delete('/profile/sessions', [ProfileSessionController::class, 'destroyOthers'])->name('profile.sessions.destroy-others');
    Route::delete('/profile/sessions/{ref}', [ProfileSessionController::class, 'destroy'])->name('profile.sessions.destroy');
```

- [ ] **Step 6: Prop `sessions`** — di `ProfileController`, tambahkan impor `use App\Support\SessionDevice;`, `use Illuminate\Support\Carbon;`, `use Illuminate\Support\Facades\DB;` dan di `edit()` ke array render:
```php
            'sessions' => DB::table('sessions')
                ->where('user_id', $user->id)
                ->orderByDesc('last_activity')
                ->get()
                ->map(fn ($s) => [
                    'ref' => hash('sha256', $s->id),
                    'perangkat' => SessionDevice::label($s->user_agent),
                    'ip' => $s->ip_address,
                    'terakhir_aktif' => Carbon::createFromTimestamp($s->last_activity)->toIso8601String(),
                    'ini' => $s->id === $request->session()->getId(),
                ])
                ->values(),
```

- [ ] **Step 7: Percayai IP klien hanya dari proxy privat** — tulis dulu `tests/Feature/TrustedProxyTest.php` (tiga tes: rantai `X-Forwarded-For` dari proxy privat menghasilkan alamat tak-terpercaya pertama dari kanan; header dari alamat publik diabaikan; `X-Forwarded-Host` tidak pernah dipercaya) dan pastikan gagal terhadap konfigurasi lama. Lalu di `bootstrap/app.php` ganti baris `trustProxies`:
```php
        // Hanya proxy di jaringan privat (nginx/cloudflared di Docker, host, loopback) yang dipercaya, dan hanya
        // header IP + protokol. X-Forwarded-Host/Port sengaja tidak dipercaya agar Host tidak bisa dipalsukan.
        $middleware->trustProxies(
            at: ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
            headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO,
        );
```
Alasan: `at: '*'` bersama header `X-Forwarded-For` membuat bagian kiri rantai (yang bisa dikirim klien) terbaca sebagai IP klien; itu memalsukan log IP **dan** melewati throttle login yang memakai `$request->ip()`. Catat di laporan: IP asli di produksi tetap harus diverifikasi (nginx dan cloudflared harus terhubung dari alamat privat; bila tidak, IP yang tampil adalah alamat proxy dan itu aman tetapi kurang informatif).

- [ ] **Step 8: Jalankan tes sampai hijau**

```bash
php artisan test --compact tests/Unit/SessionDeviceTest.php tests/Feature/ProfileSessionTest.php
php artisan test --compact --filter='Profile|Auth'
```
Expected: PASS (termasuk tes autentikasi yang sudah ada).

- [ ] **Step 9: Frontend**

Tambahkan di `types/index.d.ts`:
```ts
export interface ProfileSession {
    ref: string;
    perangkat: string;
    ip: string | null;
    terakhir_aktif: string;
    ini: boolean;
}
```

`resources/js/Pages/Profile/Partials/PasswordConfirmDialog.tsx`:
```tsx
import FormDialog from '@/Components/FormDialog';
import { Input } from '@/Components/ui/base/input/input';
import { useForm } from '@inertiajs/react';

export default function PasswordConfirmDialog({
    title,
    description,
    submitLabel,
    url,
    onClose,
}: {
    title: string;
    description: string;
    submitLabel: string;
    url: string;
    onClose: () => void;
}) {
    const form = useForm({ current_password: '' });

    return (
        <FormDialog
            title={title}
            description={description}
            submitLabel={submitLabel}
            destructive
            processing={form.processing}
            onClose={onClose}
            onSubmit={() => form.delete(url, { preserveScroll: true, onSuccess: onClose, onError: () => form.reset('current_password') })}
        >
            <Input
                label="Sandi saat ini"
                type="password"
                autoFocus
                value={form.data.current_password}
                onChange={(v) => form.setData('current_password', v)}
                isInvalid={Boolean(form.errors.current_password)}
                hint={form.errors.current_password}
            />
        </FormDialog>
    );
}
```

`resources/js/Pages/Profile/Partials/SessionsCard.tsx`:
```tsx
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { tanggalWaktu } from '@/lib/format';
import { ProfileSession } from '@/types';
import { Monitor01 } from '@untitledui/icons';
import { useState } from 'react';
import PasswordConfirmDialog from './PasswordConfirmDialog';

export default function SessionsCard({ sessions }: { sessions: ProfileSession[] }) {
    const [target, setTarget] = useState<ProfileSession | 'semua' | null>(null);
    const others = sessions.filter((s) => !s.ini);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">Sesi aktif</h2>
                    <p className="text-xs text-slate-500">Perangkat yang sedang masuk ke akun Anda.</p>
                </div>
                {others.length > 0 && (
                    <Button color="secondary-destructive" size="md" onPress={() => setTarget('semua')}>
                        Keluar dari semua perangkat lain
                    </Button>
                )}
            </div>

            <ul className="mt-3 divide-y divide-slate-100">
                {sessions.length === 0 && <li className="py-6 text-center text-sm text-slate-400">Tidak ada sesi tercatat.</li>}
                {sessions.map((s) => (
                    <li key={s.ref} className="flex items-center gap-4 py-3.5">
                        <Monitor01 className="size-6 shrink-0 text-slate-400" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                                {s.perangkat}
                                {s.ini && (
                                    <Badge type="color" size="sm" color="success" className="rounded-sm">
                                        Perangkat ini
                                    </Badge>
                                )}
                            </p>
                            <p className="text-xs text-slate-500">
                                {s.ip ?? 'IP tidak diketahui'} · Aktif terakhir {tanggalWaktu(s.terakhir_aktif)}
                            </p>
                        </div>
                        {!s.ini && (
                            <Button color="secondary-destructive" size="sm" aria-label={`Keluarkan ${s.perangkat}`} onPress={() => setTarget(s)}>
                                Keluarkan
                            </Button>
                        )}
                    </li>
                ))}
            </ul>

            {target === 'semua' && (
                <PasswordConfirmDialog
                    title="Keluar dari semua perangkat lain"
                    description="Semua sesi selain perangkat ini akan diakhiri. Masukkan sandi saat ini untuk melanjutkan."
                    submitLabel="Ya, Keluarkan Semua"
                    url={route('profile.sessions.destroy-others')}
                    onClose={() => setTarget(null)}
                />
            )}
            {target && target !== 'semua' && (
                <PasswordConfirmDialog
                    title="Keluarkan sesi"
                    description={`Sesi ${target.perangkat} akan diakhiri. Masukkan sandi saat ini untuk melanjutkan.`}
                    submitLabel="Ya, Keluarkan"
                    url={route('profile.sessions.destroy', target.ref)}
                    onClose={() => setTarget(null)}
                />
            )}
        </div>
    );
}
```

`Edit.tsx` — ganti isi (bilah tab muncul):
```tsx
import PageHeader from '@/Components/PageHeader';
import { Tabs } from '@/Components/ui/application/tabs/tabs';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, ProfileAkun, ProfileSession } from '@/types';
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import AccountInfoCard from './Partials/AccountInfoCard';
import CredentialsCard from './Partials/CredentialsCard';
import ProfileHeader from './Partials/ProfileHeader';
import SessionsCard from './Partials/SessionsCard';

export default function Edit({ akun, sessions }: PageProps<{ akun: ProfileAkun; sessions: ProfileSession[] }>) {
    const [tab, setTab] = useState('akun');

    return (
        <AuthenticatedLayout>
            <Head title="Profil Saya" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Profil' }]} title="Profil Saya" />
                <ProfileHeader akun={akun} />

                <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))} keyboardActivation="automatic">
                    <Tabs.List type="underline" size="md" aria-label="Bagian profil">
                        <Tabs.Item id="akun" label="Akun" />
                        <Tabs.Item id="keamanan" label="Keamanan" />
                    </Tabs.List>

                    <Tabs.Panel id="akun" className="space-y-6 pt-6">
                        <AccountInfoCard akun={akun} />
                        <CredentialsCard akun={akun} />
                    </Tabs.Panel>
                    <Tabs.Panel id="keamanan" className="space-y-6 pt-6">
                        <SessionsCard sessions={sessions} />
                    </Tabs.Panel>
                </Tabs>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 10: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
vendor/bin/pint --format agent app/Support/SessionDevice.php app/Http/Controllers/ProfileSessionController.php app/Http/Controllers/ProfileController.php tests/Unit/SessionDeviceTest.php tests/Feature/ProfileSessionTest.php bootstrap/app.php
php artisan test --compact --filter='Profile|Session|Auth'
git add app/Support/SessionDevice.php app/Http/Controllers/ProfileSessionController.php app/Http/Controllers/ProfileController.php routes/web.php bootstrap/app.php tests/Unit/SessionDeviceTest.php tests/Feature/ProfileSessionTest.php resources/js/types/index.d.ts resources/js/Pages/Profile
git commit -m "feat(profile): add the security tab with active sessions and revocation"
```
Expected: bersih; tes hijau.

- [ ] **Step 11: Cek runtime singkat dan GERBANG TAHAP 3 — berhenti**

Cek tab Keamanan memuat, sesi berjalan berbadge "Perangkat ini", dialog sandi terbuka (jangan mencabut sesi nyata milik pengguna). Laporkan juga IP yang tampil di daftar (di lingkungan lokal) dan ingatkan bahwa pengecekan IP asli perlu dilakukan di produksi. Minta pengguna menilai: tab Akun/Keamanan, daftar sesi (perangkat, IP, waktu), tombol Keluarkan dan Keluar dari semua perangkat lain beserta dialog sandi dan galatnya, serta mencoba login dari peramban lain lalu mengeluarkannya. **Jangan memulai Task 4** sebelum lolos.

---

### Task 4 (Tahap 4 – Riwayat aktivitas)

**Files:**
- Create: `database/migrations/2026_10_15_000003_create_login_logs_table.php`, `app/Models/LoginLog.php`, `app/Support/LoginActivityRecorder.php`, `app/Services/ActivityFeed.php`, `tests/Feature/LoginLogTest.php`, `tests/Feature/ActivityFeedTest.php`, `resources/js/Pages/Profile/Partials/ActivityTab.tsx`
- Modify: `app/Providers/AppServiceProvider.php`, `routes/console.php`, `app/Http/Controllers/ProfileController.php`, `resources/js/types/index.d.ts`, `resources/js/Pages/Profile/Edit.tsx`

**Interfaces:**
- Consumes: Task 3 (`Edit.tsx` dengan tab, `SessionDevice`).
- Produces: prop opsional `aktivitas: Paginated<ActivityEntry>` (dimuat dengan `router.reload({ only: ['aktivitas'], data: { filter, halaman } })`); `ActivityEntry` = `{ id: string; tipe: 'pekerjaan'|'login'; judul: string; keterangan: string|null; waktu: string; url: string|null; hasil: 'berhasil'|'gagal'|'keluar'|null }`; `ActivityFeed::paginate(User, 'semua'|'pekerjaan'|'login', int $page): LengthAwarePaginator`.

- [ ] **Step 1: Tulis tes yang gagal**

`tests/Feature/LoginLogTest.php`:
```php
<?php

use App\Models\LoginLog;
use App\Models\User;

test('a successful login, a failed attempt, and a logout are recorded', function () {
    $user = User::factory()->create(['email' => 'budi@example.com']);

    $this->post('/login', ['email' => 'budi@example.com', 'password' => 'password'])->assertRedirect();
    $this->post('/logout');
    $this->post('/login', ['email' => 'budi@example.com', 'password' => 'salah']);

    expect(LoginLog::where('user_id', $user->id)->pluck('event')->all())->toEqual(['login', 'logout', 'gagal']);
    expect(LoginLog::where('event', 'login')->first()->identifier)->toBe('budi@example.com');
});

test('a failed attempt for an unknown account is recorded without a user', function () {
    $this->post('/login', ['email' => 'tidak-ada@example.com', 'password' => 'apa-saja']);

    $log = LoginLog::first();

    expect($log->user_id)->toBeNull()
        ->and($log->event)->toBe('gagal')
        ->and($log->identifier)->toBe('tidak-ada@example.com');
});

test('login logs older than 90 days are pruned', function () {
    $user = User::factory()->create();
    $old = LoginLog::create(['user_id' => $user->id, 'identifier' => 'x', 'event' => 'login', 'ip_address' => '1.1.1.1']);
    $old->forceFill(['created_at' => now()->subDays(91)])->save();
    $recent = LoginLog::create(['user_id' => $user->id, 'identifier' => 'x', 'event' => 'login', 'ip_address' => '1.1.1.1']);

    $this->artisan('model:prune', ['--model' => [LoginLog::class]])->assertSuccessful();

    expect(LoginLog::pluck('id')->all())->toEqual([$recent->id]);
});
```

`tests/Feature/ActivityFeedTest.php`:
```php
<?php

use App\Models\LoginLog;
use App\Models\Pegawai;
use App\Models\User;
use App\Services\ActivityFeed;

function loginLog(User $user, string $event, $at): LoginLog
{
    $log = LoginLog::create(['user_id' => $user->id, 'identifier' => $user->email, 'event' => $event, 'ip_address' => '10.0.0.5', 'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36']);
    $log->forceFill(['created_at' => $at])->save();

    return $log;
}

test('login entries are listed newest first and only for the user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    loginLog($user, 'login', now()->subHours(3));
    loginLog($user, 'gagal', now()->subHour());
    loginLog($other, 'login', now());

    $page = app(ActivityFeed::class)->paginate($user, 'semua', 1);

    expect($page->total())->toBe(2)
        ->and(collect($page->items())->pluck('hasil')->all())->toEqual(['gagal', 'berhasil'])
        ->and(collect($page->items())->first()['judul'])->toBe('Login gagal')
        ->and(collect($page->items())->first()['keterangan'])->toBe('Chrome di Windows · 10.0.0.5');
});

test('filters separate work activity from logins', function () {
    $user = User::factory()->create();
    loginLog($user, 'login', now());

    expect(app(ActivityFeed::class)->paginate($user, 'login', 1)->total())->toBe(1)
        ->and(app(ActivityFeed::class)->paginate($user, 'pekerjaan', 1)->total())->toBe(0);
});

test('a page beyond the range is empty instead of failing', function () {
    $user = User::factory()->create();
    loginLog($user, 'login', now());

    $page = app(ActivityFeed::class)->paginate($user, 'semua', 9);

    expect($page->items())->toBe([])->and($page->total())->toBe(1);
});

test('it paginates fifteen entries per page across sources', function () {
    $user = User::factory()->create();
    foreach (range(1, 20) as $i) {
        loginLog($user, 'login', now()->subMinutes($i));
    }

    $first = app(ActivityFeed::class)->paginate($user, 'semua', 1);
    $second = app(ActivityFeed::class)->paginate($user, 'semua', 2);

    expect($first->items())->toHaveCount(15)->and($second->items())->toHaveCount(5)->and($first->total())->toBe(20);
});

test('the account page loads the activity lazily and keeps working for a minimal account', function () {
    $user = User::factory()->create();
    loginLog($user, 'login', now());

    $this->actingAs($user)->get('/profile')->assertOk()->assertInertia(fn ($page) => $page->missing('aktivitas'));

    $this->actingAs($user)
        ->get('/profile?filter=login&halaman=1')
        ->assertInertia(fn ($page) => $page->reloadOnly('aktivitas', fn ($reload) => $reload->where('aktivitas.total', 1)));
});
```

Tambahkan pula tes pekerjaan di berkas yang sama (impor tambahan di bagian atas berkas: `App\Models\AssetCategory`, `App\Models\BeritaAcaraPenerimaan`, `App\Services\ApprovalWorkflowService`, `Database\Seeders\WorkflowDefinitionSeeder`, `Spatie\Permission\Models\Role`):
```php
function submittedPenerimaan(): array
{
    foreach (['admin_kecamatan', 'kasubag', 'camat'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $kec = makeKecamatan();
    $pengaju = userWithRole('admin_kecamatan', $kec);
    $approver = userWithRole('kasubag');
    $category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
    $workflow = app(ApprovalWorkflowService::class);

    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/P/'.uniqid(), 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/P', 'unit_id' => $kec->id,
        'created_by' => $pengaju->id, 'status' => 'submitted',
    ]);
    $ba->items()->create([
        'nama_aset' => 'Printer', 'category_id' => $category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 1000000, 'kondisi_awal' => 'baik',
    ]);
    $workflow->submit($ba, 'penerimaan_aset', $pengaju);
    $workflow->approve($ba->fresh()->approvalRequest, $approver);

    return [$ba->fresh(), $pengaju, $approver];
}

test('submitted requests and approval actions of the user appear as work activity', function () {
    [$ba, $pengaju, $approver] = submittedPenerimaan();

    $pengajuEntries = collect(app(ActivityFeed::class)->paginate($pengaju, 'pekerjaan', 1)->items());
    $approverEntries = collect(app(ActivityFeed::class)->paginate($approver, 'pekerjaan', 1)->items());

    expect($pengajuEntries)->toHaveCount(1)
        ->and($pengajuEntries->first()['judul'])->toStartWith('Mengajukan ')
        ->and($pengajuEntries->first()['url'])->toBe($ba->approvalShowUrl())
        ->and($approverEntries)->toHaveCount(1)
        ->and($approverEntries->first()['judul'])->toStartWith('Menyetujui ')
        ->and($approverEntries->first()['tipe'])->toBe('pekerjaan');
});

test('a request whose document was deleted is skipped without failing', function () {
    [$ba, $pengaju] = submittedPenerimaan();

    $ba->items()->delete();
    $ba->delete();

    $page = app(ActivityFeed::class)->paginate($pengaju, 'pekerjaan', 1);

    expect($page->items())->toBe([]);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal** — `php artisan test --compact tests/Feature/LoginLogTest.php tests/Feature/ActivityFeedTest.php` → FAIL.

- [ ] **Step 3: Migrasi dan model**

```bash
php artisan make:migration create_login_logs_table --no-interaction
```
Namai `2026_10_15_000003_create_login_logs_table.php`:
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('identifier');
            $table->string('event', 10);
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_logs');
    }
};
```

`app/Models/LoginLog.php`:
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\MassPrunable;

class LoginLog extends Model
{
    use MassPrunable;

    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'identifier', 'event', 'ip_address', 'user_agent'];

    public function prunable(): Builder
    {
        return static::where('created_at', '<', now()->subDays(90));
    }
}
```

- [ ] **Step 4: Perekam login** — `app/Support/LoginActivityRecorder.php`:
```php
<?php

namespace App\Support;

use App\Models\LoginLog;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;

class LoginActivityRecorder
{
    public function login(Login $event): void
    {
        $this->record($event->user->getAuthIdentifier(), 'login');
    }

    public function failed(Failed $event): void
    {
        $this->record($event->user?->getAuthIdentifier(), 'gagal');
    }

    public function logout(Logout $event): void
    {
        if ($event->user !== null) {
            $this->record($event->user->getAuthIdentifier(), 'logout');
        }
    }

    private function record(int|string|null $userId, string $event): void
    {
        $request = request();

        LoginLog::create([
            'user_id' => $userId,
            'identifier' => (string) $request->input('email', ''),
            'event' => $event,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }
}
```
Daftarkan **secara eksplisit** di `AppServiceProvider::boot()` (kelas ini sengaja di luar `app/Listeners` agar tidak ikut penemuan otomatis dan tercatat ganda):
```php
        Event::listen(Login::class, [LoginActivityRecorder::class, 'login']);
        Event::listen(Failed::class, [LoginActivityRecorder::class, 'failed']);
        Event::listen(Logout::class, [LoginActivityRecorder::class, 'logout']);
```
dengan impor `Illuminate\Auth\Events\{Failed,Login,Logout}`, `Illuminate\Support\Facades\Event`, dan `App\Support\LoginActivityRecorder`.

Jadwal pangkas di `routes/console.php`:
```php
Schedule::command('model:prune', ['--model' => [LoginLog::class]])->daily();
```
dengan `use App\Models\LoginLog;`.

- [ ] **Step 5: `ActivityFeed`** — `app/Services/ActivityFeed.php`:
```php
<?php

namespace App\Services;

use App\Models\ApprovalAction;
use App\Models\ApprovalRequest;
use App\Models\LoginLog;
use App\Models\User;
use App\Support\SessionDevice;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ActivityFeed
{
    public const PER_PAGE = 15;

    public function paginate(User $user, string $filter, int $page): LengthAwarePaginator
    {
        $page = max(1, $page);
        $limit = $page * self::PER_PAGE;
        $entries = collect();
        $total = 0;

        if ($filter !== 'login') {
            $total += ApprovalRequest::where('created_by', $user->id)->count();
            $total += ApprovalAction::where('user_id', $user->id)->count();
            $entries = $entries->merge($this->requestEntries($user, $limit))->merge($this->actionEntries($user, $limit));
        }

        if ($filter !== 'pekerjaan') {
            $total += LoginLog::where('user_id', $user->id)->count();
            $entries = $entries->merge($this->loginEntries($user, $limit));
        }

        $items = $entries
            ->sortByDesc(fn (array $e) => $e['waktu'])
            ->slice(($page - 1) * self::PER_PAGE, self::PER_PAGE)
            ->values()
            ->all();

        return new LengthAwarePaginator($items, $total, self::PER_PAGE, $page);
    }

    /** @return Collection<int, array<string, mixed>> */
    private function requestEntries(User $user, int $limit): Collection
    {
        return ApprovalRequest::with('approvable')
            ->where('created_by', $user->id)
            ->latest()
            ->limit($limit)
            ->get()
            ->filter(fn (ApprovalRequest $r) => $r->approvable !== null)
            ->map(fn (ApprovalRequest $r) => $this->entry(
                "pengajuan-{$r->id}",
                'pekerjaan',
                'Mengajukan '.$r->approvable->approvalTitle(),
                null,
                $r->created_at,
                $r->approvable->approvalShowUrl(),
                null,
            ));
    }

    /** @return Collection<int, array<string, mixed>> */
    private function actionEntries(User $user, int $limit): Collection
    {
        return ApprovalAction::with('request.approvable')
            ->where('user_id', $user->id)
            ->latest()
            ->limit($limit)
            ->get()
            ->filter(fn (ApprovalAction $a) => $a->request?->approvable !== null)
            ->map(fn (ApprovalAction $a) => $this->entry(
                "aksi-{$a->id}",
                'pekerjaan',
                $a->action->label().' '.$a->request->approvable->approvalTitle(),
                $a->note,
                $a->created_at,
                $a->request->approvable->approvalShowUrl(),
                null,
            ));
    }

    /** @return Collection<int, array<string, mixed>> */
    private function loginEntries(User $user, int $limit): Collection
    {
        return LoginLog::where('user_id', $user->id)
            ->latest('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (LoginLog $l) => $this->entry(
                "login-{$l->id}",
                'login',
                match ($l->event) {
                    'login' => 'Login berhasil',
                    'gagal' => 'Login gagal',
                    default => 'Keluar dari sistem',
                },
                SessionDevice::label($l->user_agent).($l->ip_address ? " · {$l->ip_address}" : ''),
                $l->created_at,
                null,
                match ($l->event) {
                    'login' => 'berhasil',
                    'gagal' => 'gagal',
                    default => 'keluar',
                },
            ));
    }

    /** @return array<string, mixed> */
    private function entry(string $id, string $tipe, string $judul, ?string $keterangan, ?Carbon $waktu, ?string $url, ?string $hasil): array
    {
        return [
            'id' => $id,
            'tipe' => $tipe,
            'judul' => $judul,
            'keterangan' => $keterangan,
            'waktu' => $waktu?->toIso8601String() ?? '',
            'url' => $url,
            'hasil' => $hasil,
        ];
    }
}
```

- [ ] **Step 6: Prop lazy di `ProfileController::edit`** — impor `use App\Services\ActivityFeed;`; tambahkan ke array render:
```php
            'aktivitas' => Inertia::optional(fn () => app(ActivityFeed::class)->paginate(
                $user,
                in_array($request->query('filter'), ['pekerjaan', 'login'], true) ? $request->query('filter') : 'semua',
                max(1, (int) $request->query('halaman', 1)),
            )),
```

- [ ] **Step 7: Jalankan migrasi lokal dan tes sampai hijau**

```bash
php artisan migrate --no-interaction
php artisan test --compact tests/Feature/LoginLogTest.php tests/Feature/ActivityFeedTest.php
php artisan test --compact --filter='Auth|Profile|Login'
```
Expected: PASS. Jika tes login mengungkap urutan event berbeda (mis. `Failed` tidak punya `user` untuk akun tak dikenal), sesuaikan asersi tes ke perilaku Laravel yang nyata **tanpa** melonggarkan jaminan "akun tak dikenal tercatat dengan user_id kosong".

- [ ] **Step 8: Frontend**

Tambahkan di `types/index.d.ts`:
```ts
export interface ActivityEntry {
    id: string;
    tipe: 'pekerjaan' | 'login';
    judul: string;
    keterangan: string | null;
    waktu: string;
    url: string | null;
    hasil: 'berhasil' | 'gagal' | 'keluar' | null;
}
```

`resources/js/Pages/Profile/Partials/ActivityTab.tsx`:
```tsx
import { PaginationPageDefault } from '@/Components/ui/application/pagination/pagination';
import { Tabs } from '@/Components/ui/application/tabs/tabs';
import { tanggalWaktu } from '@/lib/format';
import { ActivityEntry, Paginated } from '@/types';
import { Link, router } from '@inertiajs/react';
import { AlertTriangle, FileCheck02, LogIn01, LogOut01 } from '@untitledui/icons';
import { useEffect, useState } from 'react';

type Filter = 'semua' | 'pekerjaan' | 'login';

const FILTERS: { key: Filter; label: string }[] = [
    { key: 'semua', label: 'Semua' },
    { key: 'pekerjaan', label: 'Pekerjaan' },
    { key: 'login', label: 'Login' },
];

function EntryIcon({ entry }: { entry: ActivityEntry }) {
    const common = 'size-5';
    if (entry.tipe === 'pekerjaan') return <FileCheck02 className={`${common} text-blue-700`} aria-hidden="true" />;
    if (entry.hasil === 'gagal') return <AlertTriangle className={`${common} text-red-600`} aria-hidden="true" />;
    if (entry.hasil === 'keluar') return <LogOut01 className={`${common} text-slate-500`} aria-hidden="true" />;

    return <LogIn01 className={`${common} text-emerald-600`} aria-hidden="true" />;
}

export default function ActivityTab({ aktivitas }: { aktivitas?: Paginated<ActivityEntry> }) {
    const [filter, setFilter] = useState<Filter>('semua');
    const [loading, setLoading] = useState(false);

    const load = (nextFilter: Filter, halaman: number) => {
        setLoading(true);
        router.reload({
            only: ['aktivitas'],
            data: { filter: nextFilter, halaman },
            replace: true,
            onFinish: () => setLoading(false),
        });
    };

    useEffect(() => {
        if (!aktivitas) load('semua', 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">Riwayat aktivitas</h2>
                    <p className="text-xs text-slate-500">Tindakan kerja dan catatan login akun Anda.</p>
                </div>
                <Tabs
                    selectedKey={filter}
                    onSelectionChange={(key) => {
                        const next = String(key) as Filter;
                        setFilter(next);
                        load(next, 1);
                    }}
                    keyboardActivation="automatic"
                    className="w-auto"
                >
                    <Tabs.List type="button-border" size="sm" aria-label="Saring riwayat">
                        {FILTERS.map((f) => (
                            <Tabs.Item key={f.key} id={f.key} label={f.label} />
                        ))}
                    </Tabs.List>
                </Tabs>
            </div>

            {!aktivitas ? (
                <ul className="mt-4 space-y-3" aria-busy="true">
                    {[0, 1, 2, 3].map((i) => (
                        <li key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                    ))}
                </ul>
            ) : aktivitas.data.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Belum ada aktivitas.</p>
            ) : (
                <ul className={`mt-4 divide-y divide-slate-100 ${loading ? 'opacity-60' : ''}`}>
                    {aktivitas.data.map((e) => (
                        <li key={e.id} className="flex items-start gap-3 py-3">
                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                                <EntryIcon entry={e} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900">
                                    {e.url ? (
                                        <Link href={e.url} className="text-blue-700 hover:underline">
                                            {e.judul}
                                        </Link>
                                    ) : (
                                        e.judul
                                    )}
                                </p>
                                {e.keterangan && <p className="text-xs text-slate-500">{e.keterangan}</p>}
                            </div>
                            <time dateTime={e.waktu} className="shrink-0 text-xs tabular-nums text-slate-500">
                                {tanggalWaktu(e.waktu)}
                            </time>
                        </li>
                    ))}
                </ul>
            )}

            {aktivitas && aktivitas.last_page > 1 && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                    <PaginationPageDefault
                        className="border-t-0 pt-0 md:pt-0"
                        page={aktivitas.current_page}
                        total={aktivitas.last_page}
                        onPageChange={(page) => load(filter, page)}
                    />
                </div>
            )}
        </div>
    );
}
```

`Edit.tsx` — ganti isi (tab Aktivitas ditambahkan):
```tsx
import PageHeader from '@/Components/PageHeader';
import { Tabs } from '@/Components/ui/application/tabs/tabs';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ActivityEntry, PageProps, Paginated, ProfileAkun, ProfileSession } from '@/types';
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import AccountInfoCard from './Partials/AccountInfoCard';
import ActivityTab from './Partials/ActivityTab';
import CredentialsCard from './Partials/CredentialsCard';
import ProfileHeader from './Partials/ProfileHeader';
import SessionsCard from './Partials/SessionsCard';

export default function Edit({
    akun,
    sessions,
    aktivitas,
}: PageProps<{ akun: ProfileAkun; sessions: ProfileSession[]; aktivitas?: Paginated<ActivityEntry> }>) {
    const [tab, setTab] = useState('akun');

    return (
        <AuthenticatedLayout>
            <Head title="Profil Saya" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Profil' }]} title="Profil Saya" />
                <ProfileHeader akun={akun} />

                <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))} keyboardActivation="automatic">
                    <Tabs.List type="underline" size="md" aria-label="Bagian profil">
                        <Tabs.Item id="akun" label="Akun" />
                        <Tabs.Item id="keamanan" label="Keamanan" />
                        <Tabs.Item id="aktivitas" label="Aktivitas" />
                    </Tabs.List>

                    <Tabs.Panel id="akun" className="space-y-6 pt-6">
                        <AccountInfoCard akun={akun} />
                        <CredentialsCard akun={akun} />
                    </Tabs.Panel>
                    <Tabs.Panel id="keamanan" className="space-y-6 pt-6">
                        <SessionsCard sessions={sessions} />
                    </Tabs.Panel>
                    <Tabs.Panel id="aktivitas" className="pt-6">
                        <ActivityTab aktivitas={aktivitas} />
                    </Tabs.Panel>
                </Tabs>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 9: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
vendor/bin/pint --format agent app/Models/LoginLog.php app/Support/LoginActivityRecorder.php app/Services/ActivityFeed.php app/Providers/AppServiceProvider.php app/Http/Controllers/ProfileController.php routes/console.php tests/Feature/LoginLogTest.php tests/Feature/ActivityFeedTest.php database/migrations/2026_10_15_000003_create_login_logs_table.php
php artisan test --compact --filter='Profile|Session|Login|Activity|Auth'
git add database/migrations/2026_10_15_000003_create_login_logs_table.php app/Models/LoginLog.php app/Support/LoginActivityRecorder.php app/Services/ActivityFeed.php app/Providers/AppServiceProvider.php routes/console.php app/Http/Controllers/ProfileController.php tests/Feature/LoginLogTest.php tests/Feature/ActivityFeedTest.php resources/js/types/index.d.ts resources/js/Pages/Profile
git commit -m "feat(profile): add the activity tab with work history and login logs"
```
Expected: bersih; tes hijau.

- [ ] **Step 10: Suite penuh, pembersihan, dan GERBANG TAHAP 4 — berhenti**

Jalankan suite penuh di latar belakang (`php artisan test --compact`, ±12 menit) dan laporkan hasilnya. Cek runtime singkat: tab Aktivitas memuat (skeleton lalu daftar), filter berganti, paginasi bila ada > 15 entri. Verifikasi di laporan: (a) penjadwal `schedule:work` sudah ada di `compose.prod.yaml`; (b) `php artisan migrate` harus dijalankan di produksi untuk tiga migrasi; (c) `php artisan storage:link` diperlukan untuk foto.

Minta pengguna menilai: tab Aktivitas (ikon, judul, keterangan perangkat · IP, waktu, tautan ke dokumen), filter Semua/Pekerjaan/Login, paginasi, login lalu keluar lalu coba sandi salah dan lihat entri baru, keadaan kosong, layar 375 px, keyboard/fokus. Setelah lolos: perbarui memori proyek (`project-sibima-progress`) dan tanyakan persetujuan sebelum push.

---

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Ponytail: baris "Status" dihapus dari kartu Info akun karena sudah ditampilkan sebagai badge Aktif/Nonaktif di kepala profil (duplikat). Tidak ada abstraksi spekulatif: `FormDialog` dipakai oleh enam dialog, `InfoRow` oleh delapan baris, `PasswordConfirmDialog` oleh dua aksi sesi. `ActivityFeed` menggabung di PHP karena hanya tiga sumber kecil; tabel log aktivitas umum sengaja tidak dibuat.
- Impeccable (Operate): label `InfoRow` menyempit di layar kecil (`w-28`) agar nilai dan tombol Ubah muat di 375 px; aksi destruktif (Keluarkan, Hapus foto) memakai warna merah dan dialog konfirmasi sandi/penegasan; tombol hanya muncul bila berlaku (Hapus foto hanya bila ada foto sendiri; Keluar dari semua perangkat lain hanya bila ada sesi lain); keadaan memuat riwayat memakai kerangka berdenyut dan keadaan kosong tertulis; `aria-busy`, `time dateTime`, dan label tombol berisi nama sesi/aksi dipakai untuk pembaca layar. Dicek saat eksekusi: nilai email panjang terpotong (`truncate`) masih terbaca di 375 px, dan tab bertingkat (tab utama + filter Aktivitas) tidak membingungkan fokus keyboard.
