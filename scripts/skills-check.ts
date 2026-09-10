/**
 * Checks that installed agent skills match the dependency versions in the repo.
 * Warns (exit 1 with --strict, else exit 0) when:
 *  - a mapped dep's installed major version differs from skills.versions.json checkedMajor
 *  - a mapped skill is missing from .claude/skills/
 *  - a dep in the map is no longer installed anywhere in the workspace
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const strict = process.argv.includes('--strict');

type Entry = {
  checkedMajor: number;
  skills: Array<string>;
  source: string | null;
};

const map = JSON.parse(readFileSync(path.join(root, 'skills.versions.json'), 'utf8')) as {
  deps: Record<string, Entry>;
};

const installedVersion = (dep: string): string | null => {
  try {
    const out = execSync(`pnpm why -r --json ${dep}`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const entries = JSON.parse(out) as Array<{ name: string; version?: string }>;
    return entries.find((entry) => entry.name === dep)?.version ?? null;
  } catch {
    return null;
  }
};

let warnings = 0;
const warn = (message: string) => {
  warnings += 1;
  process.stderr.write(`skills-check: ${message}\n`);
};

for (const [dep, entry] of Object.entries(map.deps)) {
  const version = installedVersion(dep);
  if (version == null) {
    warn(
      `'${dep}' is mapped in skills.versions.json but not installed — remove it or reinstall the dep.`,
    );
    continue;
  }
  const major = Number(version.split('.')[0]);
  if (entry.source == null) {
    continue;
  }
  if (major !== entry.checkedMajor) {
    warn(
      `'${dep}' is at v${version} but skills were last checked against major ${entry.checkedMajor} — run 'npx skills update', re-verify, and bump checkedMajor.`,
    );
  }
  for (const skill of entry.skills) {
    if (!existsSync(path.join(root, '.claude/skills', skill))) {
      warn(
        `skill '${skill}' for '${dep}' missing from .claude/skills — run 'npx skills add ${entry.source}'.`,
      );
    }
  }
}

if (warnings === 0) {
  process.stdout.write('skills-check: all mapped skills present and majors match.\n');
} else if (strict) {
  process.exit(1);
}
