import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

let cachedRoot: string | null = null;

export function resolveProtoRoot(): string {
  if (cachedRoot) return cachedRoot;
  const candidates = [
    process.env.PROTO_DIR,
    join(process.cwd(), 'libs', 'contracts', 'proto'),
    join(process.cwd(), 'proto'),
    resolve(__dirname, '..', '..', 'contracts', 'proto'),
  ].filter((c): c is string => !!c);

  for (const dir of candidates) {
    if (existsSync(dir)) {
      cachedRoot = dir;
      return dir;
    }
  }
  throw new Error(
    `[grpc] could not locate the proto directory. Tried: ${candidates.join(
      ', ',
    )}. Set PROTO_DIR to the directory containing the lingua/ proto tree.`,
  );
}

export function resolveProtoPath(relative: string): string {
  return join(resolveProtoRoot(), relative);
}
