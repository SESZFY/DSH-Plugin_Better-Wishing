#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';
import vm from 'node:vm';

const packageName = '@deepseek-ai/dsh-client-ui-model-selection';
const recipe = JSON.parse(fs.readFileSync(new URL('./model-menu-edits.json', import.meta.url), 'utf8'));
const matches = (hashes, source) => hashes.includes(createHash('sha256').update(source).digest('hex'));

function locateClient({ client, root }) {
  if (client) return path.resolve(client);
  const base = path.resolve(root ?? process.env.DSH_APP_DIR ?? '.');
  for (const directory of [base, path.join(base, 'resources', 'app', 'dsh')]) {
    const require = createRequire(path.join(directory, 'package.json'));
    try { return require.resolve(`${packageName}/client`); } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error('Model selector path not found. Specify --root <DSH installation> or --client <path to lib/client.js>.');
}

function applyRecipe(source) {
  const prefix = /^\s*"menu": "(\w+)_menu",$/m.exec(source)?.[1];
  assert.ok(prefix, 'Missing DSH menu CSS class');
  const expand = (line) => line.replaceAll('__MENU_CSS__', prefix);
  const lines = source.split('\n');
  const cssIndex = recipe.cssLine - 1;
  assert.ok(lines[cssIndex].startsWith('\t\tconst css = "') && lines[cssIndex].endsWith('";'));
  lines[cssIndex] = `${lines[cssIndex].slice(0, -2)}${expand(recipe.cssSuffix)}";`;
  for (const { line, remove, insert } of recipe.edits.toReversed()) {
    lines.splice(line - 1, remove, ...insert.map(expand));
  }
  return lines.join('\n');
}

function main() {
  const { values } = parseArgs({ options: {
    client: { type: 'string' }, root: { type: 'string' }, check: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('Usage: dsh-ai4s-menu [--root <DSH installation> | --client <lib/client.js>] [--check]');
    return;
  }
  const file = fs.realpathSync(locateClient(values));
  const pkg = JSON.parse(fs.readFileSync(path.resolve(file, '../../package.json'), 'utf8'));
  if (pkg.name !== packageName || pkg.version !== recipe.version) {
    throw new Error(`This menu patch supports ${packageName}@${recipe.version}. Found ${pkg.name}@${pkg.version}.`);
  }
  const original = fs.readFileSync(file, 'utf8');
  const source = original.replaceAll('\r\n', '\n').replace(/\n+$/, '');
  if (matches(recipe.patchedHashes, source)) {
    console.log(`AI4S session menu is already installed: ${file}`);
    return;
  }
  if (!matches(recipe.sourceHashes, source)) throw new Error(`Unrecognized model selector build: ${file}`);
  const patched = applyRecipe(source);
  assert.ok(matches(recipe.patchedHashes, patched), 'The patched menu did not match the expected build');
  new vm.Script(patched, { filename: file });
  if (values.check) {
    console.log(`Compatible model selector: ${file}`);
    return;
  }
  const backup = `${file}.bak-ai4s-session-menu`;
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const output = patched + (original.match(/(?:\r?\n)+$/)?.[0].replaceAll('\r\n', '\n') ?? '');
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  try {
    fs.writeFileSync(temporary, output.replaceAll('\n', newline), { flag: 'wx', mode: fs.statSync(file).mode });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  console.log(`Installed AI4S session menu: ${file}`);
  console.log(`Backup: ${backup}`);
}

try { main(); } catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
