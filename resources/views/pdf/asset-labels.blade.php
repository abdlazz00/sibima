<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 8mm; }
        body { font-family: 'DejaVu Sans', sans-serif; color: #000; margin: 0; padding: 0; }
        table.sheet { width: 100%; border-collapse: separate; border-spacing: 3mm 2.5mm; }
        td.cell { width: 50%; vertical-align: top; padding: 0; }

        table.label {
            width: 83mm;
            height: 25mm;
            border: 0.35mm solid #000;
            border-collapse: collapse;
        }
        table.label td { padding: 0; vertical-align: middle; }

        .logo-col {
            width: 15mm;
            text-align: center;
            vertical-align: middle;
            border-right: 0.35mm solid #000;
            padding: 0.5mm;
        }
        .logo-col img {
            width: 13.5mm;
            height: auto;
            display: block;
            margin: 0 auto;
        }

        .info-col {
            width: 48mm;
            vertical-align: top !important;
            border-right: 0.35mm solid #000;
            padding: 0;
        }
        .inner-table {
            width: 100%;
            height: 25mm;
            border-collapse: collapse;
            border: none;
        }
        .brand-header {
            height: 7.5mm;
            border-bottom: 0.35mm solid #000;
            border-top: none;
            border-left: none;
            border-right: none;
            padding: 0.8mm 1.5mm;
            text-align: center;
            vertical-align: middle;
            font-weight: bold;
            font-size: 6pt;
            line-height: 1.2;
            letter-spacing: 0.2pt;
        }
        .brand-header-kel {
            height: 8.5mm;
            font-size: 5.2pt;
            line-height: 1.15;
            padding: 0.6mm 1.5mm;
        }
        .detail-cell {
            height: 17.5mm;
            border: none !important;
            padding: 0 2.5mm;
            vertical-align: middle;
            text-align: left;
        }
        .detail-cell-kel {
            height: 16.5mm;
        }
        .asset-name {
            font-size: 7.2pt;
            font-weight: bold;
            line-height: 1.25;
            word-break: break-word;
            margin-bottom: 1.2mm;
        }
        .asset-code {
            font-size: 6.2pt;
            font-weight: 500;
            line-height: 1.15;
            letter-spacing: 0.3pt;
            word-break: break-word;
        }

        .qr-col {
            width: 20mm;
            text-align: center;
            vertical-align: middle;
            padding: 0.5mm;
        }
        .qr-col img {
            width: 19mm;
            height: 19mm;
            display: block;
            margin: 0 auto;
        }
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
                            <td class="logo-col" style="width: 15mm;">
                                <img src="{{ $logo }}" alt="Logo">
                            </td>
                            <td class="info-col" style="width: 48mm;">
                                <table class="inner-table">
                                    <tr>
                                        @if (isset($label['asset']->unit) && $label['asset']->unit->type === 'kelurahan')
                                            <td class="brand-header brand-header-kel">
                                                INVENTARIS<br>
                                                {{ strtoupper($label['asset']->unit->name) }}<br>
                                                KECAMATAN SAGULUNG
                                            </td>
                                        @else
                                            <td class="brand-header">
                                                INVENTARIS<br>
                                                {{ strtoupper($label['asset']->unit->name ?? 'KECAMATAN SAGULUNG') }}
                                            </td>
                                        @endif
                                    </tr>
                                    <tr>
                                        <td class="detail-cell {{ isset($label['asset']->unit) && $label['asset']->unit->type === 'kelurahan' ? 'detail-cell-kel' : '' }}">
                                            <div class="asset-name">{{ $label['asset']->nama_aset }}</div>
                                            <div class="asset-code">{{ $label['asset']->kode_barang }}</div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td class="qr-col" style="width: 20mm;">
                                <img src="{{ $label['qr'] }}" alt="QR Code">
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
