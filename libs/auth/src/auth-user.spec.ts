import { claimsToUser } from './auth-user';

describe('claimsToUser', () => {
  it('maps realm roles and prefers name for displayName', () => {
    const user = claimsToUser({
      sub: 'u-123',
      email: 'a@b.com',
      name: 'Ann B',
      preferred_username: 'ann',
      realm_access: { roles: ['learner', 'offline_access'] },
    });
    expect(user).toEqual({
      sub: 'u-123',
      email: 'a@b.com',
      displayName: 'Ann B',
      roles: ['learner', 'offline_access'],
    });
  });

  it('falls back to preferred_username then email then sub for displayName', () => {
    expect(claimsToUser({ sub: 's', preferred_username: 'nick' }).displayName).toBe('nick');
    expect(claimsToUser({ sub: 's', email: 'e@x.com' }).displayName).toBe('e@x.com');
    expect(claimsToUser({ sub: 's' }).displayName).toBe('s');
  });

  it('defaults roles to empty array when realm_access absent', () => {
    expect(claimsToUser({ sub: 's' }).roles).toEqual([]);
  });
});
