/** DI token holding the shared {@link KeycloakJwtVerifier} instance. */
export const KEYCLOAK_VERIFIER = Symbol('KEYCLOAK_VERIFIER');

/** Metadata key set by the {@link Roles} decorator. */
export const ROLES_KEY = 'lingua:roles';

/** Request property where the authenticated user is attached by the guard. */
export const REQUEST_USER_KEY = 'user';
