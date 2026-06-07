import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ContentLevel,
  DeckTemplate,
  DeckTemplateCard,
} from '@lingua/contracts';
import { useApi } from '../api';

function parseCards(text: string): DeckTemplateCard[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [term, translation, example] = line.split('|').map((p) => p.trim());
      return {
        term: term ?? '',
        translation: translation ?? '',
        example: example || null,
      };
    })
    .filter((c) => c.term && c.translation);
}

export function useDeckTemplatesViewModel() {
  const api = useApi();
  const qc = useQueryClient();
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ['studio-templates'] });

  const query = useQuery({
    queryKey: ['studio-templates'],
    queryFn: () => api.listDeckTemplates(),
  });

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<ContentLevel>('A1');
  const [cardsText, setCardsText] = useState('');

  const reset = () => {
    setSlug('');
    setTitle('');
    setDescription('');
    setLevel('A1');
    setCardsText('');
  };

  const create = useMutation({
    mutationFn: () =>
      api.createDeckTemplate({
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim(),
        level,
        cards: parseCards(cardsText),
      }),
    onSuccess: () => {
      reset();
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteDeckTemplate(id),
    onSuccess: invalidate,
  });

  const parsedCount = parseCards(cardsText).length;
  const canSubmit =
    slug.trim() !== '' && title.trim() !== '' && parsedCount > 0;

  return {
    templates: (query.data ?? []) as DeckTemplate[],
    isLoading: query.isLoading,
    error: query.error
      ? String(query.error)
      : create.error
        ? String(create.error)
        : null,
    slug,
    setSlug,
    title,
    setTitle,
    description,
    setDescription,
    level,
    setLevel,
    cardsText,
    setCardsText,
    parsedCount,
    isSaving: create.isPending,
    canSubmit,
    submit: () => {
      if (canSubmit) create.mutate();
    },
    remove: (id: string) => remove.mutate(id),
  };
}
