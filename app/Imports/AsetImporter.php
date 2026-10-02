<?php

namespace App\Imports;

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use App\Models\User;
use App\Repositories\Contracts\AssetRepositoryInterface;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class AsetImporter extends Importer
{
    private const KODE = '/^\d+(\.\d+)+$/';

    private const MAX_NILAI = 9999999999999;

    /** @var array<string, int>|null */
    private ?array $subkategori = null;

    /** @var array<int, list<Pegawai>> */
    private array $pegawai = [];

    public function __construct(private readonly AssetRepositoryInterface $assets) {}

    public function begin(User $actor): void
    {
        parent::begin($actor);
        $this->subkategori = null;
        $this->pegawai = [];
    }

    public function headers(): array
    {
        return [
            'Kode Barang', 'No. Register', 'Nama Aset', 'Kategori', 'Subkategori', 'Merk/Tipe',
            'Tanggal Perolehan', 'Sumber Perolehan', 'Harga Perolehan', 'Nilai Buku', 'Kondisi',
            'Unit', 'Penanggung Jawab', 'No. Dokumen', 'Keterangan',
        ];
    }

    public function contoh(): array
    {
        return [
            '1.3.2.05.02.04.004', 1, 'Meja Kerja', 'ALAT KANTOR', 'MEJA', 'Informa',
            '14-06-2023', 'Belanja Modal', 1000000, 800000, 'Baik',
            'Kelurahan Sungai Pelunggut', 'Budi Santoso', 'DOC-001', '',
        ];
    }

    public function petunjuk(): array
    {
        return [
            'Impor kategori lebih dulu, lalu pegawai, lalu aset. Kategori dan Subkategori harus sudah ada di sistem.',
            'No. Register disarankan diisi. Terisi = dipakai apa adanya dan menjadi kunci duplikat (Kode Barang + No. Register).',
            'Kosong = sistem membuat nomor berikutnya, tetapi mengunggah ulang berkas yang sama akan menggandakan aset.',
            'Tanggal: sel tanggal Excel atau teks dd-mm-yyyy (antara tahun 1900 dan hari ini).',
            'Harga Perolehan dan Nilai Buku: angka murni tanpa titik/koma pemisah. Nilai Buku tidak boleh melebihi Harga Perolehan.',
            'Kondisi: Baik, Rusak Ringan, Rusak Berat, atau Hilang. Unit ditulis persis seperti nama unit di sistem.',
            'Penanggung Jawab (opsional): nama atau NIP pegawai di unit yang sama. No. Dokumen harus unik.',
            'Status aset selalu Aktif. Foto tidak diimpor. Hapus baris contoh sebelum mengunggah.',
        ];
    }

    public function validate(array $row): RowResult
    {
        $errors = [];
        $kode = $this->required($row, 'Kode Barang', 50, $errors);

        if ($kode !== '' && ! preg_match(self::KODE, $kode)) {
            $this->err($errors, 'Kode Barang', 'Format harus angka dipisah titik, mis. 1.3.2.05.02.04.004.');
        }

        $register = $this->register($row, $errors);

        if ($errors === [] && $register !== null
            && (isset($this->seen["ast:{$kode}|{$register}"])
                || Asset::where('kode_barang', $kode)->where('nomor_register', $register)->exists())) {
            return RowResult::duplikat();
        }

        $nama = $this->required($row, 'Nama Aset', 255, $errors);
        $categoryId = $this->subcategory($this->cell($row, 'Kategori'), $this->cell($row, 'Subkategori'), $errors);
        $merk = $this->optional($row, 'Merk/Tipe', 100, $errors);
        $sumber = $this->optional($row, 'Sumber Perolehan', 100, $errors);
        $tanggal = $this->tanggal($row['Tanggal Perolehan'] ?? null, $errors);
        $harga = $this->uang($row, 'Harga Perolehan', $errors);
        $buku = $this->uang($row, 'Nilai Buku', $errors);

        if ($harga !== null && $buku !== null && $buku > $harga) {
            $this->err($errors, 'Nilai Buku', 'Nilai buku tidak boleh melebihi harga perolehan.');
        }

        $kondisi = $this->kondisi($this->cell($row, 'Kondisi'), $errors);
        $unitId = $this->unit($this->cell($row, 'Unit'), $errors);
        $holderId = $unitId !== null ? $this->holder($this->cell($row, 'Penanggung Jawab'), $unitId, $errors) : null;
        $dokumen = $this->optional($row, 'No. Dokumen', 100, $errors);
        $keterangan = $this->optional($row, 'Keterangan', 2000, $errors);

        if ($dokumen !== '' && (isset($this->seen["doc:{$dokumen}"]) || Asset::where('no_dokumen', $dokumen)->exists())) {
            $this->err($errors, 'No. Dokumen', 'No. dokumen ini sudah dipakai aset lain.');
        }

        if ($errors !== []) {
            return RowResult::error($errors);
        }

        if ($register !== null) {
            $this->seen["ast:{$kode}|{$register}"] = true;
        }
        if ($dokumen !== '') {
            $this->seen["doc:{$dokumen}"] = true;
        }

        return RowResult::baru([
            'kode_barang' => $kode, 'nomor_register' => $register, 'nama_aset' => $nama,
            'category_id' => $categoryId, 'merk_type' => $merk, 'tanggal_perolehan' => $tanggal->toDateString(),
            'sumber_perolehan' => $sumber, 'nilai_perolehan' => $harga, 'nilai_buku' => $buku,
            'kondisi' => $kondisi->value, 'unit_id' => $unitId, 'holder_id' => $holderId,
            'no_dokumen' => $dokumen, 'keterangan' => $keterangan,
        ], $register === null ? 'Tanpa No. Register: dibuatkan nomor baru (mengunggah ulang akan menggandakan aset).' : null);
    }

    public function save(array $data): void
    {
        $register = $data['nomor_register'] ?? ($this->assets->maxRegisterNumber($data['kode_barang']) + 1);

        $asset = Asset::create([
            'kode_barang' => $data['kode_barang'],
            'nomor_register' => $register,
            'nama_aset' => $data['nama_aset'],
            'category_id' => $data['category_id'],
            'unit_id' => $data['unit_id'],
            'current_holder_id' => $data['holder_id'],
            'merk_type' => $data['merk_type'] ?: null,
            'kondisi' => $data['kondisi'],
            'status' => AssetStatus::Aktif,
            'tanggal_perolehan' => $data['tanggal_perolehan'],
            'sumber_perolehan' => $data['sumber_perolehan'] ?: null,
            'nilai_perolehan' => $data['nilai_perolehan'],
            'nilai_buku' => $data['nilai_buku'],
            'no_dokumen' => $data['no_dokumen'] ?: null,
            'keterangan' => $data['keterangan'] ?: null,
        ]);

        $asset->histories()->create([
            'event' => 'dibuat',
            'unit_id' => $asset->unit_id,
            'current_holder_id' => $asset->current_holder_id,
            'kondisi' => $asset->kondisi,
            'user_id' => $this->actor->id,
        ]);
    }

    public function export(array $filters): iterable
    {
        $query = $this->assets->queryVisibleTo($this->actor, $filters)->with(['category.parent', 'unit', 'currentHolder']);

        foreach ($query->lazy(500) as $a) {
            yield [
                $a->kode_barang, $a->nomor_register, $a->nama_aset, $a->category?->parent?->name, $a->category?->name,
                $a->merk_type, $a->tanggal_perolehan->format('d-m-Y'), $a->sumber_perolehan,
                (float) $a->nilai_perolehan, (float) $a->nilai_buku, $a->kondisi->label(),
                $a->unit?->name, $a->currentHolder?->nama, $a->no_dokumen, $a->keterangan,
            ];
        }
    }

    public function exportCount(array $filters): int
    {
        return $this->assets->queryVisibleTo($this->actor, $filters)->count();
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function register(array $row, array &$errors): ?int
    {
        $value = $this->cell($row, 'No. Register');

        if ($value === '') {
            return null;
        }

        if (! ctype_digit($value) || (int) $value < 1) {
            $this->err($errors, 'No. Register', 'No. register harus bilangan bulat positif.');

            return null;
        }

        return (int) $value;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function subcategory(string $kategori, string $sub, array &$errors): ?int
    {
        if ($kategori === '' || $sub === '') {
            $this->err($errors, 'Subkategori', 'Kategori dan Subkategori wajib diisi.');

            return null;
        }

        $this->subkategori ??= AssetCategory::query()->whereNotNull('parent_id')->with('parent')->get()
            ->mapWithKeys(fn ($c) => [mb_strtolower($c->parent->name).'|'.mb_strtolower($c->name) => $c->id])->all();

        $id = $this->subkategori[mb_strtolower($kategori).'|'.mb_strtolower($sub)] ?? null;

        if ($id === null) {
            $this->err($errors, 'Subkategori', "Subkategori \"{$sub}\" pada kategori \"{$kategori}\" tidak ditemukan. Impor kategori terlebih dahulu.");
        }

        return $id;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function tanggal(mixed $value, array &$errors): ?Carbon
    {
        $date = $this->parseDate($value);

        if ($date === null) {
            $this->err($errors, 'Tanggal Perolehan', 'Tanggal tidak valid. Pakai sel tanggal Excel atau teks dd-mm-yyyy.');

            return null;
        }

        if ($date->year < 1900 || $date->isFuture()) {
            $this->err($errors, 'Tanggal Perolehan', 'Tanggal perolehan harus antara tahun 1900 dan hari ini.');

            return null;
        }

        return $date;
    }

    private function parseDate(mixed $value): ?Carbon
    {
        if (is_int($value) || is_float($value)) {
            return $value > 0 ? Carbon::instance(ExcelDate::excelToDateTimeObject($value))->startOfDay() : null;
        }

        $text = trim((string) $value);

        if (preg_match('/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/', $text, $m) && checkdate((int) $m[2], (int) $m[1], (int) $m[3])) {
            return Carbon::create((int) $m[3], (int) $m[2], (int) $m[1])->startOfDay();
        }

        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $text, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            return Carbon::create((int) $m[1], (int) $m[2], (int) $m[3])->startOfDay();
        }

        return null;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function uang(array $row, string $header, array &$errors): ?float
    {
        $value = $row[$header] ?? null;

        if ($value === null || trim((string) $value) === '') {
            $this->err($errors, $header, "{$header} wajib diisi.");

            return null;
        }

        if (! is_numeric($value)) {
            $this->err($errors, $header, "{$header} harus berupa angka murni tanpa titik/koma pemisah (contoh 5000000).");

            return null;
        }

        $number = (float) $value;

        if ($number < 0 || $number > self::MAX_NILAI) {
            $this->err($errors, $header, "{$header} di luar rentang yang diizinkan.");

            return null;
        }

        return $number;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function kondisi(string $value, array &$errors): ?Kondisi
    {
        $needle = mb_strtolower($value);

        foreach (Kondisi::cases() as $kondisi) {
            if ($needle === mb_strtolower($kondisi->label()) || $needle === $kondisi->value) {
                return $kondisi;
            }
        }

        $this->err($errors, 'Kondisi', 'Kondisi harus Baik, Rusak Ringan, Rusak Berat, atau Hilang.');

        return null;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function holder(string $value, int $unitId, array &$errors): ?int
    {
        if ($value === '') {
            return null;
        }

        $this->pegawai[$unitId] ??= Pegawai::where('unit_id', $unitId)->get(['id', 'nama', 'nip'])->all();

        $needle = mb_strtolower($value);
        $hits = array_values(array_filter(
            $this->pegawai[$unitId],
            fn ($p) => $p->nip === $value || mb_strtolower($p->nama) === $needle,
        ));

        if (count($hits) === 1) {
            return $hits[0]->id;
        }

        $this->err($errors, 'Penanggung Jawab', $hits === []
            ? "Pegawai \"{$value}\" tidak ditemukan di unit ini."
            : "Nama \"{$value}\" cocok dengan lebih dari satu pegawai; pakai NIP.");

        return null;
    }
}
