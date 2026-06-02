import { jsonSerde, type KafkaSerde } from './serde';

export function resolveSerde(): KafkaSerde {
  const url = process.env.SCHEMA_REGISTRY_URL?.trim();
  if (!url) return jsonSerde;
  const username = process.env.SCHEMA_REGISTRY_USER?.trim();
  const password = process.env.SCHEMA_REGISTRY_PASSWORD;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createSchemaRegistrySerde } = require('./schema-registry.serde');
  return createSchemaRegistrySerde({
    baseUrl: url,
    ...(username && { basicAuth: { username, password: password ?? '' } }),
  });
}
