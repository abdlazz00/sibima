<?php

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Enums\StatusKepegawaian;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UnitSeeder;
use Spatie\Activitylog\Models\Activity;

beforeEach(function () {
    $this->seed([RoleSeeder::class, PermissionSeeder::class, UnitSeeder::class]);
});

it('logs created and updated events for asset with dirty attributes only', function () {
    $user = User::factory()->create();
    $unit = Unit::first();
    $parentCategory = AssetCategory::factory()->create(['name' => 'Peralatan', 'parent_id' => null]);
    $category = AssetCategory::factory()->create(['name' => 'Laptop', 'parent_id' => $parentCategory->id]);

    $this->actingAs($user);

    $asset = Asset::create([
        'nama_aset' => 'Laptop Lenovo ThinkPad',
        'kode_barang' => '1.3.2.05.02',
        'nomor_register' => '0001',
        'category_id' => $category->id,
        'unit_id' => $unit->id,
        'kondisi' => Kondisi::Baik,
        'status' => AssetStatus::Aktif,
        'nilai_perolehan' => 12000000,
        'nilai_buku' => 12000000,
        'tanggal_perolehan' => now()->subYear(),
        'sumber_perolehan' => 'APBD',
    ]);

    expect(Activity::where('subject_type', Asset::class)->where('subject_id', $asset->id)->count())->toBe(1);

    // Update condition
    $asset->update(['kondisi' => Kondisi::RusakBerat]);

    $updateLog = Activity::where('subject_type', Asset::class)
        ->where('subject_id', $asset->id)
        ->where('event', 'updated')
        ->latest('id')
        ->first();

    expect($updateLog)->not->toBeNull()
        ->and($updateLog->attribute_changes['old']['kondisi'])->toBe('baik')
        ->and($updateLog->attribute_changes['attributes']['kondisi'])->toBe('rusak_berat')
        ->and(isset($updateLog->attribute_changes['attributes']['nama_aset']))->toBeFalse(); // logOnlyDirty check
});

it('strictly excludes user password and remember_token from activity logs', function () {
    $admin = User::factory()->create();
    $this->actingAs($admin);

    $targetUser = User::factory()->create(['password' => 'secret123']);

    $targetUser->update([
        'name' => 'Nama Baru User',
        'password' => 'passwordBaruRahasia!',
    ]);

    $log = Activity::where('subject_type', User::class)
        ->where('subject_id', $targetUser->id)
        ->where('event', 'updated')
        ->latest('id')
        ->first();

    expect($log)->not->toBeNull()
        ->and(isset($log->attribute_changes['attributes']['password']))->toBeFalse()
        ->and(isset($log->attribute_changes['old']['password']))->toBeFalse()
        ->and($log->attribute_changes['attributes']['name'])->toBe('Nama Baru User');
});

it('logs created and updated events for pegawai', function () {
    $admin = User::factory()->create();
    $unit = Unit::first();
    $this->actingAs($admin);

    $pegawai = Pegawai::create([
        'nama' => 'Budi Santoso',
        'nip' => '198001012005011001',
        'pangkat_golongan' => 'Penata - III/c',
        'jabatan' => 'Staf Pelayanan',
        'status_kepegawaian' => StatusKepegawaian::Pns,
        'unit_id' => $unit->id,
        'no_hp' => '08123456789',
        'email_dinas' => 'budi@sagulung.go.id',
    ]);

    expect(Activity::where('subject_type', Pegawai::class)->where('subject_id', $pegawai->id)->count())->toBe(1);

    $pegawai->update(['jabatan' => 'Kasi Pelayanan']);

    $updateLog = Activity::where('subject_type', Pegawai::class)
        ->where('subject_id', $pegawai->id)
        ->where('event', 'updated')
        ->latest('id')
        ->first();

    expect($updateLog)->not->toBeNull()
        ->and($updateLog->attribute_changes['old']['jabatan'])->toBe('Staf Pelayanan')
        ->and($updateLog->attribute_changes['attributes']['jabatan'])->toBe('Kasi Pelayanan');
});

it('logs created and updated events for asset category', function () {
    $admin = User::factory()->create();
    $this->actingAs($admin);

    $category = AssetCategory::create([
        'name' => 'Elektronik Baru',
        'code' => '02.99',
    ]);

    expect(Activity::where('subject_type', AssetCategory::class)->where('subject_id', $category->id)->count())->toBe(1);

    $category->update(['name' => 'Elektronik & Komputer']);

    $updateLog = Activity::where('subject_type', AssetCategory::class)
        ->where('subject_id', $category->id)
        ->where('event', 'updated')
        ->latest('id')
        ->first();

    expect($updateLog)->not->toBeNull()
        ->and($updateLog->attribute_changes['old']['name'])->toBe('Elektronik Baru')
        ->and($updateLog->attribute_changes['attributes']['name'])->toBe('Elektronik & Komputer');
});

it('logs role updates', function () {
    $admin = User::factory()->create();
    $this->actingAs($admin);

    $role = Role::create([
        'name' => 'guest-tester',
        'guard_name' => 'web',
    ]);

    expect(Activity::where('subject_type', Role::class)->where('subject_id', $role->id)->count())->toBe(1);

    $role->update(['name' => 'guest-renamed']);

    $updateLog = Activity::where('subject_type', Role::class)
        ->where('subject_id', $role->id)
        ->where('event', 'updated')
        ->latest('id')
        ->first();

    expect($updateLog)->not->toBeNull()
        ->and($updateLog->attribute_changes['old']['name'])->toBe('guest-tester')
        ->and($updateLog->attribute_changes['attributes']['name'])->toBe('guest-renamed');
});
