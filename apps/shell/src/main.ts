// Module Federation requires an async boundary at the entry so that shared
// singletons (React, etc.) are negotiated before the app code runs.
import('./bootstrap');
export {};
