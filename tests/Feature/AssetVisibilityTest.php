<?php

use App\Models\Asset;
use App\Models\User;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan Sungai Binti');
    $this->otherKec = makeKecamatan('Kecamatan Lain');

    $this->assetKec = Asset::factory()->create(['unit_id' => $this->kec->id]);
    $this->assetA = Asset::factory()->create(['unit_id' => $this->kelA->id]);
    $this->assetB = Asset::factory()->create(['unit_id' => $this->kelB->id]);
    $this->assetOther = Asset::factory()->create(['unit_id' => $this->otherKec->id]);
});

function visibleIds(User $user): array
{
    return Asset::query()->visibleTo($user)->orderBy('id')->pluck('id')->all();
}

it('shows kasubag every asset', function () {
    expect(visibleIds(userWithRole('kasubag')))->toHaveCount(4);
});

it('shows camat their kecamatan and its kelurahan only', function () {
    $ids = visibleIds(userWithRole('camat', $this->kec));

    expect($ids)->toBe([$this->assetKec->id, $this->assetA->id, $this->assetB->id]);
});

it('shows admin_kelurahan and lurah only their own kelurahan', function (string $role) {
    expect(visibleIds(userWithRole($role, $this->kelA)))->toBe([$this->assetA->id]);
})->with(['admin_kelurahan', 'lurah']);

it('shows admin_kecamatan only kecamatan-level assets', function () {
    expect(visibleIds(userWithRole('admin_kecamatan', $this->kec)))->toBe([$this->assetKec->id]);
});

it('shows a user with no role nothing', function () {
    $user = User::factory()->create(['unit_id' => $this->kec->id]);

    expect(visibleIds($user))->toBe([]);
});

it('agrees with canAccessUnit for every role and unit', function (string $role) {
    $home = in_array($role, ['admin_kelurahan', 'lurah'], true) ? $this->kelA : $this->kec;
    $user = userWithRole($role, $role === 'kasubag' ? null : $home);
    $ids = $user->accessibleUnitIds();

    foreach ([$this->kec, $this->kelA, $this->kelB, $this->otherKec] as $unit) {
        $inList = $ids === null || in_array($unit->id, $ids, true);
        expect($user->canAccessUnit($unit))->toBe($inList);
    }
})->with(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah']);
