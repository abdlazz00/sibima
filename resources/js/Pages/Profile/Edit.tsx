import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, ProfileAkun } from '@/types';
import { Head } from '@inertiajs/react';
import AccountInfoCard from './Partials/AccountInfoCard';
import CredentialsCard from './Partials/CredentialsCard';
import ProfileHeader from './Partials/ProfileHeader';

export default function Edit({ akun }: PageProps<{ akun: ProfileAkun }>) {
    return (
        <AuthenticatedLayout>
            <Head title="Profil Saya" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Profil' }]} title="Profil Saya" />
                <ProfileHeader akun={akun} />
                <AccountInfoCard akun={akun} />
                <CredentialsCard akun={akun} />
            </div>
        </AuthenticatedLayout>
    );
}
