// Type declaration for the federated remote module exposed by mfe-learner.
declare module 'mfe_learner/LearnerApp' {
  import type { ComponentType } from 'react';
  /** API caller injected by the host (authenticated fetch against the BFF). */
  export type LearnerApi = (path: string, init?: RequestInit) => Promise<Response>;
  const LearnerApp: ComponentType<{ api: LearnerApi }>;
  export default LearnerApp;
}
