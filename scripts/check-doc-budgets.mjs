import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

try {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8'
  }).split('\0').filter(Boolean);
  const budgets = new Map([
    ['AGENTS.md', 100],
    ['docs/axioms.md', 10],
    ['docs/governance.md', 80],
    ['docs/status.md', 60]
  ]);
  for (const file of files) {
    if (file.endsWith('/AGENTS.md')) budgets.set(file, 40);
    if (/^docs\/decisions\/[^/]+\.md$/.test(file)) budgets.set(file, 40);
  }

  let violations = 0;
  for (const [file, limit] of budgets) {
    try {
      const content = await readFile(path.join(root, file), 'utf8');
      const lines = content === '' ? [] : content.replace(/\r\n?/g, '\n').split('\n');
      if (lines.at(-1) === '') lines.pop();
      const numbered = file === 'docs/axioms.md';
      const actual = numbered ? lines.filter((line) => /^\s*\d+\.\s/.test(line)).length : lines.length;
      if (actual > limit) {
        console.error(`${file}: ${actual} ${numbered ? 'numbered ' : ''}lines exceeds budget ${limit} (over by ${actual - limit}).`);
        violations++;
      }
    } catch (error) {
      console.error(`${file}: cannot check budget: ${error.message}`);
      violations++;
    }
  }
  if (violations > 0) {
    process.exitCode = 1;
  } else {
    console.log(`Documentation budgets passed (${budgets.size} files).`);
  }
} catch (error) {
  console.error(`Documentation budget check failed: ${error.message}`);
  process.exitCode = 1;
}
