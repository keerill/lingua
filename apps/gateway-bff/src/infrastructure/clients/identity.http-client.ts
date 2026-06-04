import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { UserProfile } from '@lingua/contracts';
import {
  IdentityPort,
  SyncProfileInput,
} from '../../application/ports/identity.port';

@Injectable()
export class IdentityHttpClient implements IdentityPort {
  private readonly http: AxiosInstance = axios.create({
    baseURL: process.env.SVC_IDENTITY_URL ?? 'http://localhost:3101',
    timeout: 5000,
  });

  async sync(input: SyncProfileInput): Promise<UserProfile> {
    const { data } = await this.http.post<UserProfile>(
      '/internal/users/sync',
      input,
    );
    return data;
  }
}
