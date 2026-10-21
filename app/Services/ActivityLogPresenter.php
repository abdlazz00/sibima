<?php

namespace App\Services;

use App\Enums\AssetStatus;
use App\Enums\BeritaAcaraStatus;
use App\Enums\Kondisi;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Enums\StatusKepegawaian;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Spatie\Activitylog\Models\Activity;

class ActivityLogPresenter
{
    /**
     * @var array<string, string>
     */
    private const LABELS = [
        // Aset
        'nama_aset' => 'Nama Aset',
        'kode_barang' => 'Kode Barang',
        'nomor_register' => 'No. Register',
        'category_id' => 'Kategori BMD',
        'unit_id' => 'Unit Kerja',
        'current_holder_id' => 'Pemegang Aset',
        'merk_type' => 'Merk / Tipe',
        'kondisi' => 'Kondisi Fisik',
        'status' => 'Status Operasional',
        'nilai_perolehan' => 'Nilai Perolehan',
        'nilai_buku' => 'Nilai Buku',
        'tanggal_perolehan' => 'Tanggal Perolehan',
        'sumber_perolehan' => 'Sumber Perolehan',
        'no_dokumen' => 'No. Dokumen',
        'keterangan' => 'Keterangan',
        'catatan' => 'Catatan',

        // Pegawai
        'nama' => 'Nama Pegawai',
        'nip' => 'NIP',
        'pangkat_golongan' => 'Pangkat/Golongan',
        'jabatan' => 'Jabatan',
        'status_kepegawaian' => 'Status Kepegawaian',
        'no_hp' => 'Nomor HP',
        'email_dinas' => 'Email Dinas',

        // User
        'name' => 'Nama Akun',
        'email' => 'Alamat Email',
        'is_active' => 'Status Akun',
        'unit_scope_override' => 'Override Unit Scope',

        // Kategori
        'code' => 'Kode Kategori',
        'parent_id' => 'Induk Kategori',
        'description' => 'Deskripsi Kategori',

        // Berita Acara Penerimaan
        'no_berita_acara' => 'No. Berita Acara',
        'tanggal_penerimaan' => 'Tanggal Penerimaan',
        'vendor' => 'Penyedia / Rekanan',
        'no_kontrak_spk' => 'No. Kontrak / SPK',

        // Mutasi
        'nomor_mutasi' => 'Nomor Mutasi',
        'jenis_mutasi' => 'Jenis Mutasi',
        'origin_unit_id' => 'Unit Asal',
        'destination_unit_id' => 'Unit Tujuan',
        'tanggal_mutasi' => 'Tanggal Mutasi',

        // Laporan
        'nomor_laporan' => 'Nomor Laporan',
        'asset_id' => 'Aset Terkait',
        'pegawai_id' => 'Pelapor / Pemegang',
        'jenis' => 'Jenis Laporan',
        'kondisi_baru' => 'Kondisi Baru',
        'tanggal_kejadian' => 'Tanggal Kejadian',
        'kronologi' => 'Kronologi Kejadian',

        // Alur / Role
        'guard_name' => 'Guard',
    ];

    /**
     * @var array<int, string>
     */
    private array $unitCache = [];

    /**
     * @var array<int, string>
     */
    private array $categoryCache = [];

    /**
     * @var array<int, string>
     */
    private array $pegawaiCache = [];

    /**
     * @var array<int, string>
     */
    private array $userCache = [];

    /**
     * Format a single Activity log entry into presentation-ready array.
     *
     * @return array<string, mixed>
     */
    public function format(Activity $log): array
    {
        // Support both Spatie v5 (attribute_changes) and fallback (properties)
        $changes = $log->attribute_changes;
        $properties = $log->properties;

        $old = $changes['old'] ?? $properties['old'] ?? [];
        $new = $changes['attributes'] ?? $properties['attributes'] ?? [];

        // In case they are Collections, convert to array
        if (is_object($old) && method_exists($old, 'toArray')) {
            $old = $old->toArray();
        }
        if (is_object($new) && method_exists($new, 'toArray')) {
            $new = $new->toArray();
        }

        $diff = [];
        $allKeys = array_unique(array_merge(array_keys((array) $old), array_keys((array) $new)));

        foreach ($allKeys as $key) {
            if (in_array($key, ['password', 'remember_token', 'updated_at', 'created_at', 'id'], true)) {
                continue;
            }

            $diff[] = [
                'field' => self::LABELS[$key] ?? ucfirst(str_replace('_', ' ', (string) $key)),
                'key' => (string) $key,
                'old' => $this->humanizeValue((string) $key, $old[$key] ?? null),
                'new' => $this->humanizeValue((string) $key, $new[$key] ?? null),
            ];
        }

        return [
            'id' => $log->id,
            'waktu' => $log->created_at?->translatedFormat('d M Y, H:i').' WIB',
            'waktu_relatif' => $log->created_at?->diffForHumans(),
            'pelaku' => [
                'id' => $log->causer?->id,
                'nama' => $log->causer?->name ?? 'Sistem / Anonim',
                'email' => $log->causer?->email,
                'role' => $log->causer?->roles?->pluck('name')->first() ?? '-',
            ],
            'aksi' => $log->event ?? 'updated',
            'modul' => $log->log_name ?? 'umum',
            'deskripsi' => $this->resolveDescription($log),
            'target' => $this->resolveTargetName($log),
            'diff' => $diff,
        ];
    }

    private function resolveDescription(Activity $log): string
    {
        if (! empty($log->description) && ! in_array($log->description, ['created', 'updated', 'deleted'], true)) {
            return $log->description;
        }

        $eventLabel = match ($log->event) {
            'created' => 'Membuat data',
            'updated' => 'Memperbarui data',
            'deleted' => 'Menghapus data',
            'restored' => 'Memulihkan data',
            default => ucfirst((string) $log->event),
        };

        $moduleLabel = match ($log->log_name) {
            'asset' => 'aset',
            'pegawai' => 'pegawai',
            'user' => 'pengguna',
            'kategori' => 'kategori BMD',
            'berita-acara' => 'berita acara',
            'mutasi' => 'mutasi aset',
            'laporan' => 'laporan kerusakan/kehilangan',
            'alur' => 'alur persetujuan',
            'role' => 'peran pengguna',
            default => $log->log_name ?? 'data',
        };

        return "{$eventLabel} {$moduleLabel}";
    }

    private function humanizeValue(string $key, mixed $val): string
    {
        if ($val === null || $val === '') {
            return '-';
        }

        if (is_bool($val)) {
            return $val ? 'Aktif' : 'Nonaktif';
        }

        if ($key === 'is_active') {
            return $val ? 'Aktif' : 'Nonaktif';
        }

        // Financials
        if (in_array($key, ['nilai_perolehan', 'nilai_buku', 'acquisition_price', 'book_value'], true) && is_numeric($val)) {
            return 'Rp '.number_format((float) $val, 0, ',', '.');
        }

        // Enums mapping
        if ($key === 'kondisi' || $key === 'kondisi_baru') {
            $enum = Kondisi::tryFrom((string) $val);

            return $enum ? $enum->label() : ucfirst(str_replace('_', ' ', (string) $val));
        }

        if ($key === 'status_kepegawaian') {
            $enum = StatusKepegawaian::tryFrom((string) $val);

            return $enum ? $enum->label() : strtoupper((string) $val);
        }

        if ($key === 'status') {
            $assetStatus = AssetStatus::tryFrom((string) $val);
            if ($assetStatus) {
                return $assetStatus->label();
            }

            $baStatus = BeritaAcaraStatus::tryFrom((string) $val);
            if ($baStatus) {
                return $baStatus->label();
            }

            $mutStatus = MutationStatus::tryFrom((string) $val);
            if ($mutStatus) {
                return $mutStatus->label();
            }

            return ucfirst(str_replace('_', ' ', (string) $val));
        }

        if ($key === 'jenis_mutasi') {
            $mutType = MutationType::tryFrom((string) $val);

            return $mutType ? $mutType->label() : ucfirst((string) $val);
        }

        // Relational Lookups with lightweight memory cache
        if (in_array($key, ['unit_id', 'origin_unit_id', 'destination_unit_id'], true) && is_numeric($val)) {
            $id = (int) $val;
            if (! isset($this->unitCache[$id])) {
                $this->unitCache[$id] = Unit::find($id)?->name ?? "Unit #{$id}";
            }

            return $this->unitCache[$id];
        }

        if (in_array($key, ['category_id', 'parent_id', 'asset_category_id'], true) && is_numeric($val)) {
            $id = (int) $val;
            if (! isset($this->categoryCache[$id])) {
                $this->categoryCache[$id] = AssetCategory::find($id)?->name ?? "Kategori #{$id}";
            }

            return $this->categoryCache[$id];
        }

        if (in_array($key, ['current_holder_id', 'pegawai_id'], true) && is_numeric($val)) {
            $id = (int) $val;
            if (! isset($this->pegawaiCache[$id])) {
                $this->pegawaiCache[$id] = Pegawai::find($id)?->nama ?? "Pegawai #{$id}";
            }

            return $this->pegawaiCache[$id];
        }

        if (in_array($key, ['user_id', 'created_by'], true) && is_numeric($val)) {
            $id = (int) $val;
            if (! isset($this->userCache[$id])) {
                $this->userCache[$id] = User::find($id)?->name ?? "User #{$id}";
            }

            return $this->userCache[$id];
        }

        return (string) $val;
    }

    private function resolveTargetName(Activity $log): string
    {
        if ($log->subject) {
            $subject = $log->subject;

            return $subject->nama_aset
                ?? $subject->nama
                ?? $subject->name
                ?? $subject->no_berita_acara
                ?? $subject->nomor_mutasi
                ?? $subject->nomor_laporan
                ?? (class_basename($log->subject_type).' #'.$subject->getKey());
        }

        return class_basename($log->subject_type ?: 'Data');
    }
}
