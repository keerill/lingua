import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../api';

export function useDeckDetailViewModel(deckId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  const [term, setTerm] = useState('');
  const [translation, setTranslation] = useState('');
  const [example, setExample] = useState('');
  const [added, setAdded] = useState<string[]>([]);

  const addCard = useMutation({
    mutationFn: () =>
      api.createCard(deckId, {
        term,
        translation,
        example: example || undefined,
      }),
    onSuccess: (card) => {
      setAdded((prev) => [card.term, ...prev]);
      setTerm('');
      setTranslation('');
      setExample('');
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  return {
    term,
    setTerm,
    translation,
    setTranslation,
    example,
    setExample,
    added,
    isAdding: addCard.isPending,
    error: addCard.error ? String(addCard.error) : null,
    submitCard: () => {
      if (term.trim() && translation.trim()) addCard.mutate();
    },
  };
}
