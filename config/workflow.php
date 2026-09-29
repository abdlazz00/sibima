<?php

use App\Services\AssetMutationEffect;
use App\Services\PenerimaanAsetEffect;

return [
    /*
     * Maps a workflow_definitions.code to the WorkflowEffect implementation
     * that runs when a request under that code reaches its final approval.
     */
    'effects' => [
        'penerimaan_aset' => PenerimaanAsetEffect::class,
        'mutasi_kec_ke_kel' => AssetMutationEffect::class,
        'mutasi_antar_kel' => AssetMutationEffect::class,
        'retur_kel_ke_kec' => AssetMutationEffect::class,
        'mutasi_internal_kec' => AssetMutationEffect::class,
        'mutasi_internal_kel' => AssetMutationEffect::class,
    ],
];
