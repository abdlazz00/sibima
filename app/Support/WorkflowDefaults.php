<?php

namespace App\Support;

use App\Models\WorkflowDefinition;

class WorkflowDefaults
{
    /** @return array<string, array{name: string, steps: list<array<string, string>>}> */
    public static function all(): array
    {
        return [
            'penerimaan_aset' => [
                'name' => 'Penerimaan Aset',
                'steps' => [
                    self::role('Verifikasi Kasubag', 'kasubag', 'none'),
                    self::role('Persetujuan Camat', 'camat', 'subject'),
                ],
            ],
            'mutasi_kec_ke_kel' => [
                'name' => 'Mutasi Kecamatan ke Kelurahan',
                'steps' => [
                    self::role('Verifikasi Kasubag', 'kasubag', 'none'),
                    self::role('Persetujuan Camat (Pelepasan)', 'camat', 'origin'),
                    self::role('Konfirmasi Admin Kelurahan Tujuan', 'admin_kelurahan', 'destination'),
                    self::role('Persetujuan Lurah Tujuan', 'lurah', 'destination'),
                ],
            ],
            'mutasi_antar_kel' => [
                'name' => 'Mutasi Antar Kelurahan',
                'steps' => [
                    self::role('Persetujuan Lurah Asal', 'lurah', 'origin'),
                    self::role('Konfirmasi Admin Kelurahan Tujuan', 'admin_kelurahan', 'destination'),
                    self::role('Persetujuan Lurah Tujuan', 'lurah', 'destination'),
                ],
            ],
            'retur_kel_ke_kec' => [
                'name' => 'Retur Kelurahan ke Kecamatan',
                'steps' => [
                    self::role('Persetujuan Lurah Asal', 'lurah', 'origin'),
                    self::role('Konfirmasi Admin Kecamatan', 'admin_kecamatan', 'destination'),
                    self::role('Verifikasi Kasubag', 'kasubag', 'none'),
                    self::role('Persetujuan Camat', 'camat', 'destination'),
                ],
            ],
            'mutasi_internal_kec' => [
                'name' => 'Mutasi Internal Kecamatan',
                'steps' => [self::role('Persetujuan Camat', 'camat', 'origin')],
            ],
            'mutasi_internal_kel' => [
                'name' => 'Mutasi Internal Kelurahan',
                'steps' => [self::role('Persetujuan Lurah', 'lurah', 'origin')],
            ],
            'lapor_rusak_hilang' => [
                'name' => 'Lapor Rusak/Hilang',
                'steps' => [self::atasanUnit('Persetujuan Atasan Unit')],
            ],
        ];
    }

    /** @return list<array<string, string>> */
    public static function steps(string $code): array
    {
        return self::all()[$code]['steps'] ?? [];
    }

    public static function applyTo(WorkflowDefinition $definition): void
    {
        $definition->steps()->delete();

        foreach (self::steps($definition->code) as $i => $step) {
            $definition->steps()->create($step + ['step_order' => $i + 1]);
        }

        $definition->unsetRelation('steps');
    }

    /** @return array<string, string|null> */
    private static function atasanUnit(string $label): array
    {
        return ['label' => $label, 'approver_type' => 'atasan_unit', 'approver_role' => null, 'unit_scope' => 'subject'];
    }

    /** @return array<string, string> */
    private static function role(string $label, string $role, string $scope): array
    {
        return ['label' => $label, 'approver_type' => 'role', 'approver_role' => $role, 'unit_scope' => $scope];
    }
}
