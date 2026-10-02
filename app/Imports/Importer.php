<?php

namespace App\Imports;

use App\Models\Unit;
use App\Models\User;

/** Kontrak per modul + helper bersama. Mesin import tidak tahu apa pun tentang aset atau pegawai. */
abstract class Importer
{
    protected User $actor;

    /** @var array<string, true> */
    protected array $seen = [];

    /** @var array<string, int>|null */
    private ?array $units = null;

    /** @return list<string> */
    abstract public function headers(): array;

    /** @return array<int, mixed> */
    abstract public function contoh(): array;

    /** @return list<string> */
    abstract public function petunjuk(): array;

    /** @param array<string, mixed> $row baris mentah, kunci = header */
    abstract public function validate(array $row): RowResult;

    /** @param array<string, mixed> $data RowResult::$data dari baris berstatus baru */
    abstract public function save(array $data): void;

    /**
     * @param  array<string, mixed>  $filters
     * @return iterable<array<int, mixed>>
     */
    abstract public function export(array $filters): iterable;

    /** @param array<string, mixed> $filters */
    abstract public function exportCount(array $filters): int;

    public function begin(User $actor): void
    {
        $this->actor = $actor;
        $this->seen = [];
        $this->units = null;
    }

    /** Sel sebagai teks ber-trim; angka utuh tidak menjadi notasi ilmiah. */
    protected function cell(array $row, string $header): string
    {
        $value = $row[$header] ?? null;

        if (is_float($value) && floor($value) == $value) {
            return number_format($value, 0, '', '');
        }

        return trim((string) $value);
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    protected function required(array $row, string $header, int $max, array &$errors): string
    {
        $value = $this->cell($row, $header);

        if ($value === '') {
            $this->err($errors, $header, "{$header} wajib diisi.");
        }

        return $this->limit($value, $header, $max, $errors);
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    protected function optional(array $row, string $header, int $max, array &$errors): string
    {
        return $this->limit($this->cell($row, $header), $header, $max, $errors);
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    protected function err(array &$errors, string $kolom, string $alasan): void
    {
        $errors[] = ['kolom' => $kolom, 'alasan' => $alasan];
    }

    /**
     * Unit dicocokkan lewat nama dan harus dalam cakupan pengimpor.
     *
     * @param  list<array{kolom: string, alasan: string}>  $errors
     */
    protected function unit(string $name, array &$errors): ?int
    {
        if ($name === '') {
            $this->err($errors, 'Unit', 'Unit wajib diisi.');

            return null;
        }

        $this->units ??= Unit::query()->pluck('id', 'name')
            ->mapWithKeys(fn ($id, $unit) => [mb_strtolower(trim($unit)) => (int) $id])->all();

        $id = $this->units[mb_strtolower($name)] ?? null;

        if ($id === null) {
            $this->err($errors, 'Unit', "Unit \"{$name}\" tidak dikenal.");

            return null;
        }

        $scope = $this->actor->accessibleUnitIds();

        if ($scope !== null && ! in_array($id, $scope, true)) {
            $this->err($errors, 'Unit', "Unit \"{$name}\" di luar cakupan Anda.");

            return null;
        }

        return $id;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function limit(string $value, string $header, int $max, array &$errors): string
    {
        if (mb_strlen($value) > $max) {
            $this->err($errors, $header, "{$header} maksimal {$max} karakter.");
        }

        return $value;
    }
}
