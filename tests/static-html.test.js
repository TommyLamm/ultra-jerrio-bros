import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('index uses a file-url compatible core bundle instead of external module imports', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /<script\s+src="\.\/src\/core\/platformer-core\.js"><\/script>/);
  assert.doesNotMatch(html, /from\s+['"]\.\/src\/core\/engine\.js['"]/);
});
