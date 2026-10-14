import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import AuthSplitLayout from '@/Layouts/AuthSplitLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Mail01 } from '@untitledui/icons';
import { FormEventHandler, useEffect, useRef } from 'react';

const backLink =
    'inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-blue-800 hover:text-blue-700 hover:underline focus:outline-hidden focus:ring-2 focus:ring-blue-800 focus:ring-offset-1';

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
                    <Mail01 className="size-6" />
                </div>

                <h1
                    ref={successHeading}
                    tabIndex={-1}
                    className="mb-2 text-[28px] font-bold tracking-tight text-gray-900 focus:outline-hidden"
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
                <Input
                    label="Email Kedinasan"
                    name="email"
                    type="email"
                    size="lg"
                    autoComplete="email"
                    autoFocus
                    isRequired
                    hideRequiredIndicator
                    placeholder="Masukkan email kedinasan"
                    value={data.email}
                    onChange={(v) => setData('email', v)}
                    isInvalid={Boolean(errors.email)}
                    hint={errors.email}
                />

                <Button type="submit" color="primary" size="lg" className="w-full" isLoading={processing}>
                    Kirim Tautan Pemulihan
                </Button>
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
