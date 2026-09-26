<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 10mm; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 8pt; color: #111; }
        table { width: 100%; border-collapse: separate; border-spacing: 3mm; }
        td.label { width: 33%; border: 0.3mm solid #444; padding: 2mm; vertical-align: top; }
        .brand { font-weight: bold; font-size: 7pt; letter-spacing: 0.5pt; }
        .qr { width: 26mm; height: 26mm; }
        .name { font-weight: bold; font-size: 9pt; margin-top: 1mm; }
        .code { font-family: 'DejaVu Sans Mono', monospace; font-size: 7pt; }
        .unit { font-size: 7pt; color: #444; }
    </style>
</head>
<body>
<table>
    @foreach ($rows as $row)
        <tr>
            @foreach ($row as $label)
                <td class="label">
                    <div class="brand">SIBIMA · KECAMATAN SAGULUNG</div>
                    <img class="qr" src="{{ $label['qr'] }}" alt="QR">
                    <div class="name">{{ $label['asset']->nama_aset }}</div>
                    <div class="code">{{ $label['asset']->kode_barang }} / {{ $label['asset']->registerLabel() }}</div>
                    <div class="unit">{{ $label['asset']->unit->name }}</div>
                </td>
            @endforeach
            @for ($i = $row->count(); $i < 3; $i++)
                <td></td>
            @endfor
        </tr>
    @endforeach
</table>
</body>
</html>
