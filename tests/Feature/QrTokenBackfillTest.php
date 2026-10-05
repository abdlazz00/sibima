<?php

use App\Models\Asset;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

function qtbMigration(): object
{
    return require base_path('database/migrations/2026_10_11_000001_fix_missing_qr_tokens_on_assets.php');
}

it('fills every asset that is missing a qr_token, however many there are, and forbids null afterwards', function () {
    $kec = makeKecamatan();
    $category = \App\Models\AssetCategory::factory()->subcategory()->create();

    Schema::table('assets', fn ($t) => $t->string('qr_token', 16)->nullable()->change());

    $ids = [];
    foreach (range(1, 230) as $i) {
        $ids[] = DB::table('assets')->insertGetId([
            'qr_token' => null, 'kode_barang' => '1.3.2.05.02.04.004', 'nomor_register' => $i, 'nama_aset' => "Aset {$i}",
            'category_id' => $category->id, 'unit_id' => $kec->id, 'kondisi' => 'baik', 'status' => 'aktif',
            'tanggal_perolehan' => '2023-06-14', 'nilai_perolehan' => 1000, 'nilai_buku' => 500,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    qtbMigration()->up();

    $tokens = DB::table('assets')->pluck('qr_token');

    expect($tokens)->toHaveCount(230)
        ->and($tokens->filter(fn ($t) => $t === null || $t === '')->count())->toBe(0)
        ->and($tokens->unique()->count())->toBe(230)
        ->and($tokens->every(fn ($t) => preg_match('/^[A-Za-z0-9]{16}$/', $t) === 1))->toBeTrue();

    expect(fn () => DB::table('assets')->insert([
        'qr_token' => null, 'kode_barang' => '1.1', 'nomor_register' => 999, 'nama_aset' => 'x',
        'category_id' => $category->id, 'unit_id' => $kec->id, 'kondisi' => 'baik', 'status' => 'aktif',
        'tanggal_perolehan' => '2023-06-14', 'nilai_perolehan' => 1, 'nilai_buku' => 1,
        'created_at' => now(), 'updated_at' => now(),
    ]))->toThrow(QueryException::class);
});

it('still gives every newly created asset a token', function () {
    $asset = Asset::factory()->create();

    expect($asset->qr_token)->toMatch('/^[A-Za-z0-9]{16}$/');
});
