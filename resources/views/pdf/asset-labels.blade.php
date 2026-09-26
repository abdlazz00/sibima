<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 8mm; }
        body { font-family: 'DejaVu Sans', sans-serif; color: #0f1729; }
        table.sheet { width: 100%; border-collapse: separate; border-spacing: 3mm; }
        td.cell { width: 50%; vertical-align: top; }

        table.label {
            width: 83mm;
            height: 38mm;
            border: 0.3mm solid #000;
            border-collapse: collapse;
            table-layout: fixed;
        }
        table.label td { padding: 0; vertical-align: middle; }

        .logo-col { width: 11mm; text-align: center; padding: 0 0.5mm; border-right: 0.3mm solid #000; }
        .logo-col img { width: 10mm; height: auto; }

        .info-col { width: 57mm; padding: 1.5mm 2.2mm; border-right: 0.3mm solid #000; }
        .brand {
            font-weight: bold;
            font-size: 7pt;
            letter-spacing: 0.2pt;
            padding-bottom: 0.8mm;
            margin-bottom: 0.8mm;
            border-bottom: 0.3mm solid #000;
        }
        .line { font-size: 5.6pt; font-weight: 500; margin-top: 0.8mm; line-height: 1.25; word-break: break-word; }

        .qr-col { width: 15mm; text-align: center; padding: 0 0.8mm; }
        .qr-col img { width: 13.4mm; height: 13.4mm; }
    </style>
</head>
<body>
<table class="sheet">
    @foreach ($rows as $row)
        <tr>
            @foreach ($row as $label)
                <td class="cell">
                    <table class="label">
                        <tr>
                            <td class="logo-col"><img src="{{ $logo }}" alt=""></td>
                            <td class="info-col">
                                <div class="brand">KECAMATAN SAGULUNG</div>
                                <div class="line">NAMA ASET : {{ $label['asset']->nama_aset }}</div>
                                <div class="line">NOMOR ASET: {{ $label['asset']->kode_barang }}</div>
                            </td>
                            <td class="qr-col">
                                <img src="{{ $label['qr'] }}" alt="">
                            </td>
                        </tr>
                    </table>
                </td>
            @endforeach
            @for ($i = $row->count(); $i < 2; $i++)
                <td class="cell"></td>
            @endfor
        </tr>
    @endforeach
</table>
</body>
</html>
