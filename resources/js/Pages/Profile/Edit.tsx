import PageHeader from '@/Components/PageHeader';
import { Tabs } from '@/Components/ui/application/tabs/tabs';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ActivityEntry, PageProps, Paginated, ProfileAkun, ProfileSession } from '@/types';
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import ActivityTab from './Partials/ActivityTab';
import ProfileDetails from './Partials/ProfileDetails';
import ProfilePhoto from './Partials/ProfilePhoto';
import SessionsCard from './Partials/SessionsCard';

export default function Edit({
    akun,
    sessions,
    aktivitas,
}: PageProps<{ akun: ProfileAkun; sessions: ProfileSession[]; aktivitas?: Paginated<ActivityEntry> }>) {
    const [tab, setTab] = useState('keamanan');

    return (
        <AuthenticatedLayout>
            <Head title="Profil Saya" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Profil' }]} title="Profil Saya" />
                <div className="grid gap-8 rounded-xl border border-slate-200 bg-white p-6 shadow-xs md:grid-cols-[16rem_1fr]">
                    <ProfilePhoto akun={akun} />
                    <ProfileDetails akun={akun} />
                </div>

                <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))} keyboardActivation="automatic">
                    <Tabs.List type="underline" size="md" aria-label="Bagian profil">
                        <Tabs.Item id="keamanan" label="Keamanan" />
                        <Tabs.Item id="aktivitas" label="Aktivitas" />
                    </Tabs.List>

                    <Tabs.Panel id="keamanan" className="space-y-6 pt-6">
                        <SessionsCard sessions={sessions} />
                    </Tabs.Panel>
                    <Tabs.Panel id="aktivitas" className="pt-6">
                        <ActivityTab aktivitas={aktivitas} />
                    </Tabs.Panel>
                </Tabs>
            </div>
        </AuthenticatedLayout>
    );
}
