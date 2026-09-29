<?php

use App\Models\AssetMutation;
use App\Models\User;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('admin_kecamatan');
    Role::findOrCreate('admin_kelurahan');
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan Sagulung');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan Tembesi');

    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKelA = userWithRole('admin_kelurahan', $this->kelA);
    $this->adminKelB = userWithRole('admin_kelurahan', $this->kelB);
});

it('authorizes mutation creation only for origin unit admins', function () {
    expect($this->adminKec->can('create', [AssetMutation::class, $this->kec]))->toBeTrue()
        ->and($this->adminKec->can('create', [AssetMutation::class, $this->kelA]))->toBeFalse()
        ->and($this->adminKelA->can('create', [AssetMutation::class, $this->kelA]))->toBeTrue()
        ->and($this->adminKelA->can('create', [AssetMutation::class, $this->kelB]))->toBeFalse();
});
