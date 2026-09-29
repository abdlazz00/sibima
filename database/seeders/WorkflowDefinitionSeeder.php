<?php

namespace Database\Seeders;

use App\Models\WorkflowDefinition;
use Illuminate\Database\Seeder;

class WorkflowDefinitionSeeder extends Seeder
{
    public function run(): void
    {
        $definitions = [
            'penerimaan_aset' => [
                'name' => 'Penerimaan Aset',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'kasubag', 'unit_scope' => 'none'],
                    ['step_order' => 2, 'approver_role' => 'camat', 'unit_scope' => 'subject'],
                ],
            ],
            'mutasi_kec_ke_kel' => [
                'name' => 'Mutasi Kecamatan ke Kelurahan',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'kasubag', 'unit_scope' => 'none'],
                    ['step_order' => 2, 'approver_role' => 'camat', 'unit_scope' => 'origin'],
                    ['step_order' => 3, 'approver_role' => 'admin_kelurahan', 'unit_scope' => 'destination'],
                    ['step_order' => 4, 'approver_role' => 'lurah', 'unit_scope' => 'destination'],
                ],
            ],
            'mutasi_antar_kel' => [
                'name' => 'Mutasi Antar Kelurahan',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'lurah', 'unit_scope' => 'origin'],
                    ['step_order' => 2, 'approver_role' => 'admin_kelurahan', 'unit_scope' => 'destination'],
                    ['step_order' => 3, 'approver_role' => 'lurah', 'unit_scope' => 'destination'],
                ],
            ],
            'retur_kel_ke_kec' => [
                'name' => 'Retur Kelurahan ke Kecamatan',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'lurah', 'unit_scope' => 'origin'],
                    ['step_order' => 2, 'approver_role' => 'admin_kecamatan', 'unit_scope' => 'destination'],
                    ['step_order' => 3, 'approver_role' => 'kasubag', 'unit_scope' => 'none'],
                    ['step_order' => 4, 'approver_role' => 'camat', 'unit_scope' => 'destination'],
                ],
            ],
            'mutasi_internal_kec' => [
                'name' => 'Mutasi Internal Kecamatan',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'camat', 'unit_scope' => 'origin'],
                ],
            ],
            'mutasi_internal_kel' => [
                'name' => 'Mutasi Internal Kelurahan',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'lurah', 'unit_scope' => 'origin'],
                ],
            ],
        ];

        foreach ($definitions as $code => $data) {
            $def = WorkflowDefinition::updateOrCreate(
                ['code' => $code],
                ['name' => $data['name']]
            );

            foreach ($data['steps'] as $step) {
                $def->steps()->updateOrCreate(
                    ['step_order' => $step['step_order']],
                    $step
                );
            }
        }
    }
}
