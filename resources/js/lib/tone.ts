export type Tone =
    'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal' | 'slate';

/** Kelas Tailwind dituliskan utuh agar terbaca pemindai kelas. */
export const TONE: Record<
    Tone,
    {
        card: string;
        chip: string;
        soft: string;
        value: string;
        accent: string;
        solid: string;
    }
> = {
    blue: {
        card: 'border-blue-200 bg-blue-50',
        chip: 'bg-blue-700 text-white',
        soft: 'bg-blue-100 text-blue-700',
        value: 'text-blue-950',
        accent: 'border-t-blue-600',
        solid: 'bg-blue-800 hover:bg-blue-900 focus-visible:ring-blue-800',
    },
    green: {
        card: 'border-emerald-200 bg-emerald-50',
        chip: 'bg-emerald-700 text-white',
        soft: 'bg-emerald-100 text-emerald-700',
        value: 'text-emerald-950',
        accent: 'border-t-emerald-600',
        solid: 'bg-emerald-700 hover:bg-emerald-800 focus-visible:ring-emerald-700',
    },
    amber: {
        card: 'border-amber-200 bg-amber-50',
        chip: 'bg-amber-600 text-white',
        soft: 'bg-amber-100 text-amber-700',
        value: 'text-amber-950',
        accent: 'border-t-amber-500',
        solid: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-600',
    },
    red: {
        card: 'border-red-200 bg-red-50',
        chip: 'bg-red-700 text-white',
        soft: 'bg-red-100 text-red-700',
        value: 'text-red-950',
        accent: 'border-t-red-600',
        solid: 'bg-red-700 hover:bg-red-800 focus-visible:ring-red-700',
    },
    violet: {
        card: 'border-violet-200 bg-violet-50',
        chip: 'bg-violet-700 text-white',
        soft: 'bg-violet-100 text-violet-700',
        value: 'text-violet-950',
        accent: 'border-t-violet-600',
        solid: 'bg-violet-700 hover:bg-violet-800 focus-visible:ring-violet-700',
    },
    teal: {
        card: 'border-teal-200 bg-teal-50',
        chip: 'bg-teal-700 text-white',
        soft: 'bg-teal-100 text-teal-700',
        value: 'text-teal-950',
        accent: 'border-t-teal-600',
        solid: 'bg-teal-700 hover:bg-teal-800 focus-visible:ring-teal-700',
    },
    slate: {
        card: 'border-slate-200 bg-slate-50',
        chip: 'bg-slate-700 text-white',
        soft: 'bg-slate-100 text-slate-700',
        value: 'text-slate-900',
        accent: 'border-t-slate-500',
        solid: 'bg-slate-700 hover:bg-slate-800 focus-visible:ring-slate-700',
    },
};
