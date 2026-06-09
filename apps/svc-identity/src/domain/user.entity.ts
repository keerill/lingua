/** User profile. `id` IS the Keycloak `sub` — we never mint our own ids. */
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly displayName: string,
    public readonly roles: string[],
    public readonly createdAt: Date,
  ) {}
}

/** Claims-derived profile data used to create/update a user. */
export interface ProfileData {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}
