import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Deck } from '@lingua/contracts';
import { useApi } from '../api';

/**
 * ViewModel for the decks screen (MVVM): owns state, derived data and commands.
 * The View consumes this and only renders — no business logic in the component.
 */
export function useDecksViewModel() {
  const api = useApi();
  const queryClient = useQueryClient();

  const decksQuery = useQuery({ queryKey: ['decks'], queryFn: () => api.listDecks() });
  const [title, setTitle] = useState('');

  const createDeck = useMutation({
    mutationFn: () => api.createDeck({ title: title.trim(), langFrom: 'en', langTo: 'ru' }),
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
