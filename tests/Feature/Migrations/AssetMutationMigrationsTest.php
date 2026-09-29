<?php

use Illuminate\Support\Facades\Schema;

it('creates asset_mutations and asset_mutation_items tables with required columns', function () {
    expect(Schema::hasTable('asset_mutations'))->toBeTrue()
        ->and(Schema::hasColumns('asset_mutations', [
            'id', 'nomor_mutasi', 'jenis_mutasi', 'origin_unit_id', 'destination_unit_id',
            'tanggal_mutasi', 'keterangan', 'status', 'created_by', 'created_at', 'updated_at',
        ]))->toBeTrue()
        ->and(Schema::hasTable('asset_mutation_items'))->toBeTrue()
        ->and(Schema::hasColumns('asset_mutation_items', [
            'id', 'asset_mutation_id', 'asset_id', 'target_holder_id', 'catatan',
            'created_at', 'updated_at',
        ]))->toBeTrue();
});
