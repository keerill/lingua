import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DueCard, ReviewGrade } from '@lingua/contracts';
import { useApi } from '../api';

/**
 * ViewModel for the review session. Exposes the current due card, reveal state
 * and a `grade` command; on grading, FSRS reschedules and the card leaves the
 * queue.
 */
export function useReviewViewModel() {
  const api = useApi();
  const queryClient = useQueryClient();

  const queue = useQuery({ queryKey: ['queue'], queryFn: () => api.getQueue(20) });
  const [revealed, setRevealed] = useState(false);

  const review = useMutation({
    mutationFn: (vars: { cardId: string; grade: ReviewGrade }) =>
      api.submitReview(vars.cardId, vars.grade),
    onSuccess: () => {
      setRevealed(false);
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  const cards = (queue.data ?? []) as DueCard[];

  return {
    isLoading: queue.isLoading,
    error: queue.error ? String(queue.error) : null,
    dueCount: cards.length,
    current: cards[0] as DueCard | undefined,
    revealed,
    reveal: () => setRevealed(true),
    isSubmitting: review.isPending,
    grade: (cardId: string, grade: ReviewGrade) => review.mutate({ cardId, grade }),
  };
}
