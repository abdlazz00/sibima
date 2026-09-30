<?php

use App\Services\AssetMutationEffect;
use App\Services\AssetReportEffect;
use App\Services\AssetRequestEffect;
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
        'lapor_rusak_hilang' => AssetReportEffect::class,
        'permohonan_pegawai' => AssetRequestEffect::class,
        'permohonan_unit' => AssetRequestEffect::class,
    ],

    /*
     * What each workflow's subject offers, used to validate steps edited from the UI:
     *  - subject:            the approvable has a single unit (`->unit`); allows the
     *                        "subject" unit scope and the "atasan_unit" approver type.
     *  - origin_destination: the approvable implements HasWorkflowUnits; allows the
     *                        "origin"/"destination" unit scopes.
     *  - none:               only role steps without a unit scope.
     */
    'capabilities' => [
        'penerimaan_aset' => 'subject',
        'mutasi_kec_ke_kel' => 'origin_destination',
        'mutasi_antar_kel' => 'origin_destination',
        'retur_kel_ke_kec' => 'origin_destination',
        'mutasi_internal_kec' => 'origin_destination',
        'mutasi_internal_kel' => 'origin_destination',
        'lapor_rusak_hilang' => 'subject',
        'permohonan_pegawai' => 'subject',
        'permohonan_unit' => 'subject',
    ],
];
