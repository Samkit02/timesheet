// src/pages/timesheet-history.js
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../hooks/useAuth';
import { auth, db } from '../lib/firebase';
import {
    collection,
    getDocs,
    query,
    orderBy,
    deleteDoc,
    doc
} from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// parse YYYY-MM-DD into local Date
function parseDate(str) {
    try {
        const [year, month, day] = str.split('-').map(Number);
        return new Date(year, month - 1, day);
    } catch {
        return null;
    }
}

// compute hours for a single day entry
function calcDayHours(dayEntry = {}) {
    const inT = dayEntry.in || '';
    const outT = dayEntry.out || '';
    const brk = Number(dayEntry.break || 0);
    if (!inT || !outT) return 0;
    const [h1, m1] = inT.split(':').map(Number);
    const [h2, m2] = outT.split(':').map(Number);
    const mins = (h2 * 60 + m2) - (h1 * 60 + m1) - brk;
    return mins > 0 ? +(mins / 60).toFixed(2) : 0;
}

export default function TimesheetHistoryPage() {
    const loadingAuth = useAuth();
    const router = useRouter();

    const [timesheets, setTimesheets] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [loading, setLoading] = useState(true);

    // Load all timesheets once
    useEffect(() => {
        if (loadingAuth) return;
        const user = auth.currentUser;
        if (!user) {
            router.replace('/login');
            return;
        }
        async function fetchHistory() {
            setLoading(true);
            try {
                const ref = query(
                    collection(db, 'users', user.uid, 'timesheets'),
                    orderBy('weekStart', 'desc')
                );
                const snap = await getDocs(ref);
                setTimesheets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error('Fetch error:', err);
                alert('Could not load timesheets.');
            } finally {
                setLoading(false);
            }
        }
        fetchHistory();
    }, [loadingAuth]);

    // Apply status & date-range filters
    const filtered = useMemo(() => {
        return timesheets.filter(ts => {
            if (statusFilter !== 'all' && ts.status !== statusFilter) return false;
            const fromDate = dateRange.from ? parseDate(dateRange.from) : null;
            const toDate = dateRange.to ? parseDate(dateRange.to) : null;
            const start = parseDate(ts.weekStart);
            const end = parseDate(ts.weekEnd);
            if (fromDate && start < fromDate) return false;
            if (toDate && end > toDate) return false;
            return true;
        });
    }, [timesheets, statusFilter, dateRange]);

    // Delete draft
    const handleDelete = async id => {
        if (!confirm('Delete this draft? This cannot be undone.')) return;
        const user = auth.currentUser;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'timesheets', id));
            setTimesheets(prev => prev.filter(ts => ts.id !== id));
        } catch (err) {
            console.error('Delete error:', err);
            alert('Failed to delete draft.');
        }
    };

    // Export CSV
    const exportCSV = () => {
        const header = ['Week Start', 'Week End', 'Total Hours', 'Status'];
        const rows = filtered.map(ts => {
            const total = Object.values(ts.entries || {}).reduce(
                (sum, day) => sum + calcDayHours(day),
                0
            );
            return [ts.weekStart, ts.weekEnd, total.toFixed(2), ts.status];
        });
        const csv = [header, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'timesheets.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Export PDF
    const exportPDF = () => {
        const docPDF = new jsPDF();
        docPDF.text('Timesheets', 14, 20);
        const body = filtered.map(ts => {
            const total = Object.values(ts.entries || {}).reduce(
                (sum, day) => sum + calcDayHours(day),
                0
            );
            return [ts.weekStart, ts.weekEnd, total.toFixed(2), ts.status];
        });
        docPDF.autoTable({
            head: [['Week Start', 'Week End', 'Total Hrs', 'Status']],
            body,
            startY: 30
        });
        docPDF.save('timesheets.pdf');
    };

    if (loadingAuth || loading) {
        return (
            <div className="h-screen flex items-center justify-center">Loading…</div>
        );
    }

    return (
        <>
            <Head>
                <title>Timesheet History – TimeTrack</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-primary)]">
                <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">

                    <div>
                        <h1 className="text-3xl font-bold">Timesheet History</h1>
                        <p className="mt-1 text-[var(--text-secondary)]">View and manage your past timesheets.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                        <div className="flex gap-2">
                            <label className="self-center">From:</label>
                            <input
                                type="date"
                                className="input"
                                value={dateRange.from}
                                onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))}
                            />
                            <label className="self-center">To:</label>
                            <input
                                type="date"
                                className="input"
                                value={dateRange.to}
                                onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                className="input"
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                            >
                                <option value="all">All</option>
                                <option value="draft">Draft</option>
                                <option value="submitted">Submitted</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            <button className="button_secondary" onClick={exportPDF}>Export PDF</button>
                            <button className="button_secondary" onClick={exportCSV}>Export CSV</button>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl bg-gray-800">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Date Range</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Total Hours</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Status</th>
                                    <th className="px-6 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-[var(--text-secondary)]">
                                            No timesheets match your criteria.
                                        </td>
                                    </tr>
                                )}
                                {filtered.map(ts => {
                                    const total = Object.values(ts.entries || {}).reduce(
                                        (sum, day) => sum + calcDayHours(day),
                                        0
                                    ).toFixed(2);
                                    const start = parseDate(ts.weekStart)?.toLocaleDateString() || '';
                                    const end = parseDate(ts.weekEnd)?.toLocaleDateString() || '';
                                    const range = `${start} – ${end}`;

                                    return (
                                        <tr key={ts.id} className="hover:bg-gray-700">
                                            <td className="px-6 py-4 text-sm">{range}</td>
                                            <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{total}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <span
                                                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium
                            ${ts.status === 'draft' ? 'bg-gray-500 text-white'
                                                            : ts.status === 'submitted' ? 'bg-yellow-600 text-white'
                                                                : 'bg-red-600 text-white'}`}
                                                >
                                                    {ts.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-medium space-x-4">
                                                <Link href={`/time-entry?week=${ts.weekStart}`}>
                                                    <span className="text-[var(--primary-color)] hover:text-[var(--accent-color)]">View</span>
                                                </Link>
                                                {ts.status === 'draft' && (
                                                    <button
                                                        onClick={() => handleDelete(ts.id)}
                                                        className="text-red-500 hover:underline text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </main>
            </div>
        </>
    );
}
