import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  CreateDeckTemplateDto,
  CreateLessonDto,
  CreateScenarioDto,
  DeckTemplate,
  Lesson,
  Scenario,
  UpdateScenarioDto,
} from '@lingua/contracts';

export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

export interface StudioApi {
  listScenarios(): Promise<Scenario[]>;
  createScenario(dto: CreateScenarioDto): Promise<Scenario>;
  updateScenario(id: string, dto: UpdateScenarioDto): Promise<Scenario>;
  deleteScenario(id: string): Promise<void>;
  listLessons(): Promise<Lesson[]>;
  createLesson(dto: CreateLessonDto): Promise<Lesson>;
  deleteLesson(id: string): Promise<void>;
  listDeckTemplates(): Promise<DeckTemplate[]>;
  createDeckTemplate(dto: CreateDeckTemplateDto): Promise<DeckTemplate>;
  deleteDeckTemplate(id: string): Promise<void>;
}

const ApiContext = createContext<StudioApi | null>(null);

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function expectOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }
}

export function ApiProvider({
  api,
  children,
}: {
  api: ApiFetch;
  children: ReactNode;
}) {
  const client = useMemo<StudioApi>(
    () => ({
      listScenarios: () => api('/studio/scenarios').then(json<Scenario[]>),
      createScenario: (dto) =>
        api('/studio/scenarios', {
          method: 'POST',
          body: JSON.stringify(dto),
        }).then(json<Scenario>),
      updateScenario: (id, dto) =>
        api(`/studio/scenarios/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(dto),
        }).then(json<Scenario>),
      deleteScenario: (id) =>
        api(`/studio/scenarios/${id}`, { method: 'DELETE' }).then(expectOk),
      listLessons: () => api('/studio/lessons').then(json<Lesson[]>),
      createLesson: (dto) =>
        api('/studio/lessons', {
          method: 'POST',
          body: JSON.stringify(dto),
        }).then(json<Lesson>),
      deleteLesson: (id) =>
        api(`/studio/lessons/${id}`, { method: 'DELETE' }).then(expectOk),
      listDeckTemplates: () =>
        api('/studio/deck-templates').then(json<DeckTemplate[]>),
      createDeckTemplate: (dto) =>
        api('/studio/deck-templates', {
          method: 'POST',
          body: JSON.stringify(dto),
        }).then(json<DeckTemplate>),
      deleteDeckTemplate: (id) =>
        api(`/studio/deck-templates/${id}`, { method: 'DELETE' }).then(
          expectOk,
        ),
    }),
    [api],
  );
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): StudioApi {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used within ApiProvider');
  return ctx;
}
