<?php

use Illuminate\Support\Facades\Schema;
use Spatie\Activitylog\Models\Activity;

it('has activity_log table with required schema columns', function () {
    expect(Schema::hasTable('activity_log'))->toBeTrue()
        ->and(Schema::hasColumns('activity_log', [
            'id', 'log_name', 'description', 'subject_type', 'subject_id',
            'causer_type', 'causer_id', 'properties', 'created_at',
        ]))->toBeTrue();
});

it('has activitylog configuration with 90 days retention', function () {
    expect(config('activitylog.clean_after_days'))->toBe(90);
});
