import { ProgressDashboard, ProgressOverview } from '@lingua/contracts';

export const PROGRESS_PORT = Symbol('ProgressPort');

export interface ProgressPort {
  getOverview(userId: string): Promise<ProgressOverview>;
  getDashboard(userId: string): Promise<ProgressDashboard>;
}
