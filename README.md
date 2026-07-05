# vite-default-opt

A Vite plugin that normalizes **default imports** of third-party packages so
they interop cleanly across CommonJS and ES modules. For each default import of
a bare (package) specifier it rebinds the local name through an interop
fallback — `X.default ?? X` — so code works whether the dependency exposes its
value as a real ESM default or as a CJS `module.exports`.

The transform is **AST-based** (via `@babel/parser`) and edits are applied with
[`magic-string`](https://github.com/Rich-Harris/magic-string), so an accurate
**source map** is emitted and downstream debugging keeps pointing at the
original source.

## Installation

```bash
npm install --save-dev vite-default-opt
# or
yarn add --dev vite-default-opt
```

## Usage

```javascript
import { defineConfig } from 'vite';
import transformDefaultImportPlugin from 'vite-default-opt';

export default defineConfig({
  plugins: [transformDefaultImportPlugin()],
});
```

### Options

```ts
transformDefaultImportPlugin({
  // Only transform files matching these patterns (default: all script files).
  include: ['src/**/*.{ts,tsx,js,jsx}'],
  // Never transform files matching these patterns.
  exclude: ['**/*.stories.tsx'],
});
```

`include` / `exclude` accept anything
[`@rollup/pluginutils`'s `createFilter`](https://github.com/rollup/plugins/tree/master/packages/pluginutils#createfilter)
accepts (glob string, RegExp, or an array of them). Use them to shrink the
plugin's blast radius to just the files that need interop handling.

## How it works

A default import of a package:

```javascript
import SomeModule from 'some-module';
```

becomes:

```javascript
import SomeModuleInner from 'some-module';
const SomeModule = SomeModuleInner.default ?? SomeModuleInner;
```

Because the rewrite works on the parsed AST rather than a regex, it also
handles cases a text match cannot:

- **Mixed imports** — `import React, { useState } from 'react'` keeps the named
  bindings intact and only rebinds the default:

  ```javascript
  import ReactInner, { useState } from 'react';
  const React = ReactInner.default ?? ReactInner;
  ```

- **Namespace + default** — `import Foo, * as ns from 'foo'` preserves `ns`.

The plugin intentionally **leaves the following untouched**:

- relative / absolute imports (`./foo`, `/abs/foo`) and Vite virtual modules,
- named-only and namespace-only imports (no default binding to rebind),
- type-only imports (`import type Foo from 'foo'`), and
- `import`-like text that appears inside strings or comments.

If a file fails to parse, the plugin skips it (emitting a warning) and lets the
real compiler report the syntax error rather than failing the build.
