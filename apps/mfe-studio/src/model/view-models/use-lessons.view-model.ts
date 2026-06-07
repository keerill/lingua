import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateLessonDto, Lesson } from '@lingua/contracts';
import { useApi } from '../api';

const EMPTY: CreateLessonDto = {
  slug: '',
  title: '',
  summary: '',
  contentMarkdown: '',
  level: 'A1',
  published: true,
};

export function useLessonsViewModel() {
  const api = useApi();
  const qc = useQueryClient();
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ['studio-lessons'] });

  const query = useQuery({
    queryKey: ['studio-lessons'],
    queryFn: () => api.listLessons(),
  });
  const [form, setForm] = useState<CreateLessonDto>(EMPTY);

  const create = useMutation({
    mutationFn: () => api.createLesson({ ...form, slug: form.slug.trim() }),
    onSuccess: () => {
      setForm(EMPTY);
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteLesson(id),
    onSuccess: invalidate,
  });

  const canSubmit = form.slug.trim() !== '' && form.title.trim() !== '';

  return {
    lessons: (query.data ?? []) as Lesson[],
    isLoading: query.isLoading,
    error: query.error
      ? String(query.error)
      : create.error
        ? String(create.error)
        : null,
    form,
    setField: <K extends keyof CreateLessonDto>(
      key: K,
      value: CreateLessonDto[K],
    ) => setForm((f) => ({ ...f, [key]: value })),
    isSaving: create.isPending,
    canSubmit,
    submit: () => {
      if (canSubmit) create.mutate();
    },
    remove: (id: string) => remove.mutate(id),
  };
}
