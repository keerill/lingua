import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Deck } from '@lingua/contracts';
import { useApi } from '../api';

export function useDecksViewModel() {
  const api = useApi();
  const queryClient = useQueryClient();

  const decksQuery = useQuery({
    queryKey: ['decks'],
    queryFn: () => api.listDecks(),
  });
  const [title, setTitle] = useState('');

  const createDeck = useMutation({
    mutationFn: () =>
      api.createDeck({ title: title.trim(), langFrom: 'en', langTo: 'ru' }),
    onSuccess: () => {
      setTitle('');
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });

  return {
    decks: (decksQuery.data ?? []) as Deck[],
    isLoading: decksQuery.isLoading,
    error: decksQuery.error ? String(decksQuery.error) : null,
    isEmpty: !decksQuery.isLoading && (decksQuery.data?.length ?? 0) === 0,
    title,
    setTitle,
    isCreating: createDeck.isPending,
    submitDeck: () => {
      if (title.trim()) createDeck.mutate();
    },
  };
}
