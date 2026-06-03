export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly displayName: string,
    public readonly roles: string[],
    public readonly createdAt: Date,
  ) {}
}

export interface ProfileData {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}
