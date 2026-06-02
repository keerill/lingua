export interface KafkaSerde {
  serialize(topic: string, value: unknown): Promise<Buffer>;

  deserialize(topic: string, data: Buffer): Promise<unknown>;
}

export const jsonSerde: KafkaSerde = {
  async serialize(_topic, value) {
    return Buffer.from(JSON.stringify(value), 'utf8');
  },
  async deserialize(_topic, data) {
    const raw = data.toString('utf8');
    return raw ? JSON.parse(raw) : null;
  },
};
