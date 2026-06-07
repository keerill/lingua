import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateScenarioDto, Scenario } from '@lingua/contracts';
import { useApi } from '../api';

const EMPTY: CreateScenarioDto = {
  slug: '',
  title: '',
  description: '',
  systemPrompt: '',
  level: 'A1',
  published: true,
};

export function useScenariosViewModel() {
  const api = useApi();
  const qc = useQueryClient();
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ['studio-scenarios'] });

  const query = useQuery({
    queryKey: ['studio-scenarios'],
    queryFn: () => api.listScenarios(),
  });
  const [form, setForm] = useState<CreateScenarioDto>(EMPTY);

  const create = useMutation({
    mutationFn: () => api.createScenario({ ...form, slug: form.slug.trim() }),
    onSuccess: () => {
      setForm(EMPTY);
      invalidate();
    },
  });
  const togglePublished = useMutation({
    mutationFn: (s: Scenario) =>
      api.updateScenario(s.id, { published: !s.published }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteScenario(id),
    onSuccess: invalidate,
  });

  const canSubmit =
    form.slug.trim() !== '' &&
    form.title.trim() !== '' &&
    form.systemPrompt.trim() !== '';

  return {
    scenarios: (query.data ?? []) as Scenario[],
    isLoading: query.isLoading,
    error: query.error
      ? String(query.error)
      : create.error
        ? String(create.error)
        : null,
    form,
    setField: <K extends keyof CreateScenarioDto>(
      key: K,
      value: CreateScenarioDto[K],
    ) => setForm((f) => ({ ...f, [key]: value })),
    isSaving: create.isPending,
    canSubmit,
    submit: () => {
      if (canSubmit) create.mutate();
    },
    togglePublished: (s: Scenario) => togglePublished.mutate(s),
    remove: (id: string) => remove.mutate(id),
  };
}
