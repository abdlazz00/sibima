<?php

namespace App\Imports;

use App\Models\Pegawai;

class PegawaiImporter extends Importer
{
    public function headers(): array
    {
        return ['Nama', 'NIP', 'Pangkat/Golongan', 'Jabatan', 'Status Kepegawaian', 'Unit', 'No. HP', 'Email Dinas'];
    }

    public function contoh(): array
    {
        return ['Budi Santoso', '198001012005011001', 'III/a', 'Staf Pelayanan', 'PNS', 'Kelurahan Sungai Pelunggut', '081234567890', 'budi@batam.go.id'];
    }

    public function petunjuk(): array
    {
        return [
            'Status Kepegawaian diisi PNS atau PPPK. Unit ditulis persis seperti nama unit di sistem.',
            'Format kolom NIP sebagai Teks agar 18 digit tidak berubah menjadi notasi ilmiah.',
            'Baris dengan NIP yang sudah ada dilewati. Tanpa NIP, pasangan Nama + Unit dipakai sebagai kunci.',
            'Foto profil dan akun login tidak diimpor. Hapus baris contoh sebelum mengunggah.',
        ];
    }

    public function validate(array $row): RowResult
    {
        $errors = [];
        $nama = $this->required($row, 'Nama', 255, $errors);
        $nip = $this->optional($row, 'NIP', 30, $errors);
        $pangkat = $this->optional($row, 'Pangkat/Golongan', 100, $errors);
        $jabatan = $this->required($row, 'Jabatan', 150, $errors);
        $status = mb_strtolower($this->required($row, 'Status Kepegawaian', 20, $errors));
        $unitId = $this->unit($this->cell($row, 'Unit'), $errors);
        $hp = $this->optional($row, 'No. HP', 50, $errors);
        $email = $this->optional($row, 'Email Dinas', 150, $errors);

        if ($status !== '' && ! in_array($status, ['pns', 'pppk'], true)) {
            $this->err($errors, 'Status Kepegawaian', 'Status harus PNS atau PPPK.');
        }

        if ($errors !== []) {
            return RowResult::error($errors);
        }

        $key = $nip !== '' ? "nip:{$nip}" : 'nm:'.mb_strtolower($nama).'|'.$unitId;

        if (isset($this->seen[$key])) {
            return RowResult::duplikat();
        }
        $this->seen[$key] = true;

        $exists = $nip !== ''
            ? Pegawai::where('nip', $nip)->exists()
            : Pegawai::where('unit_id', $unitId)->whereRaw('lower(nama) = ?', [mb_strtolower($nama)])->exists();

        return $exists ? RowResult::duplikat() : RowResult::baru([
            'nama' => $nama, 'nip' => $nip, 'pangkat' => $pangkat, 'jabatan' => $jabatan,
            'status' => $status, 'unit_id' => $unitId, 'no_hp' => $hp, 'email_dinas' => $email,
        ]);
    }

    public function save(array $data): void
    {
        Pegawai::create([
            'nama' => $data['nama'],
            'nip' => $data['nip'] ?: null,
            'pangkat_golongan' => $data['pangkat'] ?: null,
            'jabatan' => $data['jabatan'],
            'status_kepegawaian' => $data['status'],
            'unit_id' => $data['unit_id'],
            'no_hp' => $data['no_hp'] ?: null,
            'email_dinas' => $data['email_dinas'] ?: null,
        ]);
    }

    public function export(array $filters): iterable
    {
        foreach ($this->query()->with('unit')->orderBy('nama')->lazy(500) as $p) {
            yield [
                $p->nama, $p->nip, $p->pangkat_golongan, $p->jabatan,
                strtoupper($p->status_kepegawaian->value), $p->unit->name, $p->no_hp, $p->email_dinas,
            ];
        }
    }

    public function exportCount(array $filters): int
    {
        return $this->query()->count();
    }

    private function query()
    {
        return Pegawai::query()->visibleTo($this->actor);
    }
}
