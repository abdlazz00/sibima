<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('display_name')->nullable()->after('name');
            $table->string('unit_scope', 20)->default('own')->after('guard_name');
            $table->boolean('is_system')->default(false)->after('unit_scope');
            $table->string('description', 255)->nullable()->after('is_system');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('unit_scope_override', 20)->nullable()->after('unit_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('unit_scope_override');
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(['display_name', 'unit_scope', 'is_system', 'description']);
        });
    }
};
