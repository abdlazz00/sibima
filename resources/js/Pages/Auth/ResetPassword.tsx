import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
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

                <Button color="primary" size="lg" className="w-full" href={route('password.request')}>
                    Minta Tautan Baru
                </Button>
                <div className="mt-4">
                    <Link
                        href={route('login')}
                        className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-blue-800 hover:text-blue-700 hover:underline focus:outline-hidden focus:ring-2 focus:ring-blue-800 focus:ring-offset-1"
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
                <Input
                    label="Email"
                    name="email"
                    type="email"
                    size="lg"
                    autoComplete="username"
                    isReadOnly
                    wrapperClassName="bg-gray-50"
                    inputClassName="cursor-not-allowed text-gray-500"
                    value={data.email}
                />

                <Input
                    label="Kata Sandi Baru"
                    name="password"
                    type="password"
                    size="lg"
                    autoComplete="new-password"
                    autoFocus
                    isRequired
                    hideRequiredIndicator
                    value={data.password}
                    onChange={(v) => setData('password', v)}
                    isInvalid={Boolean(errors.password)}
                    hint={errors.password ?? 'Minimal 8 karakter.'}
                />

                <Input
                    label="Konfirmasi Kata Sandi Baru"
                    name="password_confirmation"
                    type="password"
                    size="lg"
                    autoComplete="new-password"
                    isRequired
                    hideRequiredIndicator
                    value={data.password_confirmation}
                    onChange={(v) => setData('password_confirmation', v)}
                    isInvalid={Boolean(errors.password_confirmation)}
                    hint={errors.password_confirmation}
                />

                <Button type="submit" color="primary" size="lg" className="w-full" isLoading={processing}>
                    Simpan Kata Sandi Baru
                </Button>
            </form>
        </AuthSplitLayout>
    );
}
