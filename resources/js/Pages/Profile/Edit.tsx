import PageHeader from '@/Components/PageHeader';
import { Tabs } from '@/Components/ui/application/tabs/tabs';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, ProfileAkun, ProfileSession } from '@/types';
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import AccountInfoCard from './Partials/AccountInfoCard';
import CredentialsCard from './Partials/CredentialsCard';
import ProfileHeader from './Partials/ProfileHeader';
import SessionsCard from './Partials/SessionsCard';

export default function Edit({ akun, sessions }: PageProps<{ akun: ProfileAkun; sessions: ProfileSession[] }>) {
    const [tab, setTab] = useState('akun');

    return (
        <AuthenticatedLayout>
            <Head title="Profil Saya" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Profil' }]} title="Profil Saya" />
                <ProfileHeader akun={akun} />

                <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))} keyboardActivation="automatic">
                    <Tabs.List type="underline" size="md" aria-label="Bagian profil">
                        <Tabs.Item id="akun" label="Akun" />
                        <Tabs.Item id="keamanan" label="Keamanan" />
                    </Tabs.List>

                    <Tabs.Panel id="akun" className="space-y-6 pt-6">
                        <AccountInfoCard akun={akun} />
                        <CredentialsCard akun={akun} />
                    </Tabs.Panel>
                    <Tabs.Panel id="keamanan" className="space-y-6 pt-6">
                        <SessionsCard sessions={sessions} />
                    </Tabs.Panel>
                </Tabs>
            </div>
        </AuthenticatedLayout>
    );
}
