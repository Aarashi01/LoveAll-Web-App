import { useEffect, useState } from 'react';

import { subscribeToMatches } from '@/lib/firestore/matches';
import { type MatchDocument } from '@/lib/firestore/types';

export function useMatches(tournamentId?: string) {
  const [matches, setMatches] = useState<MatchDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tournamentId) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToMatches(tournamentId, (nextMatches) => {
      setMatches(nextMatches);
      setLoading(false);
    }, (message) => {
      setError(message);
      setLoading(false);
    });

    return unsubscribe;
  }, [tournamentId]);

  return { matches, loading, error };
}
