<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UnitSeeder;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->seed([RoleSeeder::class, PermissionSeeder::class, UnitSeeder::class]);
    Storage::fake('public');
});

it('batch generates thumbnails for assets, pegawai, and users', function () {
    // 1. Create dummy image data
    $image = imagecreatetruecolor(300, 300);
    ob_start();
    imagejpeg($image);
    $data = ob_get_clean();
    imagedestroy($image);

    // Asset photo
    $unit = Unit::first();
    $parent = AssetCategory::factory()->create(['name' => 'Alat Kantor', 'parent_id' => null]);
    $cat = AssetCategory::factory()->create(['name' => 'Meubilair', 'parent_id' => $parent->id]);
    $asset = Asset::factory()->create(['unit_id' => $unit->id, 'category_id' => $cat->id]);
    Storage::disk('public')->put("assets/{$asset->id}/photo1.jpg", $data);
    $assetPhoto = $asset->photos()->create(['path' => "assets/{$asset->id}/photo1.jpg"]);

    // Pegawai photo
    Storage::disk('public')->put('pegawais/1/profile.jpg', $data);
    $pegawai = Pegawai::factory()->create([
        'unit_id' => $unit->id,
        'foto_profile' => 'pegawais/1/profile.jpg',
    ]);

    // User photo
    Storage::disk('public')->put('profile-photos/user1.jpg', $data);
    $user = User::factory()->create([
        'unit_id' => $unit->id,
        'foto_profile' => 'profile-photos/user1.jpg',
    ]);

    // Run artisan command
    $this->artisan('sibima:generate-thumbnails')
        ->assertSuccessful();

    // Verify thumbnails exist
    Storage::disk('public')->assertExists('thumbs/96x96/assets/'.$asset->id.'/photo1.webp');
    Storage::disk('public')->assertExists('thumbs/96x96/pegawais/1/profile.webp');
    Storage::disk('public')->assertExists('thumbs/96x96/profile-photos/user1.webp');

    // Verify accessors return the thumbnail URLs
    expect($assetPhoto->thumbnail_url)->toContain('thumbs/96x96/assets/'.$asset->id.'/photo1.webp');
    expect($pegawai->foto_profile_thumbnail_url)->toContain('thumbs/96x96/pegawais/1/profile.webp');
    expect($user->foto_profile_thumbnail_url)->toContain('thumbs/96x96/profile-photos/user1.webp');
});
