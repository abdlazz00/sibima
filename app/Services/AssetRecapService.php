<?php

namespace App\Services;

use App\Enums\Kondisi;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Models\User;

class AssetRecapService
{
    private const SUMS = 'COUNT(*) as jumlah, COALESCE(SUM(nilai_perolehan), 0) as nilai_perolehan, COALESCE(SUM(nilai_buku), 0) as nilai_buku';

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function for(User $user, array $filters): array
    {
        $query = new ReportQuery($user);
        $base = fn () => $query->build('aset', $filters)->reorder()->toBase();

        $ringkasan = $this->zero();
        $perKondisi = [];
        foreach ($base()->selectRaw('kondisi, '.self::SUMS)->groupBy('kondisi')->get() as $row) {
            $perKondisi[$row->kondisi] = (int) $row->jumlah;
            $ringkasan = $this->add($ringkasan, $row);
        }

        return [
            'ringkasan' => $ringkasan,
            'kondisi' => $this->kondisi($perKondisi, $ringkasan['jumlah']),
            'tren' => $this->tren($base()->selectRaw('tanggal_perolehan, '.self::SUMS)->groupBy('tanggal_perolehan')->get()),
            'rekap_kategori' => $this->rekapKategori($base()->selectRaw('category_id, '.self::SUMS)->groupBy('category_id')->get()),
            'rekap_unit' => $this->rekapUnit($user, $base()->selectRaw('unit_id, '.self::SUMS)->groupBy('unit_id')->get()),
        ];
    }

    /** @return array{jumlah: int, nilai_perolehan: float, nilai_buku: float} */
    private function zero(): array
    {
        return ['jumlah' => 0, 'nilai_perolehan' => 0.0, 'nilai_buku' => 0.0];
    }

    /**
     * @param  array{jumlah: int, nilai_perolehan: float, nilai_buku: float}  $total
     * @return array{jumlah: int, nilai_perolehan: float, nilai_buku: float}
     */
    private function add(array $total, object $row): array
    {
        return [
            'jumlah' => $total['jumlah'] + (int) $row->jumlah,
            'nilai_perolehan' => $total['nilai_perolehan'] + (float) $row->nilai_perolehan,
            'nilai_buku' => $total['nilai_buku'] + (float) $row->nilai_buku,
        ];
    }

    /**
     * @param  array<string, int>  $perKondisi
     * @return list<array{kondisi: string, label: string, jumlah: int, persen: float}>
     */
    private function kondisi(array $perKondisi, int $total): array
    {
        return array_map(function (Kondisi $kondisi) use ($perKondisi, $total) {
            $jumlah = $perKondisi[$kondisi->value] ?? 0;

            return [
                'kondisi' => $kondisi->value,
                'label' => $kondisi->label(),
                'jumlah' => $jumlah,
                'persen' => $total > 0 ? round($jumlah / $total * 100, 1) : 0.0,
            ];
        }, Kondisi::cases());
    }

    /** @return list<array{tahun: int, jumlah: int, nilai_perolehan: float, nilai_buku: float}> */
    private function tren($rows): array
    {
        $years = [];
        foreach ($rows as $row) {
            $year = (int) substr((string) $row->tanggal_perolehan, 0, 4);
            $years[$year] = $this->add($years[$year] ?? $this->zero(), $row);
        }

        if ($years === []) {
            return [];
        }

        $result = [];
        foreach (range(min(array_keys($years)), max(array_keys($years))) as $year) {
            $result[] = ['tahun' => $year] + ($years[$year] ?? $this->zero());
        }

        return $result;
    }

    /** @return array{grup: list<array<string, mixed>>, total: array<string, int|float>} */
    private function rekapKategori($rows): array
    {
        $categories = AssetCategory::query()->get(['id', 'name', 'parent_id'])->keyBy('id');
        $groups = [];
        $total = $this->zero();

        foreach ($rows as $row) {
            $category = $categories[$row->category_id];
            $main = $category->parent_id !== null ? $categories[$category->parent_id] : $category;

            $groups[$main->id] ??= ['id' => (int) $main->id, 'nama' => $main->name] + $this->zero() + ['anak' => []];
            $groups[$main->id] = array_merge($groups[$main->id], $this->add(
                ['jumlah' => $groups[$main->id]['jumlah'], 'nilai_perolehan' => $groups[$main->id]['nilai_perolehan'], 'nilai_buku' => $groups[$main->id]['nilai_buku']],
                $row,
            ));

            if ($category->parent_id !== null) {
                $groups[$main->id]['anak'][] = ['id' => (int) $category->id, 'nama' => $category->name]
                    + $this->add($this->zero(), $row);
            }

            $total = $this->add($total, $row);
        }

        foreach ($groups as &$group) {
            usort($group['anak'], fn ($a, $b) => strcmp($a['nama'], $b['nama']));
        }
        unset($group);

        $groups = array_values($groups);
        usort($groups, fn ($a, $b) => [$b['jumlah'], $a['nama']] <=> [$a['jumlah'], $b['nama']]);

        return ['grup' => $groups, 'total' => $total];
    }

    /** @return array{baris: list<array<string, mixed>>, total: array<string, int|float>}|null */
    private function rekapUnit(User $user, $rows): ?array
    {
        $ids = $user->accessibleUnitIds();

        if (($ids === null ? Unit::count() : count($ids)) <= 1) {
            return null;
        }

        $byUnit = collect($rows)->keyBy('unit_id');
        $total = $this->zero();
        $baris = [];

        foreach (Unit::whereIn('id', $byUnit->keys())->orderBy('type')->orderBy('name')->get() as $unit) {
            $row = $byUnit[$unit->id];
            $baris[] = ['id' => (int) $unit->id, 'nama' => $unit->name] + $this->add($this->zero(), $row);
            $total = $this->add($total, $row);
        }

        return ['baris' => $baris, 'total' => $total];
    }
}
