import { describe, it, expect } from 'vitest';
import transformDefaultImportPlugin, {
  type TransformDefaultImportOptions,
} from '../src/index';

type TransformResult = { code: string; map: unknown } | null;

/**
 * Invoke the plugin's `transform` hook directly with a minimal Rollup plugin
 * context (only `warn` is exercised).
 */
function run(
  code: string,
  id = '/src/app.tsx',
  options: TransformDefaultImportOptions = {},
): TransformResult {
  const hook = transformDefaultImportPlugin(options).transform as unknown as (
    this: { warn: (msg: string) => void },
    code: string,
    id: string,
  ) => TransformResult;
  return hook.call({ warn: () => {} }, code, id);
}

describe('transformDefaultImportPlugin', () => {
  it('rebinds a default-only import of a bare specifier', () => {
    const out = run(`import Foo from 'foo';`);
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`import FooInner from 'foo';`);
    expect(out!.code).toContain(`const Foo = FooInner.default ?? FooInner;`);
  });

  it('handles mixed default + named imports (the case the old regex skipped)', () => {
    const out = run(`import React, { useState, useEffect } from 'react';`);
    expect(out).not.toBeNull();
    // Named specifiers are preserved verbatim; only the default is renamed.
    expect(out!.code).toContain(
      `import ReactInner, { useState, useEffect } from 'react';`,
    );
    expect(out!.code).toContain(`const React = ReactInner.default ?? ReactInner;`);
  });

  it('preserves a namespace specifier alongside the default', () => {
    const out = run(`import Foo, * as ns from 'foo';`);
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`import FooInner, * as ns from 'foo';`);
    expect(out!.code).toContain(`const Foo = FooInner.default ?? FooInner;`);
  });

  it('leaves named-only imports untouched', () => {
    expect(run(`import { useState } from 'react';`)).toBeNull();
  });

  it('leaves relative and absolute imports untouched', () => {
    expect(run(`import Foo from './foo';`)).toBeNull();
    expect(run(`import Foo from '/abs/foo';`)).toBeNull();
  });

  it('leaves type-only default imports untouched', () => {
    expect(run(`import type Foo from 'foo';`)).toBeNull();
  });

  it('does not touch import-like text inside strings or comments', () => {
    const code = [
      `const s = "import Foo from 'foo'";`,
      `// import Bar from 'bar'`,
      `/* import Baz from 'baz' */`,
    ].join('\n');
    // The old regex would have mangled all three of these.
    expect(run(code)).toBeNull();
  });

  it('emits a non-empty source map', () => {
    const out = run(`import Foo from 'foo';`);
    expect(out).not.toBeNull();
    const map = out!.map as { mappings: string } | null;
    expect(map).toBeTruthy();
    expect(map!.mappings.length).toBeGreaterThan(0);
  });

  it('parses TypeScript and JSX without choking', () => {
    const code = [
      `import Chart from 'chart.js';`,
      `const x: number = 1;`,
      `export const El = () => <div>{x}</div>;`,
    ].join('\n');
    const out = run(code);
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`import ChartInner from 'chart.js';`);
    expect(out!.code).toContain(`const Chart = ChartInner.default ?? ChartInner;`);
  });

  it('respects the exclude option', () => {
    const out = run(`import Foo from 'foo';`, '/src/ignored.ts', {
      exclude: '**/ignored.ts',
    });
    expect(out).toBeNull();
  });
});
