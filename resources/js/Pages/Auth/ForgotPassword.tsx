import InputError from '@/Components/InputError';
import AuthSplitLayout from '@/Layouts/AuthSplitLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect, useRef } from 'react';

const backLink =
    'inline-flex min-h-11 items-center gap-1.5 rounded text-sm font-medium text-primary hover:text-primary-hover hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1';

export default function ForgotPassword({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const successHeading = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (status) successHeading.current?.focus();
    }, [status]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('password.email'));
    };

    if (status) {
        return (
            <AuthSplitLayout>
                <Head title="Periksa Email - SIBIMA" />

                <div
                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
                    aria-hidden="true"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-6 w-6"
                    >
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                </div>

                <h1
                    ref={successHeading}
                    tabIndex={-1}
                    className="mb-2 text-[28px] font-bold tracking-tight text-gray-900 focus:outline-none"
                >
                    Periksa Email Anda
                </h1>
                <p className="mb-2 text-sm text-gray-600">
                    {status}
                </p>
                <p className="mb-7 text-sm text-gray-600">
                    Tautan berlaku 60 menit. Jika tidak ada di kotak masuk,
                    periksa juga folder spam.
                </p>

                <div className="flex flex-col items-start gap-3">
                    <Link href={route('login')} className={backLink}>
                        Kembali ke Halaman Masuk
                    </Link>
                    <Link href={route('password.request')} className={backLink}>
                        Gunakan email lain
                    </Link>
                </div>
            </AuthSplitLayout>
        );
    }

    return (
        <AuthSplitLayout>
            <Head title="Lupa Kata Sandi - SIBIMA" />

            <h1 className="mb-2 text-[28px] font-bold tracking-tight text-gray-900">
                Lupa Kata Sandi
            </h1>
            <p className="mb-7 text-sm text-gray-600">
                Masukkan email kedinasan Anda yang terdaftar untuk menerima
                tautan pemulihan kata sandi.
            </p>

            <form onSubmit={submit} className="space-y-5">
                <div>
                    <label
                        htmlFor="email"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Email Kedinasan
                    </label>
                    <input
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        autoComplete="email"
                        autoFocus
                        placeholder="Masukkan email kedinasan"
                        onChange={(e) => setData('email', e.target.value)}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                    />
                    <InputError message={errors.email} className="mt-1.5" />
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? 'Mengirim...' : 'Kirim Tautan Pemulihan'}
                </button>
            </form>

            <div className="mt-4 flex flex-col items-start gap-1">
                <Link href={route('login')} className={backLink}>
                    <span aria-hidden="true">&larr;</span> Kembali ke Halaman
                    Masuk
                </Link>
                <p className="text-sm text-gray-500">
                    Tidak punya akses ke email tersebut? Hubungi admin
                    Kecamatan.
                </p>
            </div>
        </AuthSplitLayout>
    );
}
