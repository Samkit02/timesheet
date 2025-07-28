// src/pages/dashboard.js
import Head from 'next/head';
import { useState, useEffect } from 'react';
import useAuth from '../hooks/useAuth';
import { db, auth } from '../lib/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    onSnapshot
} from 'firebase/firestore';
import { differenceInCalendarDays } from 'date-fns';

// Compute Monday and Friday of the current week
function getWeekBoundaries(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay(); // 0 (Sun) - 6 (Sat)
    const diff = (day + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);
    return { monday, friday };
}

export default function DashboardPage() {
    const loading = useAuth();
    const [hours, setHours] = useState(0);
    const [status, setStatus] = useState('draft');
    const [dueInDays, setDueInDays] = useState(null);

    // Notifications state
    const [notifications, setNotifications] = useState([]);
    const [notifLoading, setNotifLoading] = useState(true);

    // Fetch current week’s timesheet summary
    useEffect(() => {
        async function fetchTimesheet() {
            const user = auth.currentUser;
            if (!user) return;

            const { monday, friday } = getWeekBoundaries();
            const weekStart = monday.toISOString().slice(0, 10);

            const tsQuery = query(
                collection(db, 'users', user.uid, 'timesheets'),
                where('weekStart', '==', weekStart)
            );
            const snap = await getDocs(tsQuery);
            if (!snap.empty) {
                const docSnap = snap.docs[0];
                const data = docSnap.data();
                const entries = data.entries || {};
                const total = Object.values(entries).reduce((sum, day) => {
                    if (!day.in || !day.out) return sum;
                    const [h1, m1] = day.in.split(':').map(Number);
                    const [h2, m2] = day.out.split(':').map(Number);
                    const minutes =
                        h2 * 60 + m2 - (h1 * 60 + m1) - (Number(day.break) || 0);
                    return sum + (minutes > 0 ? minutes / 60 : 0);
                }, 0);
                setHours(+total.toFixed(2));
                setStatus(data.status || 'draft');
            }

            const today = new Date();
            const diffDays = differenceInCalendarDays(friday, today);
            setDueInDays(diffDays);
        }

        if (!loading) {
            fetchTimesheet();
        }
    }, [loading]);

    // Real-time notifications listener
    useEffect(() => {
        if (loading) return;

        const user = auth.currentUser;
        if (!user) return;

        const notifRef = collection(db, 'users', user.uid, 'notifications');
        const unsubscribe = onSnapshot(
            notifRef,
            snap => {
                setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setNotifLoading(false);
            },
            err => {
                console.error('Realtime notifications error:', err);
                setNotifLoading(false);
            }
        );

        return () => unsubscribe();
    }, [loading]);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                Loading…
            </div>
        );
    }

    const showAlert =
        status !== 'submitted' &&
        dueInDays !== null &&
        dueInDays <= 2 &&
        dueInDays >= 0;

    return (
        <>
            <Head>
                <title>TimeTrack – Dashboard</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-primary)]">
                <main className="mx-auto max-w-7xl p-6">
                    {/* Title */}
                    <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

                    {/* Pay Period & Status */}
                    <section className="mb-8 grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg bg-gray-800 p-6">
                            <p className="text-sm text-[var(--text-secondary)]">
                                Hours Logged This Week
                            </p>
                            <p className="mt-1 text-3xl font-bold">{hours}</p>
                        </div>
                        <div className="rounded-lg bg-gray-800 p-6">
                            <p className="text-sm text-[var(--text-secondary)]">
                                Timesheet Status
                            </p>
                            <span
                                className={`inline-block mt-1 rounded-full px-3 py-1 text-sm font-medium ${status === 'approved'
                                        ? 'bg-green-600'
                                        : status === 'rejected'
                                            ? 'bg-red-600'
                                            : 'bg-yellow-600'
                                    }`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                    </section>

                    {/* Upcoming Deadline Alert */}
                    {showAlert && (
                        <section className="mb-8">
                            <div className="rounded-lg bg-gray-800 p-6 flex items-start gap-4">
                                <svg
                                    className="h-6 w-6 text-[var(--primary-color)] mt-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4m0 4h.01M5.07 17l1.43-1.43A10 10 0 113.06 10.05L1.64 8.62"
                                    />
                                </svg>
                                <div>
                                    <p className="font-medium">Pending Submission Reminder</p>
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        Your timesheet is due in {dueInDays} day
                                        {dueInDays === 1 ? '' : 's'}.
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Notifications Panel */}
                    <section className="mb-8">
                        <h2 className="text-xl font-semibold mb-4">Notifications</h2>
                        <div className="space-y-2">
                            {notifLoading ? (
                                <p>Loading notifications…</p>
                            ) : notifications.length === 0 ? (
                                <p className="text-sm text-[var(--text-secondary)]">
                                    No new notifications.
                                </p>
                            ) : (
                                notifications.map(n => (
                                    <div
                                        key={n.id}
                                        className="p-4 bg-gray-800 rounded-lg"
                                    >
                                        <p>{n.message}</p>
                                        {n.timestamp?.seconds && (
                                            <p className="text-xs text-[var(--text-secondary)]">
                                                {new Date(
                                                    n.timestamp.seconds * 1000
                                                ).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Quick Actions */}
                    <section>
                        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                        <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
                            <button
                                className="button_primary"
                                onClick={() => (window.location.href = '/time-entry')}
                            >
                                Start New Timesheet
                            </button>
                            <button
                                className="button_secondary"
                                onClick={() => (window.location.href = '/time-history')}
                            >
                                View Timesheet History
                            </button>
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
}