import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { type TournamentDocument } from '@/lib/firestore/types';

export function useTournament(tournamentId?: string) {
  const [tournament, setTournament] = useState<TournamentDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tournamentId) {
      setTournament(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = doc(db, 'tournaments', tournamentId);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setTournament(snapshot.exists() ? (snapshot.data() as TournamentDocument) : null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [tournamentId]);

  return { tournament, loading, error };
}
