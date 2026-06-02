# Cross-language contract artifacts

The Protobuf IDL in [`../proto`](../proto) is the **single, language-neutral source
of truth** for the gRPC services and Kafka event schemas. TypeScript is the only
runtime today (`../src/generated`, used by the services), but the contracts are
language-neutral by construction — this directory holds the proof.

## `descriptor.binpb`

A compiled `FileDescriptorSet` (`buf build -o descriptor.binpb`) covering every
`.proto`. It is the canonical, language-neutral input any toolchain's codegen
consumes — proof that the contracts are not tied to TypeScript. A non-TS
consumer would generate stubs straight from it, e.g.:

```bash
protoc --descriptor_set_in=libs/contracts/gen/descriptor.binpb \
       --<lang>_out=out --grpc_<lang>_out=out \
       $(buf ls-files libs/contracts/proto)
```

Regenerate it (with the TS/ES code) via `pnpm proto:gen`.
