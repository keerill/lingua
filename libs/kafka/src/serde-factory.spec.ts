import { jsonSerde, type KafkaSerde } from './serde';

const fakeSrSerde: KafkaSerde = {
  serialize: jest.fn(),
  deserialize: jest.fn(),
};
const createSchemaRegistrySerde = jest.fn(() => fakeSrSerde);
jest.mock('./schema-registry.serde', () => ({ createSchemaRegistrySerde }));

import { resolveSerde } from './serde-factory';

describe('resolveSerde (opt-in via SCHEMA_REGISTRY_URL)', () => {
  const SR_ENV = [
    'SCHEMA_REGISTRY_URL',
    'SCHEMA_REGISTRY_USER',
    'SCHEMA_REGISTRY_PASSWORD',
  ] as const;
  const saved = Object.fromEntries(SR_ENV.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of SR_ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    createSchemaRegistrySerde.mockClear();
  });

  it('returns the JSON serde when the env var is unset (dev/test default)', () => {
    delete process.env.SCHEMA_REGISTRY_URL;
    expect(resolveSerde()).toBe(jsonSerde);
    expect(createSchemaRegistrySerde).not.toHaveBeenCalled();
  });

  it('returns the Schema Registry serde when the env var is set', () => {
    process.env.SCHEMA_REGISTRY_URL = 'http://localhost:8081';
    delete process.env.SCHEMA_REGISTRY_USER;
    expect(resolveSerde()).toBe(fakeSrSerde);
    expect(createSchemaRegistrySerde).toHaveBeenCalledWith({
      baseUrl: 'http://localhost:8081',
    });
  });

  it('passes basic-auth credentials when SCHEMA_REGISTRY_USER is set (managed)', () => {
    process.env.SCHEMA_REGISTRY_URL = 'https://sr.example.com';
    process.env.SCHEMA_REGISTRY_USER = 'sr-user';
    process.env.SCHEMA_REGISTRY_PASSWORD = 's3cret';
    expect(resolveSerde()).toBe(fakeSrSerde);
    expect(createSchemaRegistrySerde).toHaveBeenCalledWith({
      baseUrl: 'https://sr.example.com',
      basicAuth: { username: 'sr-user', password: 's3cret' },
    });
  });
});
