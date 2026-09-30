<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_request_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('approval_request_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('step_order');
            $table->string('label');
            $table->string('approver_type')->default('role');
            $table->string('approver_role')->nullable();
            $table->string('unit_scope');
            $table->foreignId('approver_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['approval_request_id', 'step_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_request_steps');
    }
};
