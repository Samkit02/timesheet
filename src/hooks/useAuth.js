// src/hooks/useAuth.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function useAuth() {
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // create or merge their Firestore profile
                await setDoc(
                    doc(db, 'users', user.uid),
                    { email: user.email },
                    { merge: true }
                );
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        // Make both login and signup public
        const publicPaths = ['/login', '/signup'];

        const unsubscribe = onAuthStateChanged(auth, user => {
            const { pathname } = router;

            // Not signed in AND not on a public page → redirect to login
            if (!user && !publicPaths.includes(pathname)) {
                router.replace('/login');
            } else {
                // Either signed in, or on /login or /signup
                setLoading(false);
            }
        });

        return unsubscribe;
    }, [router]);

    return loading;
}
