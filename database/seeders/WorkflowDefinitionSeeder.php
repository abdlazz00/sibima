<?php

namespace Database\Seeders;

use App\Models\WorkflowDefinition;
use Illuminate\Database\Seeder;

class WorkflowDefinitionSeeder extends Seeder
{
    public function run(): void
    {
        $definition = WorkflowDefinition::updateOrCreate(
            ['code' => 'penerimaan_aset'],
            ['name' => 'Penerimaan Aset']
        );

        $steps = [
            ['step_order' => 1, 'approver_role' => 'kasubag', 'unit_scope' => 'none'],
            ['step_order' => 2, 'approver_role' => 'camat', 'unit_scope' => 'subject'],
        ];

        foreach ($steps as $step) {
            $definition->steps()->updateOrCreate(
                ['step_order' => $step['step_order']],
                $step
            );
        }
    }
}
