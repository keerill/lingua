import { existsSync } from 'node:fs';
import { resolveProtoPath, resolveProtoRoot } from './proto-paths';

describe('proto-paths', () => {
  it('resolves the proto root to an existing directory', () => {
    expect(existsSync(resolveProtoRoot())).toBe(true);
  });

  it('resolves a concrete .proto file that exists on disk', () => {
    const p = resolveProtoPath('lingua/learning/v1/learning.proto');
    expect(p.endsWith('learning.proto')).toBe(true);
    expect(existsSync(p)).toBe(true);
  });
});
