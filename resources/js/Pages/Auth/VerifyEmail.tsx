import { Button } from '@/Components/ui/base/buttons/button';
import AuthSplitLayout from '@/Layouts/AuthSplitLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function VerifyEmail({ status }: { status?: string }) {
    const { post, processing } = useForm({});

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('verification.send'));
    };

    return (
        <AuthSplitLayout>
            <Head title="Verifikasi Email - SIBIMA" />

            <h1 className="mb-2 text-[28px] font-bold tracking-tight text-gray-900">Verifikasi Email</h1>
            <p className="mb-7 text-sm text-gray-600">
                Sebelum mulai, mohon verifikasi alamat email Anda dengan menekan tautan yang baru kami kirim ke email
                Anda. Jika belum menerimanya, kami dapat mengirim ulang.
            </p>

            {status === 'verification-link-sent' && (
                <div
                    role="status"
                    className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3.5 text-sm font-medium text-green-700"
                >
                    Tautan verifikasi baru telah dikirim ke alamat email yang Anda daftarkan.
                </div>
            )}

            <form onSubmit={submit} className="space-y-3">
                <Button type="submit" color="primary" size="lg" className="w-full" isLoading={processing}>
                    Kirim Ulang Email Verifikasi
                </Button>
                <Button color="tertiary" size="lg" className="w-full" onPress={() => router.post(route('logout'))}>
                    Keluar
                </Button>
            </form>
        </AuthSplitLayout>
    );
}
