# transform-default-import-plugin

A Vite plugin to automatically handle default imports for JavaScript and TypeScript files. It transforms default imports to be compatible with both CommonJS and ES module formats by checking if a module has a `default` export and falling back to the module itself if not.

## Installation

To install the plugin, simply add it to your project using npm or yarn:

```bash
npm install --save-dev transform-default-import-plugin
```
or
```bash
yarn add --dev transform-default-import-plugin
```

## Usage
```javascript
import { defineConfig } from 'vite';
import transformDefaultImportPlugin from 'transform-default-import-plugin';

export default defineConfig({
  plugins: [transformDefaultImportPlugin()],
});
```

## How it works

The plugin processes each JavaScript/TypeScript file and transforms default imports like:
```javascript
import SomeModule from 'some-module';
```
to:
```javascript
import SomeModuleInner from 'some-module';
const SomeModule = SomeModuleInner.default || SomeModuleInner;
```
