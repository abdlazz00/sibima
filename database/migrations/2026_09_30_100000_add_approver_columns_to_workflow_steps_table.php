<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workflow_steps', function (Blueprint $table) {
            $table->string('label')->default('');
            $table->string('approver_type')->default('role');
            $table->foreignId('approver_user_id')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::table('workflow_steps', function (Blueprint $table) {
            $table->string('approver_role')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('workflow_steps', function (Blueprint $table) {
            $table->dropConstrainedForeignId('approver_user_id');
            $table->dropColumn(['label', 'approver_type']);
        });
    }
};
