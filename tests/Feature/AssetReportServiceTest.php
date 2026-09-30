<?php

use App\Enums\AssetReportStatus;
use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\Pegawai;
use App\Services\AssetReportService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Storage::fake('public');
    foreach (['admin_kecamatan', 'admin_kelurahan', 'camat'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->camat = userWithRole('camat', $this->kec);
    $this->service = app(AssetReportService::class);
    $this->asset = Asset::factory()->create(['unit_id' => $this->kec->id]);
});

function reportData(object $t, array $override = []): array
{
    return array_merge([
        'asset_id' => $t->asset->id, 'jenis' => 'rusak', 'kondisi_baru' => 'rusak_ringan',
        'tanggal_kejadian' => now()->toDateString(), 'kronologi' => 'Jatuh saat dipindahkan.',
    ], $override);
}

function photo(string $name = 'a.jpg'): UploadedFile
{
    return UploadedFile::fake()->image($name);
}

it('creates a rusak report with photos, an auto number, the holder and a submitted approval', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kec->id]);
    $this->asset->update(['current_holder_id' => $pegawai->id]);

    $report = $this->service->create(reportData($this), [photo()], $this->admin);

    expect($report->nomor_laporan)->toBe('LP/'.now()->year.'/0001')
        ->and($report->unit_id)->toBe($this->kec->id)
        ->and($report->pegawai_id)->toBe($pegawai->id)
        ->and($report->status)->toBe(AssetReportStatus::Pending)
        ->and($report->photos)->toHaveCount(1)
        ->and($report->approvalRequest->definition->code)->toBe('lapor_rusak_hilang')
        ->and($report->approvalRequest->steps)->toHaveCount(1);
    Storage::disk('public')->assertExists($report->photos->first()->path);
});

it('creates a hilang report without photos, forcing kondisi_baru to hilang, and numbers sequentially', function () {
    $first = $this->service->create(reportData($this, ['jenis' => 'hilang', 'kondisi_baru' => 'rusak_ringan']), [], $this->admin);
    $first->update(['status' => 'rejected']);
    $second = $this->service->create(reportData($this, ['jenis' => 'hilang']), [], $this->admin);

    expect($first->kondisi_baru)->toBe(Kondisi::Hilang)
        ->and($second->nomor_laporan)->toBe('LP/'.now()->year.'/0002');
});

it('still allows reporting an asset that is dalam_proses', function () {
    $this->asset->update(['status' => AssetStatus::DalamProses]);

    expect($this->service->create(reportData($this), [photo()], $this->admin))->toBeInstanceOf(AssetReport::class);
});

it('refuses invalid reports and creates nothing', function (string $case) {
    $photos = [photo()];
    $data = reportData($this);
    $actor = $this->admin;

    switch ($case) {
        case 'asset already hilang':
            $this->asset->update(['kondisi' => Kondisi::Hilang]);
            break;
        case 'rusak without photo':
            $photos = [];
            break;
        case 'same condition':
            $this->asset->update(['kondisi' => Kondisi::RusakRingan]);
            break;
        case 'better condition':
            $this->asset->update(['kondisi' => Kondisi::RusakBerat]);
            break;
        case 'kondisi baru missing':
            $data['kondisi_baru'] = null;
            break;
        case 'kondisi baru not a damage level':
            $data['kondisi_baru'] = 'baik';
            break;
        case 'more than 10 photos':
            $photos = array_map(fn ($i) => photo("f{$i}.jpg"), range(1, 11));
            break;
        case 'asset of another unit':
            $actor = userWithRole('admin_kelurahan', $this->kel);
            break;
        case 'pending report exists':
            $this->service->create(reportData($this), [photo()], $this->admin);
            break;
    }

    $before = AssetReport::count();
    expect(fn () => $this->service->create($data, $photos, $actor))->toThrow(InvalidArgumentException::class);
    expect(AssetReport::count())->toBe($before);
})->with([
    'asset already hilang', 'rusak without photo', 'same condition', 'better condition',
    'kondisi baru missing', 'kondisi baru not a damage level', 'more than 10 photos',
    'asset of another unit', 'pending report exists',
]);

it('serialises concurrent submissions: the second one sees the first as pending', function () {
    $this->service->create(reportData($this), [photo()], $this->admin);

    expect(fn () => $this->service->create(reportData($this, ['kondisi_baru' => 'rusak_berat']), [photo()], $this->admin))
        ->toThrow(InvalidArgumentException::class);
    expect(AssetReport::where('asset_id', $this->asset->id)->count())->toBe(1);
});
