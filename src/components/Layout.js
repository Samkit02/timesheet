// src/components/Layout.js
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function Layout({ children }) {
    const [user, setUser] = useState(null);

    useEffect(() => {
        // subscribe to auth state
        const unsubscribe = onAuthStateChanged(auth, u => {
            setUser(u);
        });
        return unsubscribe;
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-[var(--background-color)] text-[var(--text-primary)]">
            <header className="border-b border-gray-800 bg-[var(--background-color)]">
                <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-4">
                    {/* Logo */}
                    <Link href="/">
                        <span className="flex items-center gap-2">
                            <svg className="h-8 w-8 text-[var(--primary-color)]" viewBox="0 0 48 48" fill="none">
                                <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" fill="currentColor" />
                            </svg>
                            <span className="text-2xl font-bold">TimeTrack</span>
                        </span>
                    </Link>

                    {/* Nav links */}
                    <nav className="hidden sm:flex space-x-8">
                        <Link href="/"><span className="hover:text-[var(--accent-color)]">Dashboard</span></Link>
                        <Link href="/time-history"><span className="hover:text-[var(--accent-color)]">Timesheets</span></Link>
                        <Link href="/projects"><span className="hover:text-[var(--accent-color)]">Projects</span></Link>
                    </nav>

                    {/* Auth controls */}
                    <div className="flex items-center gap-4">
                        {user
                            ? (
                                <>
                                    <button
                                        onClick={() => signOut(auth)}
                                        className="button_secondary px-3 py-1"
                                    >Sign out</button>
                                    <div
                                        className="h-10 w-10 rounded-full bg-cover bg-center"
                                        style={{ backgroundImage: `url('${user.photoURL || '/avatar.jpg'}')` }}
                                    />
                                </>
                            )
                            : (
                                <Link href="/login">
                                    <span className="button_primary px-4 py-2">Sign in</span>
                                </Link>
                            )
                        }
                    </div>
                </div>
            </header>

            <main className="flex-1">
                {children}
            </main>
        </div>
    );
}