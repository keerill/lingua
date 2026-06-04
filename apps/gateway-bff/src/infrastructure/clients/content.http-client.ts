import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  CreateDeckTemplateDto,
  CreateLessonDto,
  CreateScenarioDto,
  DeckTemplate,
  Lesson,
  Scenario,
  UpdateDeckTemplateDto,
  UpdateLessonDto,
  UpdateScenarioDto,
} from '@lingua/contracts';
import { ContentPort } from '../../application/ports/content.port';

@Injectable()
export class ContentHttpClient implements ContentPort {
  private readonly http: AxiosInstance = axios.create({
    baseURL: process.env.SVC_CONTENT_URL ?? 'http://localhost:3106',
    timeout: 5000,
  });

  async listScenarios(): Promise<Scenario[]> {
    const { data } = await this.http.get<Scenario[]>('/internal/scenarios');
    return data;
  }
  async getScenario(id: string): Promise<Scenario> {
    const { data } = await this.http.get<Scenario>(`/internal/scenarios/${id}`);
    return data;
  }
  async createScenario(dto: CreateScenarioDto): Promise<Scenario> {
    const { data } = await this.http.post<Scenario>('/internal/scenarios', dto);
    return data;
  }
  async updateScenario(id: string, dto: UpdateScenarioDto): Promise<Scenario> {
    const { data } = await this.http.patch<Scenario>(
      `/internal/scenarios/${id}`,
      dto,
    );
    return data;
  }
  async deleteScenario(id: string): Promise<void> {
    await this.http.delete(`/internal/scenarios/${id}`);
  }

  async listLessons(): Promise<Lesson[]> {
    const { data } = await this.http.get<Lesson[]>('/internal/lessons');
    return data;
  }
  async createLesson(dto: CreateLessonDto): Promise<Lesson> {
    const { data } = await this.http.post<Lesson>('/internal/lessons', dto);
    return data;
  }
  async updateLesson(id: string, dto: UpdateLessonDto): Promise<Lesson> {
    const { data } = await this.http.patch<Lesson>(
      `/internal/lessons/${id}`,
      dto,
    );
    return data;
  }
  async deleteLesson(id: string): Promise<void> {
    await this.http.delete(`/internal/lessons/${id}`);
  }

  async listDeckTemplates(): Promise<DeckTemplate[]> {
    const { data } = await this.http.get<DeckTemplate[]>(
      '/internal/deck-templates',
    );
    return data;
  }
  async createDeckTemplate(dto: CreateDeckTemplateDto): Promise<DeckTemplate> {
    const { data } = await this.http.post<DeckTemplate>(
      '/internal/deck-templates',
      dto,
    );
    return data;
  }
  async updateDeckTemplate(
    id: string,
    dto: UpdateDeckTemplateDto,
  ): Promise<DeckTemplate> {
    const { data } = await this.http.patch<DeckTemplate>(
      `/internal/deck-templates/${id}`,
      dto,
    );
    return data;
  }
  async deleteDeckTemplate(id: string): Promise<void> {
    await this.http.delete(`/internal/deck-templates/${id}`);
  }
}
