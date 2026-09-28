<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <style>
        @page {
            size: A4 portrait;
            margin: 8mm;
        }
        body {
            font-family: 'DejaVu Sans', sans-serif;
            color: #000;
            margin: 0;
            padding: 0;
        }
        table.sheet {
            width: 100%;
            border-collapse: separate;
            border-spacing: 3mm 2.5mm;
            page-break-inside: auto;
        }
        table.sheet tr {
            page-break-inside: avoid;
            page-break-after: auto;
        }
        td.cell {
            width: {{ 100 / $dims['per_row'] }}%;
            vertical-align: top;
            padding: 0;
            page-break-inside: avoid;
        }

        .cut-guide {
            border: 0.15mm dashed #888;
            padding: 1.0mm;
            display: inline-block;
            page-break-inside: avoid;
        }

        table.label {
            width: {{ $dims['width'] }}mm;
            height: {{ $dims['height'] }}mm;
            border: 0.35mm solid #000;
            border-collapse: collapse;
            table-layout: fixed;
            page-break-inside: avoid;
        }
        table.label td {
            padding: 0;
            vertical-align: middle;
        }

        .qr-col {
            width: {{ $dims['qr_pct'] }}%;
            max-width: {{ $dims['qr_col'] }}mm;
            height: {{ $dims['height'] }}mm;
            text-align: center;
            border-right: 0.35mm solid #000;
            vertical-align: middle;
            padding: 0;
        }
        .qr-col img {
            width: {{ $dims['qr'] }}mm;
            height: {{ $dims['qr'] }}mm;
            display: block;
            margin: 0 auto;
        }

        .info-col {
            width: {{ $dims['info_pct'] }}%;
            height: {{ $dims['height'] }}mm;
            padding: 0;
            vertical-align: top;
        }
        .info-table {
            width: 100%;
            height: {{ $dims['height'] }}mm;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .info-table tr.header-tr,
        .info-table tr.header-tr td {
            height: {{ $dims['header_row_height'] }}mm;
        }
        .info-table tr.name-tr,
        .info-table tr.name-tr td {
            height: {{ $dims['name_row_height'] }}mm;
        }
        .info-table tr.code-tr,
        .info-table tr.code-tr td {
            height: {{ $dims['code_row_height'] }}mm;
        }
        .info-table td {
            border-bottom: 0.35mm solid #000;
            vertical-align: middle;
            padding: 0;
        }
        .info-table tr:last-child td {
            border-bottom: none;
        }

        .info-table td.header-row {
            text-align: center;
            font-size: {{ $dims['header_font'] }}pt;
            font-weight: bold;
            line-height: 1.15;
            letter-spacing: 0.2pt;
            padding: 0.2mm 1.5mm;
            vertical-align: middle;
        }
        .info-table td.header-row.kel {
            font-size: {{ $dims['header_font_kel'] }}pt;
            line-height: 1.1;
        }
        .info-table td.name-row {
            padding-left: 4.5mm;
            padding-right: 2.0mm;
            vertical-align: middle;
        }
        .name-box {
            font-size: {{ $dims['name_font'] }}pt;
            font-weight: bold;
            line-height: 1.2;
            max-height: {{ $dims['name_box_height'] }}mm;
            overflow: hidden;
            word-wrap: break-word;
            word-break: break-word;
        }
        .info-table td.code-row {
            padding-left: 4.5mm;
            padding-right: 2.0mm;
            vertical-align: middle;
        }
        .code-box {
            font-size: {{ $dims['code_font'] }}pt;
            line-height: 1.2;
            word-wrap: break-word;
            word-break: break-word;
        }
        .code-main {
            font-weight: bold;
            letter-spacing: 0.2pt;
        }
        .code-meta {
            font-size: {{ $dims['code_font'] * 0.92 }}pt;
            color: #333;
            font-weight: normal;
        }
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
                        <colgroup>
                            <col style="width: {{ $dims['qr_pct'] }}%;">
                            <col style="width: {{ $dims['info_pct'] }}%;">
                        </colgroup>
                        <tr>
                            <td class="qr-col">
                                <img src="{{ $label['qr'] }}" alt="QR Code Aset {{ $label['asset']->kode_barang }} - {{ $label['asset']->registerLabel() }}">
                            </td>
                            <td class="info-col">
                                <table class="info-table">
                                    <tr class="header-tr">
                                        <td class="header-row {{ $isKel ? 'kel' : '' }}">
                                            @if ($isKel)
                                                INVENTARIS BMD<br>
                                                {{ strtoupper($label['asset']->unit->name) }}<br>
                                                KECAMATAN SAGULUNG
                                            @else
                                                INVENTARIS BMD<br>
                                                {{ strtoupper($label['asset']->unit->name ?? 'KECAMATAN SAGULUNG') }}
                                            @endif
                                        </td>
                                    </tr>
                                    <tr class="name-tr">
                                        <td class="name-row">
                                            <div class="name-box">{{ $label['name'] }}</div>
                                        </td>
                                    </tr>
                                    <tr class="code-tr">
                                        <td class="code-row">
                                            <div class="code-box">
                                                <span class="code-main">{{ $label['asset']->kode_barang }} / {{ $label['asset']->registerLabel() }}</span>
                                                @if (isset($label['tahun']) && $label['tahun'] !== '-')
                                                    <span class="code-meta">({{ $label['tahun'] }})</span>
                                                @endif
                                            </div>
                                        </td>
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
