// File: src/pages/admin-dashboard.js
import Head from 'next/head';
import { useState, useEffect, useMemo } from 'react';
import useAdminAuth from '../hooks/useAdminAuth';
import { getAuth } from 'firebase/auth';
import {
    collectionGroup,
    collection,
    query,
    where,
    onSnapshot,
    updateDoc,
    addDoc,
    serverTimestamp,
    getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, startOfWeek } from 'date-fns';
import { useRouter } from 'next/router';

export default function AdminDashboardPage() {
    const loadingAuth = useAdminAuth();
    const auth = getAuth();
    const router = useRouter();

    const [allTs, setAllTs] = useState([]);
    const [search, setSearch] = useState('');
    const [statusTab, setStatusTab] = useState('submitted');
    const [weekStartStr, setWeekStartStr] = useState(
        format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    );

    // Real-time fetch timesheets for any user, any week
    useEffect(() => {
        if (loadingAuth) return;
        const q = query(collectionGroup(db, 'timesheets'));
        const unsub = onSnapshot(
            q,
            async snap => {
                const rows = await Promise.all(
                    snap.docs.map(async d => {
                        const data = d.data();
                        const userSnap = await getDoc(d.ref.parent.parent);
                        const email = userSnap.exists() ? userSnap.data().email : 'Unknown';
                        return { id: d.id, ref: d.ref, email, ...data };
                    })
                );
                setAllTs(rows);
            },
            err => console.error('Realtime listener error:', err)
        );
        return unsub;
    }, [loadingAuth]);

    // Helper: compute total hours of one timesheet
    function calcTotalHours(ts) {
        let total = 0;
        Object.entries(ts.entries || {}).forEach(([key, val]) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(key) && val.in && val.out) {
                const [h1, m1] = val.in.split(':').map(Number);
                const [h2, m2] = val.out.split(':').map(Number);
                const mins = h2 * 60 + m2 - (h1 * 60 + m1) - Number(val.break || 0);
                total += Math.max(mins / 60, 0) + Number(val.overtime || 0);
            }
        });
        return Math.round(total * 100) / 100;
    }

    // Summary counts
    const totalHours = useMemo(
        () => allTs.reduce((sum, ts) => sum + calcTotalHours(ts), 0),
        [allTs]
    );
    const approvedCount = useMemo(
        () => allTs.filter(ts => ts.status === 'approved').length,
        [allTs]
    );
    const pendingCount = useMemo(
        () => allTs.filter(ts => ts.status === 'submitted').length,
        [allTs]
    );
    const rejectedCount = useMemo(
        () => allTs.filter(ts => ts.status === 'rejected').length,
        [allTs]
    );

    // Filter by status & search
    const tableData = useMemo(
        () =>
            allTs
                .filter(ts => ts.status === statusTab)
                .filter(ts =>
                    ts.email.toLowerCase().includes(search.toLowerCase())
                ),
        [allTs, statusTab, search]
    );

    // Approve / Reject action handler
    const handleAction = async (ts, action) => {
        // prompt for optional note or rejection reason
        const note = prompt(
            action === 'rejected'
                ? 'Reason for rejection:'
                : 'Optional approval note:'
        )?.trim();
        // 1) update the timesheet status
        await updateDoc(ts.ref, {
            status: action,
            reviewedAt: serverTimestamp(),
            reviewer: auth.currentUser.uid
        });
        // 2) record the review entry
        await addDoc(collection(ts.ref, 'reviews'), {
            action,
            comment: note || '',
            reviewer: auth.currentUser.uid,
            timestamp: serverTimestamp()
        });
        // 3) send notification to employee
        const userId = ts.ref.parent.parent.id;
        await addDoc(
            collection(db, 'users', userId, 'notifications'),
            {
                message: `Your timesheet for week ${ts.weekStart} was ${action}.`,
                timestamp: serverTimestamp()
            }
        );
    };

    if (loadingAuth) {
        return (
            <div className="h-screen flex items-center justify-center">
                Checking admin…
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>Admin Dashboard – TimeTrack</title>
            </Head>
            <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-primary)]">
                <main className="mx-auto max-w-7xl p-6 space-y-6">
                    {/* Header */}
                    <div>
                        <h1 className="text-4xl font-bold">Admin Dashboard</h1>
                        <p className="text-lg text-[var(--text-secondary)]">
                            Manage timesheets and track team productivity.
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div>
                            <label className="block text-sm font-medium">
                                Week Starting:
                            </label>
                            <input
                                type="date"
                                className="input"
                                value={weekStartStr}
                                onChange={e => setWeekStartStr(e.target.value)}
                            />
                        </div>
                        <div className="relative flex-1 min-w-[200px]">
                            <input
                                type="text"
                                placeholder="Search employee timesheets."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="input w-full pl-12"
                            />
                            <svg
                                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-secondary)]"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Status Tabs */}
                    <div className="flex gap-4">
                        {[
                            ['submitted', 'Pending'],
                            ['approved', 'Approved'],
                            ['rejected', 'Rejected']
                        ].map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setStatusTab(key)}
                                className={`py-2 px-4 rounded-full ${statusTab === key
                                        ? 'bg-[var(--primary-color)] text-black'
                                        : 'bg-gray-800 text-[var(--text-secondary)]'
                                    }`}
                            >
                                {label}{' '}
                                {key === 'submitted'
                                    ? pendingCount
                                    : key === 'approved'
                                        ? approvedCount
                                        : rejectedCount}
                            </button>
                        ))}
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Timesheet Table */}
                        <div className="lg:col-span-2 bg-gray-800 rounded-2xl p-6 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b border-gray-700">
                                    <tr>
                                        <th className="py-2 text-left">Employee</th>
                                        <th className="py-2 text-left">Week Ending</th>
                                        <th className="py-2 text-left">Hours</th>
                                        <th className="py-2 text-left">Status</th>
                                        <th className="py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {tableData.map(ts => (
                                        <tr key={ts.id} className="hover:bg-gray-700">
                                            <td className="py-2">{ts.email}</td>
                                            <td className="py-2">{ts.weekEnd}</td>
                                            <td className="py-2">{calcTotalHours(ts)}</td>
                                            <td className="py-2 capitalize">{ts.status}</td>
                                            <td className="py-2 text-right space-x-2">
                                                {/* View button always available */}
                                                <button
                                                    onClick={() =>
                                                        window.open(
                                                            `/time-entry?week=${ts.weekStart}&user=${ts.ref.parent.parent.id}`,
                                                            '_blank'
                                                        )
                                                    }
                                                    className="bg-blue-500 px-3 py-1 rounded-full text-xs"
                                                >
                                                    View
                                                </button>

                                                {statusTab === 'submitted' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleAction(ts, 'approved')}
                                                            className="bg-green-500 px-3 py-1 rounded-full text-xs"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction(ts, 'rejected')}
                                                            className="bg-gray-600 px-3 py-1 rounded-full text-xs"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {tableData.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="py-6 text-center text-[var(--text-secondary)]"
                                            >
                                                No{' '}
                                                {statusTab === 'submitted'
                                                    ? 'pending'
                                                    : statusTab}{' '}
                                                timesheets.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary Cards */}
                        <div className="space-y-6">
                            <div className="bg-gray-800 rounded-2xl p-6">
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Total Hours Logged
                                </p>
                                <p className="text-4xl font-bold text-[var(--primary-color)]">
                                    {totalHours}
                                </p>
                            </div>
                            <div className="bg-gray-800 rounded-2xl p-6 space-y-2">
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Approved Timesheets
                                </p>
                                <p className="text-2xl font-bold">{approvedCount}</p>
                            </div>
                            <div className="bg-gray-800 rounded-2xl p-6 space-y-2">
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Pending Timesheets
                                </p>
                                <p className="text-2xl font-bold">{pendingCount}</p>
                            </div>
                            <div className="bg-gray-800 rounded-2xl p-6 space-y-2">
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Rejected Timesheets
                                </p>
                                <p className="text-2xl font-bold">{rejectedCount}</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}