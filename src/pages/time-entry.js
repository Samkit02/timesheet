// src/pages/time-entry/index.js
import Head from 'next/head';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../hooks/useAuth';
import useProjects from '../hooks/useProjects';
import { db, auth } from '../lib/firebase';
import {
    collection,
    addDoc,
    serverTimestamp,
    getDocs,
    query,
    where,
    updateDoc,
    doc
} from 'firebase/firestore';

// Helper: get Monday of a given date
function getWeekStart(dateStr) {
    try {
        const [year, month, day] = dateStr.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        const diff = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
    } catch {
        return new Date();
    }
}

// Format label like "Mon, Jul 28"
function formatLabel(d) {
    return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

// Calculate hours + overtime
function calcDayHours({
    in: inT = '',
    out: outT = '',
    break: brk = 0,
    overtime = 0
} = {}) {
    if (!inT || !outT) return Number(overtime) || 0;
    const [h1, m1] = inT.split(':').map(Number);
    const [h2, m2] = outT.split(':').map(Number);
    const minutes = h2 * 60 + m2 - (h1 * 60 + m1) - Number(brk);
    const base = minutes > 0 ? minutes / 60 : 0;
    return +(base + Number(overtime || 0)).toFixed(2);
}

export default function TimeEntryWeekForm() {
    const loading = useAuth();
    const router = useRouter();
    const { week: weekQuery, user: userQuery } = router.query;
    const targetUid = userQuery || auth.currentUser.uid;
    const { projects, loading: projLoading } = useProjects();

    // Week start state
    const [weekStart, setWeekStart] = useState(() => {
        const iso = new Date().toISOString().slice(0, 10);
        return getWeekStart(iso);
    });

    const weekDays = useMemo(
        () =>
            Array.from({ length: 5 }, (_, i) => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + i);
                return {
                    key: d.toISOString().slice(0, 10),
                    label: formatLabel(d),
                    date: d
                };
            }),
        [weekStart]
    );

    // Compute total worked hours (In→Out minus break)
    function calcWorkedHours({ in: inT = '', out: outT = '', break: brk = 0 } = {}) {
        if (!inT || !outT) return 0;
        const [h1, m1] = inT.split(':').map(Number);
        const [h2, m2] = outT.split(':').map(Number);
        const minutes = h2 * 60 + m2 - (h1 * 60 + m1) - Number(brk);
        return minutes > 0 ? +(minutes / 60).toFixed(2) : 0;
    }

    // Split into up-to-8h “regular” and any “overtime” beyond that
    function splitHours(total) {
        return {
            regular: +(Math.min(total, 8)).toFixed(2),
            overtime: +(Math.max(total - 8, 0)).toFixed(2)
        };
    }

    // Check if week has ended
    const weekEnd = weekDays[4]?.date;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isWeekEnded = weekEnd && today > new Date(weekEnd.setHours(0, 0, 0, 0));

    const [entries, setEntries] = useState({});
    const [draftId, setDraftId] = useState(null);
    const [currentStatus, setCurrentStatus] = useState('draft');

    // Initialize entries
    useEffect(() => {
        setEntries(prev => {
            const next = {};
            weekDays.forEach(d => {
                next[d.key] =
                    prev[d.key] || {
                        in: '',
                        out: '',
                        break: '',
                        overtime: '',
                        allocations: [{ projectId: '', desc: '', hours: '' }]
                    };
            });
            return next;
        });
    }, [weekDays]);

    // Load draft if any
    useEffect(() => {
        if (!weekQuery || (!userQuery && !auth.currentUser)) return;
        (async () => {
            const ref = query(
                collection(db, 'users', targetUid, 'timesheets'),
                where('weekStart', '==', weekQuery)
            );
            const snap = await getDocs(ref);
            if (!snap.empty) {
                const docSnap = snap.docs[0];
                const data = docSnap.data();
                setDraftId(docSnap.id);
                setCurrentStatus(data.status);
                setWeekStart(getWeekStart(data.weekStart));
                setEntries(data.entries || {});
            }
        })();
    }, [weekQuery]);

    // Update entry fields (and auto-sync hours if only one allocation)
    const handleTimeChange = (dayKey, field, val) =>
        setEntries(prev => {
            const entry = { ...prev[dayKey], [field]: val };
            const total = calcDayHours(entry);
            if (entry.allocations.length === 1) {
                entry.allocations[0].hours = total;
            }
            return { ...prev, [dayKey]: entry };
        });

    const addAllocation = dayKey =>
        setEntries(prev => {
            const entry = { ...prev[dayKey] };
            entry.allocations = [
                ...entry.allocations,
                { projectId: '', desc: '', hours: '' }
            ];
            return { ...prev, [dayKey]: entry };
        });

    const removeAllocation = (dayKey, idx) =>
        setEntries(prev => {
            const entry = { ...prev[dayKey] };
            entry.allocations = entry.allocations.filter((_, i) => i !== idx);
            return { ...prev, [dayKey]: entry };
        });

    const handleAllocChange = (dayKey, idx, field, val) =>
        setEntries(prev => {
            const entry = { ...prev[dayKey] };
            const total = calcDayHours(entry);

            if (field === 'hours') {
                const num = Number(val);
                if (num > total) {
                    alert(
                        `Allocation hours cannot exceed total worked hours (${total}h).`
                    );
                    entry.allocations = entry.allocations.map((a, i) =>
                        i === idx ? { ...a, hours: total } : a
                    );
                } else {
                    entry.allocations = entry.allocations.map((a, i) =>
                        i === idx ? { ...a, hours: val } : a
                    );
                }
            } else {
                entry.allocations = entry.allocations.map((a, i) =>
                    i === idx ? { ...a, [field]: val } : a
                );
            }
            return { ...prev, [dayKey]: entry };
        });

    // Save or submit with aggregated validation
    const handleSave = async status => {
        // Collect all validation errors
        const errors = [];

        for (const [dayKey, entry] of Object.entries(entries)) {
            const worked = calcDayHours(entry);
            const { regular, overtime } = splitHours(worked);

            if (!entry.in || !entry.out) {
                errors.push(`Please fill In and Out for ${dayKey}`);
            }
            if (!entry.break || Number(entry.break) <= 0) {
                errors.push(`Enter a lunch break > 0 mins for ${dayKey}`);
            }

            entry.allocations.forEach((alloc, i) => {
                if (!alloc.projectId) {
                    errors.push(
                        `Select project for ${dayKey}, allocation #${i + 1}`
                    );
                }
                if (!alloc.desc) {
                    errors.push(
                        `Enter description for ${dayKey}, allocation #${i + 1}`
                    );
                }
                if (alloc.hours === '' || Number(alloc.hours) < 0) {
                    errors.push(
                        `Enter hours for ${dayKey}, allocation #${i + 1}`
                    );
                }
            });

            const allocSum = entry.allocations.reduce(
                (sum, a) => sum + (Number(a.hours) || 0),
                0
            );
            if (allocSum > worked) {
                errors.push(
                    `Allocated hours (${allocSum}h) for ${dayKey} exceed total worked hours (${worked}h)`
                );
            }
            if (allocSum !== worked) {
                errors.push(
                    `Total allocated hours (${allocSum}h) for ${dayKey} must equal total worked hours (${worked}h)`
                );
            }
        }

        // If any validation errors, show them all and abort
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return;
        }

        // Proceed with save/submit
        try {
            const payload = {
                weekStart: weekDays[0].key,
                weekEnd: weekDays[4].key,
                entries,
                status,
                createdAt: serverTimestamp()
            };
            const user = auth.currentUser;
            if (!user) throw new Error('Not authenticated');

            if (draftId) {
                await updateDoc(
                    doc(db, 'users', user.uid, 'timesheets', draftId),
                    payload
                );
            } else {
                await addDoc(
                    collection(db, 'users', user.uid, 'timesheets'),
                    payload
                );
            }

            if (status === 'submitted') {
                await addDoc(
                    collection(db, 'users', user.uid, 'notifications'),
                    {
                        message: `You submitted your timesheet for week ${payload.weekStart}.`,
                        timestamp: serverTimestamp()
                    }
                );
            }

            router.push('/dashboard');
        } catch (err) {
            console.error('Save error:', err);
            alert(err.message || 'Error saving timesheet. Please try again.');
        }
    };

    if (loading || projLoading) {
        return (
            <div className="h-screen flex items-center justify-center">
                Loading…
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>TimeTrackr – Timesheet Entry</title>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
            </Head>
            <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-primary)] p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Week picker */}
                    <div>
                        <label className="block mb-2 font-medium">
                            Select Week Start (Monday)
                        </label>
                        <input
                            type="date"
                            className="input"
                            value={weekStart.toISOString().slice(0, 10)}
                            onChange={e =>
                                setWeekStart(getWeekStart(e.target.value))
                            }
                        />
                    </div>

                    {/* Day entries */}
                    {weekDays.map(d => {
                        const data = entries[d.key] || {};
                        const total = calcDayHours(data);

                        return (
                            <div
                                key={d.key}
                                className="card bg-gray-900 p-6 rounded-lg mb-8"
                            >
                                <div className="flex justify-between mb-4">
                                    <h2 className="text-xl font-bold">
                                        {d.label}
                                    </h2>
                                    <span className="text-sm text-[var(--text-secondary)]">
                                        {total} hrs
                                    </span>
                                </div>

                                {/* Time & break & overtime */}
                                <div className="grid grid-cols-1 md:grid-cols-8 gap-4 mb-4">
                                    {['in', 'out'].map(fld => (
                                        <div key={fld} className="md:col-span-2">
                                            <label className="block mb-1 text-sm capitalize">
                                                {fld === 'in' ? 'In' : 'Out'}
                                            </label>
                                            <input
                                                type="time"
                                                className="input w-full"
                                                value={data[fld] || ''}
                                                onChange={e =>
                                                    handleTimeChange(
                                                        d.key,
                                                        fld,
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                    ))}
                                    <div className="md:col-span-2">
                                        <label className="block mb-1 text-sm">
                                            Break (mins)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="input w-full"
                                            value={data.break || ''}
                                            onChange={e =>
                                                handleTimeChange(
                                                    d.key,
                                                    'break',
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block mb-1 text-sm">Overtime (hrs)</label>
                                        <input
                                            type="number"
                                            className="input w-full bg-gray-700 cursor-not-allowed"
                                            value={splitHours(calcWorkedHours(data)).overtime}
                                            disabled
                                        />
                                    </div>
                                </div>

                                {/* Total for allocations */}
                                <div className="mb-4">
                                    <span className="font-medium">
                                        Total hours to allocate:
                                    </span>{' '}
                                    {total} hrs
                                </div>

                                {/* Allocations */}
                                {(data.allocations || []).map((a, i) => (
                                    <div
                                        key={i}
                                        className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-4"
                                    >
                                        <div className="md:col-span-4">
                                            <label className="block mb-1 text-sm">
                                                Project
                                            </label>
                                            <select
                                                className="input w-full"
                                                value={a.projectId}
                                                onChange={e =>
                                                    handleAllocChange(
                                                        d.key,
                                                        i,
                                                        'projectId',
                                                        e.target.value
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    -- Select project --
                                                </option>
                                                {projects.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block mb-1 text-sm">
                                                Hours
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.25"
                                                className="input w-full"
                                                value={a.hours}
                                                onChange={e =>
                                                    handleAllocChange(
                                                        d.key,
                                                        i,
                                                        'hours',
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="md:col-span-5">
                                            <label className="block mb-1 text-sm">
                                                Description
                                            </label>
                                            <input
                                                type="text"
                                                className="input w-full"
                                                value={a.desc}
                                                onChange={e =>
                                                    handleAllocChange(
                                                        d.key,
                                                        i,
                                                        'desc',
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="md:col-span-1 flex space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => addAllocation(d.key)}
                                                className="text-xl"
                                            >
                                                ＋
                                            </button>
                                            {data.allocations.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeAllocation(d.key, i)}
                                                    className="text-xl text-red-500"
                                                >
                                                    –
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}

                    {/* Actions */}
                    <div className="flex justify-end space-x-4">
                        {currentStatus === 'draft' ? (
                            <>
                                <button
                                    onClick={() => handleSave('draft')}
                                    className="button_secondary"
                                >
                                    Save as Draft
                                </button>
                                {isWeekEnded ? (
                                    <button
                                        onClick={() => handleSave('submitted')}
                                        className="button_primary"
                                    >
                                        Submit for Approval
                                    </button>
                                ) : (
                                    <button
                                        disabled
                                        className="button_primary opacity-50 cursor-not-allowed"
                                    >
                                        Submit for Approval
                                    </button>
                                )}
                            </>
                        ) : (
                            <span className="italic text-[var(--text-secondary)]">
                                This timesheet has been submitted
                                {!isWeekEnded
                                    ? ' (locked until week end)'
                                    : ''}.
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}