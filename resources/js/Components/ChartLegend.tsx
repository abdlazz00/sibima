export default function ChartLegend({
    items,
    unit,
}: {
    items: { label: string; jumlah: number; persen: number; color: string }[];
    unit: string;
}) {
    return (
        <ul className="mt-4 space-y-2.5 text-base">
            {items.map((i) => (
                <li key={i.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-slate-800">
                        <span className="size-3.5 rounded-xs" style={{ backgroundColor: i.color }} aria-hidden="true" />
                        {i.label}
                    </span>
                    <span className="tabular-nums text-slate-600">
                        {i.jumlah.toLocaleString('id-ID')} {unit} · {i.persen.toLocaleString('id-ID')}%
                    </span>
                </li>
            ))}
        </ul>
    );
}
