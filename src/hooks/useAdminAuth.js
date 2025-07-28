// src/hooks/useAdminAuth.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function useAdminAuth() {
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(async user => {
            if (!user) {
                router.replace('/login');
                return;
            }

            try {
                const snap = await getDoc(doc(db, 'admins', user.uid));
                if (!snap.exists()) {
                    // Not an admin → redirect out
                    router.replace('/not-authorized');
                    return;
                }
                // OK, user is admin
                setLoading(false);
            } catch (err) {
                console.error('Admin auth check failed:', err);
                router.replace('/login');
            }
        });

        return unsub;
    }, [router]);

    return loading;
}