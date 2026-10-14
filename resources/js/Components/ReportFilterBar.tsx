import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';
import { Download01 } from '@untitledui/icons';
import { ReactNode } from 'react';

const ALL = '__all';

export function ReportSelect({
    label,
    value,
    onChange,
    allLabel,
    options,
}: {
    label: string;
    value?: string | number;
    onChange: (value: string) => void;
    allLabel: string;
    options: { value: string | number; label: string }[];
}) {
    return (
        <Select
            label={label}
            size="md"
            items={[{ id: ALL, label: allLabel }, ...options.map((o) => ({ id: String(o.value), label: o.label }))]}
            selectedKey={value ? String(value) : ALL}
            onSelectionChange={(key) => onChange(key === ALL ? '' : String(key))}
        >
            {(item) => <Select.Item id={item.id} label={item.label} />}
        </Select>
    );
}

export function ReportDate({ label, value, onChange }: { label: string; value?: string | number; onChange: (value: string) => void }) {
    return <Input label={label} type="date" size="md" value={value ? String(value) : ''} onChange={onChange} />;
}

export default function ReportFilterBar({
    children,
    dirty,
    total,
    downloadUrl,
    onApply,
}: {
    children: ReactNode;
    dirty: boolean;
    total: number;
    downloadUrl: string;
    onApply: () => void;
}) {
    const { errors } = usePage<PageProps & { errors: Record<string, string> }>().props;
    const errorMessages = Object.values(errors ?? {});

    return (
        <>
            {errorMessages.length > 0 && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {errorMessages.map((m) => (
                        <p key={m}>{m}</p>
                    ))}
                </div>
            )}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onApply();
                }}
                className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button type="submit" color="secondary" size="md">
                        Terapkan filter
                    </Button>
                    <div className="flex flex-wrap items-center gap-4">
                        <p className={`text-sm text-slate-600 ${dirty ? 'opacity-50' : ''}`}>
                            <span className="font-semibold tabular-nums text-slate-900">{total}</span> baris akan diunduh
                            {dirty && <span className="ml-2 text-amber-700">(terapkan filter dulu)</span>}
                        </p>
                        <Button
                            color="primary"
                            size="md"
                            iconLeading={Download01}
                            isDisabled={total === 0 || dirty}
                            onPress={() => {
                                window.location.href = downloadUrl;
                            }}
                        >
                            Unduh Excel
                        </Button>
                    </div>
                </div>
            </form>
        </>
    );
}
