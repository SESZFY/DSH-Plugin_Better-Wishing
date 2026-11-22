#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const modes = new Set(['quick', 'solo', 'delegate', 'cluster']);
const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');

function read(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) ?? {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  try {
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function modelRoute(value, flag) {
  if (value === 'follow') return null;
  const separator = value.indexOf('/');
  const provider = value.slice(0, separator).trim();
  const model = value.slice(separator + 1).trim();
  if (separator < 1 || !provider || !model || provider.length > 250 || model.length > 250) {
    throw new Error(`${flag} 需要 provider/model 或 follow。`);
  }
  return { provider, model };
}

function main() {
  const { values } = parseArgs({ options: {
    session: { type: 'string' }, mode: { type: 'string' }, delegate: { type: 'string' }, cluster: { type: 'string' },
    show: { type: 'boolean' }, reset: { type: 'boolean' }, file: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log(`用法: dsh-ai4s-mode [--session <会话 ID>] [选项]
  --show                      显示当前偏好
  --mode <quick|solo|delegate|cluster>
  --delegate <provider/model|follow>
  --cluster <provider/model|follow>
  --reset                     恢复默认值
  --file                      打印偏好文件路径
  不传 --session 时管理显式默认值。`);
    return;
  }
  const session = values.session;
  if (session !== undefined && (!session || session.trim() !== session || session.length > 256)) throw new Error('需要有效的会话 ID。');
  const defaultFile = path.join(dshHome, 'clawsgo-composer.json');
  const file = session ? path.join(dshHome, 'clawsgo-composer-sessions', `${createHash('sha256').update(session).digest('hex')}.json`) : defaultFile;
  if (values.file) return console.log(file);
  if (values.mode !== undefined && !modes.has(values.mode)) throw new Error(`--mode 只接受 ${[...modes].join(' / ')}。`);

  const defaults = read(defaultFile);
  const baseline = { mode: modes.has(defaults.defaultMode) ? defaults.defaultMode : 'solo', models: {
    delegate: defaults.models?.delegate ?? null, cluster: defaults.models?.cluster ?? null,
  } };
  const saved = session ? read(file) : {};
  const state = values.reset && !session ? { mode: 'solo', models: { delegate: null, cluster: null } } : {
    mode: !values.reset && modes.has(saved.mode) ? saved.mode : baseline.mode,
    models: { ...baseline.models, ...(values.reset ? {} : saved.models) },
  };
  if (values.mode !== undefined) state.mode = values.mode;
  for (const mode of ['delegate', 'cluster']) {
    if (values[mode] !== undefined) state.models[mode] = modelRoute(values[mode], `--${mode}`);
  }
  const hasOverrides = ['mode', 'delegate', 'cluster'].some((key) => values[key] !== undefined);
  if (values.reset || hasOverrides) {
    if (session && values.reset && !hasOverrides) {
      fs.rmSync(file, { force: true });
    } else {
      write(file, session ? state : { defaultMode: state.mode, models: state.models });
    }
  }
  console.log(JSON.stringify(state, null, 2));
}

try { main(); } catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
