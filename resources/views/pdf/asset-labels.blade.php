<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 8mm; }
        body { font-family: 'DejaVu Sans', sans-serif; color: #000; margin: 0; padding: 0; }
        table.sheet { width: 100%; border-collapse: separate; border-spacing: 3mm 2.5mm; }
        td.cell { width: {{ 100 / $dims['per_row'] }}%; vertical-align: top; padding: 0; }

        .cut-guide { border: 0.15mm dashed #999; padding: 1.2mm; display: inline-block; }

        table.label {
            width: {{ $dims['width'] }}mm;
            height: {{ $dims['height'] }}mm;
            border: 0.35mm solid #000;
            border-collapse: collapse;
            table-layout: fixed;
        }
        table.label td { padding: 0; vertical-align: middle; }

        .qr-col {
            width: {{ $dims['qr_col'] }}mm;
            text-align: center;
            border-right: 0.35mm solid #000;
        }
        .qr-col img {
            width: {{ $dims['qr'] }}mm;
            height: {{ $dims['qr'] }}mm;
            display: block;
            margin: 0 auto;
        }

        .info-col { width: {{ $dims['info_col'] }}mm; padding: 0; }
        .info-table { width: 100%; height: {{ $dims['height'] }}mm; border-collapse: collapse; }
        .info-table td {
            height: {{ $dims['row_height'] }}mm;
            border-bottom: 0.3mm solid #000;
            padding: 0.5mm 2mm;
            vertical-align: middle;
        }
        .info-table tr:last-child td { border-bottom: none; }

        .header-row { text-align: center; font-weight: bold; font-size: {{ $dims['header_font'] }}pt; line-height: 1.2; letter-spacing: 0.2pt; }
        .header-row.kel { font-size: {{ $dims['header_font_kel'] }}pt; line-height: 1.1; }
        .name-row { font-size: {{ $dims['name_font'] }}pt; font-weight: bold; line-height: 1.2; word-break: break-word; max-height: {{ $dims['row_height'] }}mm; overflow: hidden; }
        .code-row { font-size: {{ $dims['code_font'] }}pt; font-weight: 500; letter-spacing: 0.3pt; word-break: break-word; }
    </style>
</head>
<body>
<table class="sheet">
    @foreach ($rows as $row)
        <tr>
            @foreach ($row as $label)
                @php $isKel = isset($label['asset']->unit) && $label['asset']->unit->type === 'kelurahan'; @endphp
                <td class="cell">
                    <div class="cut-guide">
                    <table class="label">
                        <tr>
                            <td class="qr-col">
                                <img src="{{ $label['qr'] }}" alt="QR Code">
                            </td>
                            <td class="info-col">
                                <table class="info-table">
                                    <tr>
                                        <td class="header-row {{ $isKel ? 'kel' : '' }}">
                                            @if ($isKel)
                                                INVENTARIS<br>
                                                {{ strtoupper($label['asset']->unit->name) }}<br>
                                                KECAMATAN SAGULUNG
                                            @else
                                                INVENTARIS<br>
                                                {{ strtoupper($label['asset']->unit->name ?? 'KECAMATAN SAGULUNG') }}
                                            @endif
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="name-row">{{ $label['name'] }}</td>
                                    </tr>
                                    <tr>
                                        <td class="code-row">{{ $label['asset']->kode_barang }}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    </div>
                </td>
            @endforeach
            @for ($i = $row->count(); $i < $dims['per_row']; $i++)
                <td class="cell"></td>
            @endfor
        </tr>
    @endforeach
</table>
</body>
</html>
