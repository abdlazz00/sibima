<?php

namespace Database\Seeders;

use App\Models\WorkflowDefinition;
use App\Support\WorkflowDefaults;
use Illuminate\Database\Seeder;

class WorkflowDefinitionSeeder extends Seeder
{
    /**
     * Non-destructive: creates missing workflows with their default steps and only
     * fills empty step labels on existing ones. It never overwrites steps an admin
     * edited from the settings page (use the "Kembalikan ke default" button for that).
     */
    public function run(): void
    {
        foreach (WorkflowDefaults::all() as $code => $data) {
            $definition = WorkflowDefinition::where('code', $code)->first();

            if ($definition === null) {
                WorkflowDefaults::applyTo(WorkflowDefinition::create(['code' => $code, 'name' => $data['name']]));

                continue;
            }

            foreach ($definition->steps()->where('label', '')->get() as $step) {
                $default = $data['steps'][$step->step_order - 1] ?? null;

                if ($default !== null) {
                    $step->update(['label' => $default['label']]);
                }
            }
        }
    }
}
