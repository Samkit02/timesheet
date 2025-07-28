// src/pages/signup.js
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { setDoc, doc } from 'firebase/firestore';

const googleProvider = new GoogleAuthProvider();

export default function SignUpPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Prevent logged-in users from hitting this page
    useEffect(() => {
        if (auth.currentUser) {
            router.replace('/dashboard');
        }
    }, [router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // 1. Create the user
            const { user } = await createUserWithEmailAndPassword(auth, email, password);
            // 2. Seed their Firestore profile
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                isAdmin: false
            });
            // 3. Sign them back out immediately
            await signOut(auth);
            // 4. Send them to the login page
            router.replace('/login');
        } catch (err) {
            console.error('Signup error:', err);
            setError('Failed to sign up — please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignUp = async () => {
        setError('');
        setLoading(true);

        try {
            // 1. Sign up with Google
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            // 2. Ensure profile exists
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                isAdmin: false
            });
            // 3. Sign them back out
            await signOut(auth);
            // 4. Redirect to login
            router.replace('/login');
        } catch (err) {
            console.error('Google signup error:', err);
            setError('Google signup failed — please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>TimeTrackr – Sign Up</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <div className="flex min-h-screen flex-col bg-[var(--background-color)] text-[var(--text-primary)] font-sans">
                <header className="hidden" />

                <main className="flex flex-1 items-center justify-center py-12 sm:px-6 lg:px-8">
                    <div className="w-full max-w-md space-y-8">
                        <div>
                            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">Get started</h2>
                            <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
                                Create your account to start tracking time
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
                                        autoComplete="email"
                                        required
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
                                        autoComplete="new-password"
                                        required
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
                                {loading ? 'Signing up…' : 'Sign up'}
                            </button>
                        </form>

                        <div className="mt-6">
                            <button
                                onClick={handleGoogleSignUp}
                                disabled={loading}
                                className="button_secondary w-full py-3 inline-flex justify-center items-center"
                            >
                                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                                    {/* Google icon path */}
                                </svg>
                                <span>Continue with Google</span>
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
