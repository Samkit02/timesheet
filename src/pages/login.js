import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const googleProvider = new GoogleAuthProvider();

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // If already signed in, determine admin vs user and redirect
    useEffect(() => {
        const unsub = auth.onAuthStateChanged(async user => {
            if (!user) return;
            try {
                const adminSnap = await getDoc(doc(db, 'admins', user.uid));
                router.replace(adminSnap.exists() ? '/admin-dashboard' : '/dashboard');
            } catch (err) {
                console.error('Redirect check failed:', err);
                router.replace('/login');
            }
        });
        return () => unsub();
    }, [router]);

    const handleSubmit = async e => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { user } = await signInWithEmailAndPassword(auth, email, password);
            const adminSnap = await getDoc(doc(db, 'admins', user.uid));
            router.replace(adminSnap.exists() ? '/admin-dashboard' : '/dashboard');
        } catch {
            setError('Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setError('');
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            const adminSnap = await getDoc(doc(db, 'admins', user.uid));
            router.replace(adminSnap.exists() ? '/admin-dashboard' : '/dashboard');
        } catch {
            setError('Google sign-in failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>TimeTrackr – Login</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <div className="flex min-h-screen flex-col bg-[var(--background-color)] text-[var(--text-primary)] font-sans">
                <main className="flex flex-1 items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                    <div className="w-full max-w-md space-y-8">
                        <div>
                            <h2 className="text-center text-3xl font-bold">Welcome back</h2>
                            <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
                                Sign in to continue
                            </p>
                        </div>
                        {error && <p className="text-red-600 text-center">{error}</p>}
                        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                            <div className="space-y-4 rounded-md shadow-sm">
                                <div>
                                    <label htmlFor="email" className="sr-only">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        className="input w-full"
                                        placeholder="Email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password" className="sr-only">Password</label>
                                    <input
                                        id="password"
                                        type="password"
                                        required
                                        autoComplete="current-password"
                                        className="input w-full"
                                        placeholder="Password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="button_primary w-full py-3 text-sm font-semibold"
                            >
                                {loading ? 'Signing in…' : 'Log in'}
                            </button>
                        </form>
                        <div className="mt-6">
                            <button
                                onClick={handleGoogle}
                                disabled={loading}
                                className="button_secondary w-full py-3 inline-flex justify-center items-center"
                            >
                                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                                    {/* Google icon path */}
                                </svg>
                                <span>Continue with Google</span>
                            </button>
                        </div>
                        <p className="mt-4 text-center text-sm">
                            Don’t have an account?{' '}
                            <a href="/signup" className="text-[var(--primary-color)] font-medium">
                                Sign up
                            </a>
                        </p>
                    </div>
                </main>
            </div>
        </>
    );
}