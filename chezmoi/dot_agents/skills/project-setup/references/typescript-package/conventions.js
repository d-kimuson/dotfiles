/**
 * oxlint JS plugin — project conventions.
 *
 * Rules:
 *   - no-barrel-file:      index.ts that only re-exports are prohibited
 *   - colocated-tests:     test files must sit next to their source, not in __tests__/
 *   - module-boundaries:   enforce dependency direction between src/ modules
 */

const RE_REEXPORT = /^\s*export\s+(?:\{[^}]*\}\s+from|type\s+\{[^}]*\}\s+from|\*\s+from)\s/;

const noBarrelFile = {
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const base = filename.split('/').pop();

    if (base !== 'index.ts' && base !== 'index.tsx') {
      return {};
    }

    return {
      Program(node) {
        const text = context.sourceCode.getText(node);
        const lines = text.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('//'));

        if (lines.length === 0) return;

        const allReexports = lines.every((line) => RE_REEXPORT.test(line));
        if (allReexports) {
          context.report({
            node,
            message:
              'Barrel files (index.ts with only re-exports) are prohibited. Import directly from source modules.',
          });
        }
      },
    };
  },
};

const RE_TEST_DIR = /(?:^|[/\\])__tests?__(?:[/\\]|$)/;

const colocatedTests = {
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!RE_TEST_DIR.test(filename)) {
      return {};
    }

    return {
      Program(node) {
        context.report({
          node,
          message:
            'Test files must be colocated with their source files, not placed in __tests__/ directories.',
        });
      },
    };
  },
};

// --- module-boundaries ---

// {Customize: define your project's module names}
const MODULE_NAMES = ['core', 'web', 'server', 'cli', 'platform'];

// {Customize: define allowed runtime dependency directions}
const ALLOWED_RUNTIME_DEPS = {
  core: ['platform'],
  web: [],
  server: ['core', 'platform'],
  cli: ['core', 'platform'],
  platform: [],
};

// {Customize: define allowed type-only dependency directions}
const ALLOWED_TYPE_DEPS = {
  web: ['server'],
};

const RE_SRC_MODULE = new RegExp(`[/\\\\]src[/\\\\](${MODULE_NAMES.join('|')})[/\\\\]`);

const resolveTargetModule = (source) => {
  const aliasPattern = new RegExp(`^@/(${MODULE_NAMES.join('|')})(?:[/\\\\]|$)`);
  const aliasMatch = source.match(aliasPattern);
  if (aliasMatch) return aliasMatch[1];

  const relPattern = new RegExp(`(?:^|[/\\\\])(${MODULE_NAMES.join('|')})[/\\\\]`);
  const relMatch = source.match(relPattern);
  if (relMatch) return relMatch[1];

  return null;
};

const getSourceModule = (filename) => {
  const match = filename.match(RE_SRC_MODULE);
  return match ? match[1] : null;
};

const isAllowed = (from, to, typeOnly) => {
  if (from === to) return true;

  const runtimeAllowed = ALLOWED_RUNTIME_DEPS[from] ?? [];
  if (runtimeAllowed.includes(to)) return true;

  if (typeOnly) {
    const typeAllowed = ALLOWED_TYPE_DEPS[from] ?? [];
    if (typeAllowed.includes(to)) return true;
  }

  return false;
};

const moduleBoundaries = {
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const fromModule = getSourceModule(filename);

    if (!fromModule) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        const toModule = resolveTargetModule(source);

        if (!toModule || !MODULE_NAMES.includes(toModule)) return;

        const typeOnly = node.importKind === 'type';

        if (!isAllowed(fromModule, toModule, typeOnly)) {
          const hint = typeOnly ? '' : ' (type-only imports may be allowed)';
          context.report({
            node,
            message: `Module boundary violation: '${fromModule}' must not import from '${toModule}'.${hint}`,
          });
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: 'conventions',
  },
  rules: {
    'no-barrel-file': noBarrelFile,
    'colocated-tests': colocatedTests,
    'module-boundaries': moduleBoundaries,
  },
};

export default plugin;
