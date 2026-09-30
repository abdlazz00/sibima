<?php

use App\Enums\AssetRequestStatus;
use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Services\AssetRequestService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'kasubag', 'camat', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.10.01.02']);
    $this->service = app(AssetRequestService::class);
});

function pegawaiData(object $t, array $override = []): array
{
    $pegawai = Pegawai::factory()->create(['unit_id' => $t->kel->id]);

    return array_merge(['jenis' => 'pegawai', 'pegawai_id' => $pegawai->id, 'category_id' => $t->category->id, 'keterangan' => 'Butuh laptop.'], $override);
}

it('creates a pegawai request with the unit of the pegawai, jumlah 1, an auto number and a submitted approval', function () {
    $request = $this->service->create(pegawaiData($this, ['jumlah' => 5]), $this->adminKel);

    expect($request->nomor_permohonan)->toBe('PM/'.now()->year.'/0001')
        ->and($request->unit_id)->toBe($this->kel->id)
        ->and($request->jumlah)->toBe(1)
        ->and($request->status)->toBe(AssetRequestStatus::Pending)
        ->and($request->approvalRequest->definition->code)->toBe('permohonan_pegawai')
        ->and($request->approvalRequest->steps)->toHaveCount(1);
});

it('creates a unit request for the acting kelurahan and numbers requests sequentially', function () {
    $first = $this->service->create(pegawaiData($this), $this->adminKel);
    $second = $this->service->create(['jenis' => 'unit', 'jumlah' => 3, 'category_id' => $this->category->id, 'keterangan' => 'Stok kursi', 'unit_id' => $this->kec->id], $this->adminKel);

    expect($second->unit_id)->toBe($this->kel->id)
        ->and($second->pegawai_id)->toBeNull()
        ->and($second->jumlah)->toBe(3)
        ->and($second->nomor_permohonan)->toBe('PM/'.now()->year.'/0002')
        ->and($second->approvalRequest->definition->code)->toBe('permohonan_unit')
        ->and($first->nomor_permohonan)->toBe('PM/'.now()->year.'/0001');
});

it('refuses invalid requests and creates nothing', function (string $case) {
    $data = pegawaiData($this);
    $actor = $this->adminKel;

    switch ($case) {
        case 'actor is not an admin':
            $actor = userWithRole('camat', $this->kec);
            break;
        case 'pegawai of another unit':
            $data['pegawai_id'] = Pegawai::factory()->create(['unit_id' => $this->kec->id])->id;
            break;
        case 'pegawai missing':
            $data['pegawai_id'] = null;
            break;
        case 'category is not a subcategory':
            $data['category_id'] = AssetCategory::factory()->create()->id;
            break;
        case 'unit request by admin kecamatan':
            $data = ['jenis' => 'unit', 'jumlah' => 2, 'category_id' => $this->category->id, 'keterangan' => 'x'];
            $actor = $this->adminKec;
            break;
        case 'unit request with zero jumlah':
            $data = ['jenis' => 'unit', 'jumlah' => 0, 'category_id' => $this->category->id, 'keterangan' => 'x'];
            break;
    }

    $before = AssetRequest::count();
    expect(fn () => $this->service->create($data, $actor))->toThrow(InvalidArgumentException::class);
    expect(AssetRequest::count())->toBe($before);
})->with([
    'actor is not an admin', 'pegawai of another unit', 'pegawai missing', 'category is not a subcategory',
    'unit request by admin kecamatan', 'unit request with zero jumlah',
]);
