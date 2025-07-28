// src/hooks/useProjects.js
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function useProjects() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProjects() {
            const q = query(
                collection(db, 'projects'),
                where('isActive', '==', true)
            );
            const snap = await getDocs(q);
            setProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }
        fetchProjects();
    }, []);

    return { projects, loading };
}