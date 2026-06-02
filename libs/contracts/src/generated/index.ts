/**
 * Generated wire contracts — Protobuf is the single source of truth
 * (libs/contracts/proto). Exposed on the `@lingua/contracts/proto` subpath so
 * the frontend bundle (which imports `@lingua/contracts`) never pulls in
 * protobufjs / protobuf-es. Namespaced per file because every proto package
 * exports a `protobufPackage` const and several share message names.
 *
 * DO NOT EDIT the ./ts and ./es trees by hand — regenerate with
 * `pnpm proto:gen` (offline TS+ES; also emits the language-neutral
 * gen/descriptor.binpb).
 */

// gRPC service stubs (ts-proto, NestJS flavour) — one namespace per service.
export * as learningV1 from './ts/lingua/learning/v1/learning';
export * as vocabularyV1 from './ts/lingua/vocabulary/v1/vocabulary';
export * as identityV1 from './ts/lingua/identity/v1/identity';
export * as progressV1 from './ts/lingua/progress/v1/progress';
export * as contentV1 from './ts/lingua/content/v1/content';

// Kafka event messages (protobuf-es) — consumed by the Schema Registry serde.
export * as eventsV1 from './es/lingua/events/v1/events_pb';
