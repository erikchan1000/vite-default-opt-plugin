import type { Plugin } from 'vite';
import { parse } from '@babel/parser';
import type { ImportDeclaration, ImportDefaultSpecifier } from '@babel/types';
import { createFilter, type FilterPattern } from '@rollup/pluginutils';
import MagicString from 'magic-string';

export interface TransformDefaultImportOptions {
  /**
   * Files to include. Passed straight to `@rollup/pluginutils` `createFilter`.
   * When omitted, every non-`node_modules` script file is considered.
   */
  include?: FilterPattern;
  /**
   * Files to exclude. Passed straight to `@rollup/pluginutils` `createFilter`.
   */
  exclude?: FilterPattern;
}

// .js .jsx .ts .tsx .mjs .cjs .mts .cts (with an optional ?query suffix stripped first)
const SCRIPT_RE = /\.[cm]?[jt]sx?$/;

function isDefaultSpecifier(
  spec: ImportDeclaration['specifiers'][number],
): spec is ImportDefaultSpecifier {
  return spec.type === 'ImportDefaultSpecifier';
}

/**
 * Vite plugin that rebinds default imports of bare (package) specifiers through
 * a CJS/ESM interop fallback: `X.default ?? X`.
 *
 * The transform is AST-based (via `@babel/parser`), so it:
 *   - correctly handles mixed imports like `import React, { useState } from 'react'`,
 *   - never touches `import`-like text inside strings or comments, and
 *   - leaves type-only imports (`import type X from 'x'`) alone.
 *
 * Edits are applied with `magic-string`, so an accurate source map is emitted
 * and downstream debugging keeps pointing at the original source.
 */
export default function transformDefaultImportPlugin(
  options: TransformDefaultImportOptions = {},
): Plugin {
  const filter = createFilter(options.include, options.exclude);

  return {
    name: 'transform-default-import-plugin',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('node_modules')) return null;

      const pathname = id.split('?', 1)[0];
      if (!SCRIPT_RE.test(pathname)) return null;
      if (!filter(id)) return null;
      // Cheap bail-out before paying for a full parse.
      if (!code.includes('import')) return null;

      let ast;
      try {
        ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        });
      } catch (err) {
        // Boundary decision: we are handed arbitrary source. If it does not
        // parse, skip it and let the real compiler surface the syntax error
        // rather than crashing the whole build here.
        this.warn(
          `[vite-default-opt] Skipping ${id}: failed to parse (${
            (err as Error).message
          })`,
        );
        return null;
      }

      const s = new MagicString(code);
      let transformed = false;

      for (const node of ast.program.body) {
        if (node.type !== 'ImportDeclaration') continue;
        // `import type X from 'x'` carries no runtime binding — leave it alone.
        if (node.importKind === 'type') continue;

        const source = node.source.value;
        if (
          source.startsWith('.') ||
          source.startsWith('/') ||
          source.startsWith('\0')
        ) {
          continue;
        }

        const defaultSpec = node.specifiers.find(isDefaultSpecifier);
        if (!defaultSpec) continue;

        const localName = defaultSpec.local.name;
        const innerName = `${localName}Inner`;

        // Rename only the default binding; named/namespace specifiers are
        // preserved exactly as written.
        s.update(defaultSpec.local.start!, defaultSpec.local.end!, innerName);
        // Re-bind the default with a CJS/ESM interop fallback. `??` (not `||`)
        // so a legitimately falsy default export is not discarded.
        s.appendLeft(
          node.end!,
          `\nconst ${localName} = ${innerName}.default ?? ${innerName};`,
        );
        transformed = true;
      }

      if (!transformed) return null;

      return {
        code: s.toString(),
        map: s.generateMap({ source: id, hires: true }),
      };
    },
  };
}
