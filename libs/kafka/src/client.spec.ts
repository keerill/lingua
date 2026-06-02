import { buildKafkaConfig } from './client';

describe('buildKafkaConfig (SASL_SSL opt-in via env)', () => {
  const ENV = [
    'KAFKA_SSL',
    'KAFKA_SSL_CA',
    'KAFKA_SASL_USERNAME',
    'KAFKA_SASL_PASSWORD',
    'KAFKA_SASL_MECHANISM',
  ] as const;
  const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  beforeEach(() => ENV.forEach((k) => delete process.env[k]));

  const base = { brokers: 'a:9092, b:9092', clientId: 'svc-x' };

  it('is PLAINTEXT (Slices 1–4c behaviour) when no auth env is set', () => {
    const cfg = buildKafkaConfig(base);
    expect(cfg).toEqual({
      kafkaJS: { clientId: 'svc-x', brokers: ['a:9092', 'b:9092'] },
    });
    expect(cfg.kafkaJS?.ssl).toBeUndefined();
    expect(cfg.kafkaJS?.sasl).toBeUndefined();
  });

  it('enables TLS when KAFKA_SSL=true', () => {
    process.env.KAFKA_SSL = 'true';
    expect(buildKafkaConfig(base).kafkaJS?.ssl).toBe(true);
  });

  it('trusts a private CA via the librdkafka ssl.ca.pem property (and implies TLS)', () => {
    process.env.KAFKA_SSL_CA = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
    const cfg = buildKafkaConfig(base);
    expect(cfg.kafkaJS?.ssl).toBe(true);
    expect(cfg['ssl.ca.pem']).toContain('BEGIN CERTIFICATE');
  });

  it('adds SASL (default scram-sha-256) when a username is set', () => {
    process.env.KAFKA_SASL_USERNAME = 'doadmin';
    process.env.KAFKA_SASL_PASSWORD = 'pw';
    expect(buildKafkaConfig(base).kafkaJS?.sasl).toEqual({
      mechanism: 'scram-sha-256',
      username: 'doadmin',
      password: 'pw',
    });
  });

  it('honours an explicit KAFKA_SASL_MECHANISM', () => {
    process.env.KAFKA_SASL_USERNAME = 'u';
    process.env.KAFKA_SASL_MECHANISM = 'plain';
    expect(buildKafkaConfig(base).kafkaJS?.sasl).toMatchObject({
      mechanism: 'plain',
      username: 'u',
    });
  });
});
