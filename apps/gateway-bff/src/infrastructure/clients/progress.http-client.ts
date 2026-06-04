import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ProgressDashboard, ProgressOverview } from '@lingua/contracts';
import { ProgressPort } from '../../application/ports/progress.port';

@Injectable()
export class ProgressHttpClient implements ProgressPort {
  private readonly http: AxiosInstance = axios.create({
    baseURL: process.env.SVC_PROGRESS_URL ?? 'http://localhost:3107',
    timeout: 5000,
  });

  private headers(userId: string) {
    return { headers: { 'x-user-id': userId } };
  }

  async getOverview(userId: string): Promise<ProgressOverview> {
    const { data } = await this.http.get<ProgressOverview>(
      '/internal/progress/overview',
      this.headers(userId),
    );
    return data;
  }

  async getDashboard(userId: string): Promise<ProgressDashboard> {
    const { data } = await this.http.get<ProgressDashboard>(
      '/internal/progress/dashboard',
      this.headers(userId),
    );
    return data;
  }
}
