// Type declaration for the federated remote module exposed by mfe-learner.
declare module 'mfe_learner/LearnerApp' {
  import type { ComponentType } from 'react';
  /** API caller injected by the host (authenticated fetch against the BFF). */
  export type LearnerApi = (path: string, init?: RequestInit) => Promise<Response>;
  const LearnerApp: ComponentType<{ api: LearnerApi }>;
  export default LearnerApp;
}

// Type declaration for the federated remote module exposed by mfe-speaking.
declare module 'mfe_speaking/SpeakingApp' {
  import type { ComponentType } from 'react';
  export type SpeakingApi = (path: string, init?: RequestInit) => Promise<Response>;
  const SpeakingApp: ComponentType<{ api: SpeakingApi; accessToken: string }>;
  export default SpeakingApp;
}

// Type declaration for the federated remote module exposed by mfe-progress.
declare module 'mfe_progress/ProgressApp' {
  import type { ComponentType } from 'react';
  export type ProgressApi = (path: string, init?: RequestInit) => Promise<Response>;
  const ProgressApp: ComponentType<{ api: ProgressApi }>;
  export default ProgressApp;
}

// Type declaration for the federated remote module exposed by mfe-studio.
declare module 'mfe_studio/StudioApp' {
  import type { ComponentType } from 'react';
  export type StudioApi = (path: string, init?: RequestInit) => Promise<Response>;
  const StudioApp: ComponentType<{ api: StudioApi }>;
  export default StudioApp;
}
