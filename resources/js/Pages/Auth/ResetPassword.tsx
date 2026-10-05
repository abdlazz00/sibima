import InputError from '@/Components/InputError';
import PasswordInput from '@/Components/PasswordInput';
import AuthSplitLayout from '@/Layouts/AuthSplitLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function ResetPassword({
    token,
    email,
}: {
    token: string;
    email: string;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token: token,
        email: email,
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    // Satu-satunya error pada kolom email datang dari tautan yang tidak valid atau kedaluwarsa.
    if (errors.email) {
        return (
            <AuthSplitLayout>
                <Head title="Tautan Tidak Berlaku - SIBIMA" />

                <h1 className="mb-4 text-[28px] font-bold tracking-tight text-gray-900">
                    Tautan Tidak Berlaku
                </h1>
                <div
                    role="alert"
                    className="mb-7 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
                >
                    {errors.email}
                </div>

                <Link
                    href={route('password.request')}
                    className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:bg-primary-dark"
                >
                    Minta Tautan Baru
                </Link>
                <div className="mt-4">
                    <Link
                        href={route('login')}
                        className="inline-flex min-h-11 items-center rounded text-sm font-medium text-primary hover:text-primary-hover hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                    >
                        Kembali ke Halaman Masuk
                    </Link>
                </div>
            </AuthSplitLayout>
        );
    }

    return (
        <AuthSplitLayout>
            <Head title="Atur Ulang Kata Sandi - SIBIMA" />

            <h1 className="mb-2 text-[28px] font-bold tracking-tight text-gray-900">
                Atur Ulang Kata Sandi
            </h1>
            <p className="mb-7 text-sm text-gray-600">
                Buat kata sandi baru untuk akun Anda.
            </p>

            <form onSubmit={submit} className="space-y-5">
                <div>
                    <label
                        htmlFor="email"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        autoComplete="username"
                        readOnly
                        aria-readonly="true"
                        className="h-11 w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3.5 text-sm text-gray-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label
                        htmlFor="password"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Kata Sandi Baru
                    </label>
                    <PasswordInput
                        id="password"
                        name="password"
                        value={data.password}
                        autoComplete="new-password"
                        autoFocus
                        placeholder=""
                        describedBy="password-hint"
                        onChange={(v) => setData('password', v)}
                    />
                    <p id="password-hint" className="mt-1.5 text-xs text-gray-500">
                        Minimal 8 karakter.
                    </p>
                    <InputError message={errors.password} className="mt-1.5" />
                </div>

                <div>
                    <label
                        htmlFor="password_confirmation"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Konfirmasi Kata Sandi Baru
                    </label>
                    <PasswordInput
                        id="password_confirmation"
                        name="password_confirmation"
                        value={data.password_confirmation}
                        autoComplete="new-password"
                        placeholder=""
                        onChange={(v) => setData('password_confirmation', v)}
                    />
                    <InputError
                        message={errors.password_confirmation}
                        className="mt-1.5"
                    />
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
                </button>
            </form>
        </AuthSplitLayout>
    );
}
