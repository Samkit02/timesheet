// src/pages/profile.js
import Head from 'next/head';
import { useState } from 'react';
import useAuth from '../hooks/useAuth';

export default function ProfilePage() {
    const loading = useAuth();
    const [emailReminders, setEmailReminders] = useState(true);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                Loading…
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>Profile & Settings – TimeTrack</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-primary)]">

                <main className="mx-auto max-w-2xl space-y-10 px-4 py-10">
                    <div>
                        <h1 className="text-4xl font-bold">Profile & Settings</h1>
                        <p className="mt-2 text-lg text-[var(--text-secondary)]">Manage your personal information and notification preferences.</p>
                    </div>

                    <section className="space-y-6">
                        <div className="bg-gray-800 rounded-2xl p-8 space-y-4">
                            <h2 className="text-2xl font-semibold">Personal Information</h2>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-[var(--text-secondary)]">Name</label>
                                    <input id="name" type="text" defaultValue="John Doe" className="input mt-1 w-full" />
                                </div>
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)]">Email</label>
                                    <input id="email" type="email" defaultValue="john.doe@example.com" className="input mt-1 w-full" />
                                </div>
                                <div>
                                    <label htmlFor="employee-id" className="block text-sm font-medium text-[var(--text-secondary)]">Employee ID</label>
                                    <input id="employee-id" type="text" defaultValue="EMP123456" className="input mt-1 w-full" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-2xl p-8 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-semibold">Notification Preferences</h2>
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">Receive email reminders for timesheet submissions.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={emailReminders}
                                    onChange={() => setEmailReminders(!emailReminders)}
                                />
                                <div className="w-14 h-8 bg-gray-600 rounded-full peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-[var(--accent-color)]peer-checked:bg-[var(--primary-color)] relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border after:border-gray-300 after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full" />
                            </label>
                        </div>
                    </section>

                    <div className="flex justify-end">
                        <button className="button_primary px-8 py-3 text-lg font-semibold">Save Changes</button>
                    </div>
                </main>
            </div>
        </>
    );
}