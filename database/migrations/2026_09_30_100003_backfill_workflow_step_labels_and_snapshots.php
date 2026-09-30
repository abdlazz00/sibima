<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const ROLE_LABELS = [
        'kasubag' => 'Verifikasi Kasubag',
        'camat' => 'Persetujuan Camat',
        'lurah' => 'Persetujuan Lurah',
        'admin_kecamatan' => 'Konfirmasi Admin Kecamatan',
        'admin_kelurahan' => 'Konfirmasi Admin Kelurahan',
    ];

    public function up(): void
    {
        foreach (DB::table('workflow_steps')->where('label', '')->get() as $step) {
            DB::table('workflow_steps')->where('id', $step->id)->update([
                'label' => self::ROLE_LABELS[$step->approver_role] ?? ucfirst(str_replace('_', ' ', (string) $step->approver_role)),
            ]);
        }

        $requests = DB::table('approval_requests')
            ->whereNotIn('id', DB::table('approval_request_steps')->select('approval_request_id'))
            ->get(['id', 'workflow_definition_id']);

        foreach ($requests as $request) {
            $steps = DB::table('workflow_steps')
                ->where('workflow_definition_id', $request->workflow_definition_id)
                ->get();

            foreach ($steps as $step) {
                DB::table('approval_request_steps')->insert([
                    'approval_request_id' => $request->id,
                    'step_order' => $step->step_order,
                    'label' => $step->label,
                    'approver_type' => $step->approver_type,
                    'approver_role' => $step->approver_role,
                    'unit_scope' => $step->unit_scope,
                    'approver_user_id' => $step->approver_user_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void {}
};
