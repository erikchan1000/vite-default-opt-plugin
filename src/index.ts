import type { Plugin } from 'vite';

export default function transformDefaultImportPlugin(): Plugin {
  return {
    name: 'transform-default-import-plugin',
    enforce: 'post',
    transform(code, id) {
      // Skip processing for files in node_modules
      if (id.includes('node_modules')) return;

      // Only process JavaScript and TypeScript files
      if (!id.endsWith('.js') && !id.endsWith('.ts') && !id.endsWith('.jsx') && !id.endsWith('.tsx')) return;

      // Regular expression to match default imports
      const importRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g;

      let match;
      let transformedCode = code;
      let transformed = false;

      while ((match = importRegex.exec(code)) !== null) {
        const [fullMatch, importName, importPath] = match;

        // Skip transformation for relative imports or absolute imports within the project
        if (importPath.startsWith('.') || importPath.startsWith('/')) continue;

        const newImportName = `${importName}Inner`;
        const newImport = `import ${newImportName} from "${importPath}";`;
        const defaultCheck = `const ${importName} = ${newImportName}.default || ${newImportName};`;

        transformedCode = transformedCode.replace(fullMatch, `${newImport}\n${defaultCheck}`);
        transformed = true;
      }

      if (transformed) {
        return {
          code: transformedCode,
          map: null,
        };
      }
      return null;
    },
  };
}
