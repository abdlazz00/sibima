<?php

use App\Contracts\HasWorkflowUnits;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\Unit;

it('has expected cases and labels for MutationType', function () {
    expect(MutationType::KecKeKel->value)->toBe('kec_ke_kel')
        ->and(MutationType::AntarKel->value)->toBe('antar_kel')
        ->and(MutationType::ReturKelKeKec->value)->toBe('retur_kel_ke_kec')
        ->and(MutationType::Internal->value)->toBe('internal')
        ->and(MutationType::KecKeKel->label())->toBe('Mutasi Kecamatan ke Kelurahan')
        ->and(MutationType::AntarKel->label())->toBe('Mutasi Antar Kelurahan')
        ->and(MutationType::ReturKelKeKec->label())->toBe('Retur Kelurahan ke Kecamatan')
        ->and(MutationType::Internal->label())->toBe('Mutasi Internal');
});

it('has expected cases and labels for MutationStatus', function () {
    expect(MutationStatus::Pending->value)->toBe('pending')
        ->and(MutationStatus::Approved->value)->toBe('approved')
        ->and(MutationStatus::Rejected->value)->toBe('rejected')
        ->and(MutationStatus::Pending->label())->toBe('Menunggu Persetujuan')
        ->and(MutationStatus::Approved->label())->toBe('Disetujui')
        ->and(MutationStatus::Rejected->label())->toBe('Ditolak');
});

it('verifies HasWorkflowUnits contract interface methods', function () {
    $instance = new class implements HasWorkflowUnits
    {
        public function getOriginUnit(): Unit
        {
            return new Unit;
        }

        public function getDestinationUnit(): Unit
        {
            return new Unit;
        }
    };

    expect($instance)->toBeInstanceOf(HasWorkflowUnits::class)
        ->and($instance->getOriginUnit())->toBeInstanceOf(Unit::class)
        ->and($instance->getDestinationUnit())->toBeInstanceOf(Unit::class);
});
