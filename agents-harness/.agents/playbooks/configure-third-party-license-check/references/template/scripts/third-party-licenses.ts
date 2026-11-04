// Generates THIRD_PARTY_LICENSES.md for the production dependencies (`dependencies` and their
// transitive dependencies, as `pnpm licenses list --prod` resolves them) of the package in the current
// directory. Run from the package directory:
//
//   node scripts/third-party-licenses.ts           # write THIRD_PARTY_LICENSES.md
//   node scripts/third-party-licenses.ts --check   # fail when the file is stale
//
// For each package it reproduces the license text and the attribution files the license asks to pass
// on (`NOTICE`, `ThirdPartyNotices.txt`, and their spelling variants). It exits 1 and names the
// package when the license is outside ALLOWED or the package ships no license text.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT = 'THIRD_PARTY_LICENSES.md';

// Licenses that permit redistribution with this package. Adjust to the package's own license.
const ALLOWED: ReadonlySet<string> = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'CC0-1.0',
  'Unlicense',
  'BlueOak-1.0.0',
]);

// Packages whose license field is missing or non-standard but whose license was checked by hand.
// Key: package name. Value: the reason, with the license actually found.
const EXCEPTIONS: Readonly<Record<string, string>> = {};

const LICENSE_FILE = /^(?:licen[cs]e|copying)(?:[._-].*)?$/i;

// The stems of the attribution files Apache-2.0 §4(d) asks to carry forward, matched after
// normalising case and separators.
const ATTRIBUTION_STEMS: ReadonlySet<string> = new Set(['notice', 'thirdpartynotices']);

type LicenseEntry = {
  readonly name: string;
  readonly versions: readonly string[];
  readonly paths: readonly string[];
  readonly license: string;
};

// `pnpm licenses list --json` groups packages by license expression.
type LicenseReport = Readonly<Record<string, readonly LicenseEntry[]>>;

type NoticeEntry = {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly licenseText: string;
  readonly attributions: readonly { readonly file: string; readonly text: string }[];
};

const isLicenseEntry = (value: unknown): value is LicenseEntry =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  typeof value.name === 'string' &&
  'versions' in value &&
  Array.isArray(value.versions) &&
  'paths' in value &&
  Array.isArray(value.paths);

const isLicenseReport = (value: unknown): value is LicenseReport =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((entries) => Array.isArray(entries) && entries.every(isLicenseEntry));

const readReport = (): LicenseReport => {
  const result = spawnSync('pnpm', ['licenses', 'list', '--prod', '--json'], { encoding: 'utf8' });
  if (result.error !== undefined) throw result.error;
  const stdout = result.stdout.trim();
  // With no production dependencies pnpm prints a notice instead of JSON.
  if (!stdout.startsWith('{')) {
    if (result.status === 0) return {};
    throw new Error(`pnpm licenses failed (${String(result.status)}): ${result.stderr}${stdout}`);
  }
  const parsed: unknown = JSON.parse(stdout);
  if (!isLicenseReport(parsed)) throw new Error('unexpected output from pnpm licenses list --json');
  return parsed;
};

// SPDX expression: `A OR B` passes when either side passes; `A AND B` passes when both sides pass.
const isAllowed = (expression: string): boolean => {
  const normalized = expression.replace(/[()]/g, '').trim();
  if (normalized.includes(' OR ')) return normalized.split(' OR ').some(isAllowed);
  if (normalized.includes(' AND ')) return normalized.split(' AND ').every(isAllowed);
  return ALLOWED.has(normalized);
};

const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

// `NOTICE.txt` -> `notice`, `third-party-notices.md` -> `thirdpartynotices`.
const normalizedStem = (file: string): string => {
  const dot = file.lastIndexOf('.');
  const stem = dot > 0 ? file.slice(0, dot) : file;
  return stem.toLowerCase().replace(/[-_]/g, '');
};

const normalizeText = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .trim();

const toNoticeEntry = (
  name: string,
  version: string,
  license: string,
  directory: string,
): NoticeEntry => {
  const files = readdirSync(directory, { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name)
    .sort(compareStrings);
  const read = (file: string): string => normalizeText(readFileSync(join(directory, file), 'utf8'));
  const licenseText = files
    .filter((file) => LICENSE_FILE.test(file))
    .map(read)
    .filter((text) => text !== '')
    .join('\n\n');
  if (licenseText === '' && !(name in EXCEPTIONS)) {
    throw new Error(`${name}@${version}: no license text found in ${directory}`);
  }
  const attributions = files
    .filter((file) => ATTRIBUTION_STEMS.has(normalizedStem(file)))
    .map((file) => ({ file, text: read(file) }))
    .filter((attribution) => attribution.text !== '');
  return { name, version, license, licenseText, attributions };
};

const collectEntries = (report: LicenseReport): readonly NoticeEntry[] => {
  const problems: string[] = [];
  const entries: NoticeEntry[] = [];
  for (const [expression, packages] of Object.entries(report)) {
    for (const { name, versions, paths } of packages) {
      if (!isAllowed(expression) && !(name in EXCEPTIONS)) {
        problems.push(`${name}@${versions.join(', ')}: ${expression}`);
        continue;
      }
      paths.forEach((directory, index) => {
        // Workspace packages resolve outside node_modules; they are this repository's own code.
        if (!directory.includes('/node_modules/')) return;
        entries.push(toNoticeEntry(name, versions[index] ?? '', expression, directory));
      });
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `Dependencies with a license outside the allowlist (scripts/third-party-licenses.ts):\n${problems.map((problem) => `  ${problem}\n`).join('')}` +
        'Replace the dependency, or add it to EXCEPTIONS with the reason after checking its license by hand.',
    );
  }
  return entries.sort(
    (left, right) =>
      compareStrings(left.name, right.name) || compareStrings(left.version, right.version),
  );
};

// A fence longer than any run inside the text keeps the license verbatim.
const fencedText = (text: string): string => {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}text\n${text}\n${fence}`;
};

const renderNotice = (packageName: string, entries: readonly NoticeEntry[]): string => {
  const header = `# Third-party licenses

\`${packageName}\` depends on these packages at runtime and reproduces their license texts and
attribution notices below. The file is generated by \`scripts/third-party-licenses.ts\`; do not edit it
by hand.`;
  const sections = entries.map((entry) =>
    [
      `## ${entry.name} - ${entry.version} (${entry.license})`,
      ...(entry.licenseText === '' ? [] : [fencedText(entry.licenseText)]),
      ...entry.attributions.map(({ file, text }) => `### ${file}\n\n${fencedText(text)}`),
    ].join('\n\n'),
  );
  return `${header}${sections.length === 0 ? '' : `\n\n${sections.join('\n\n')}`}\n`;
};

const main = (): void => {
  const packageJson: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
  const packageName =
    typeof packageJson === 'object' &&
    packageJson !== null &&
    'name' in packageJson &&
    typeof packageJson.name === 'string'
      ? packageJson.name
      : 'This package';
  const notice = renderNotice(packageName, collectEntries(readReport()));

  if (!process.argv.includes('--check')) {
    writeFileSync(OUTPUT, notice);
    return;
  }
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : undefined;
  if (current !== notice) {
    throw new Error(
      `${OUTPUT} is ${current === undefined ? 'missing' : 'stale'}: run \`pnpm third-party:licenses\` and commit it`,
    );
  }
};

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
