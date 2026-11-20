#!/usr/bin/env node
// dsh-ai4s-mode — 在无 GUI 的情况下读写「全自动 AI4S 模式」偏好。
//
// 偏好文件与插件本体共用同一个位置：
//   <DSH_HOME>/clawsgo-composer.json   （DSH_HOME 缺省为 ~/.dsh）
// 写入发生在 DSH 未运行或重启之后生效；运行中也可以用它改，但下次挂载才读盘。
//
// 用法：
//   dsh-ai4s-mode --show
//   dsh-ai4s-mode --mode cluster
//   dsh-ai4s-mode --mode delegate --delegate openrouter/deepseek-v3.2
//   dsh-ai4s-mode --mode cluster  --cluster  openrouter/deepseek-v3.2 --delegate openrouter/deepseek-v3.2
//   dsh-ai4s-mode --reset
//
// 退出码：0 成功；1 参数/文件错误。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const MODES = new Set(['quick', 'solo', 'delegate', 'cluster']);
const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const FILE = path.join(HOME, 'clawsgo-composer.json');

function usage(code = 0) {
  const text = `用法: dsh-ai4s-mode [选项]

  --show                      打印当前偏好（默认动作）
  --mode <quick|solo|delegate|cluster>
  --delegate <provider/model> 主从模式的子代理模型
  --cluster  <provider/model> 集群模式的子代理模型
  --reset                     恢复为 solo 且清空模型偏好
  --file                      打印偏好文件路径
  -h, --help                  显示本帮助

偏好文件: ${FILE}`;
  (code ? console.error : console.log)(text);
  process.exit(code);
}

function parseRoute(raw, flag) {
  const value = String(raw ?? '').trim();
  const index = value.indexOf('/');
  if (index <= 0 || index === value.length - 1) {
    console.error(`${flag} 需要 provider/model 形式，收到 "${value}"。`);
    process.exit(1);
  }
  const provider = value.slice(0, index).trim();
  const model = value.slice(index + 1).trim();
  if (!provider || !model) {
    console.error(`${flag} 的 provider 与 model 都不能为空。`);
    process.exit(1);
  }
  return { provider, model };
}

function read() {
  try {
    const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return {
      initialized: MODES.has(saved.mode),
      mode: MODES.has(saved.mode) ? saved.mode : 'solo',
      models: { delegate: saved.models?.delegate ?? null, cluster: saved.models?.cluster ?? null },
    };
  } catch {
    return { initialized: false, mode: 'solo', models: { delegate: null, cluster: null } };
  }
}

function write(value) {
  fs.mkdirSync(HOME, { recursive: true });
  const temporary = `${FILE}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  try {
    fs.renameSync(temporary, FILE);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

const argv = process.argv.slice(2);
if (!argv.length) argv.push('--show');

let state = read();
let dirty = false;

for (let i = 0; i < argv.length; i += 1) {
  const flag = argv[i];
  switch (flag) {
    case '-h': case '--help':
      usage(0);
      break;
    case '--file':
      console.log(FILE);
      process.exit(0);
      break;
    case '--show':
      break;
    case '--mode': {
      const mode = argv[++i];
      if (!MODES.has(mode)) {
        console.error(`--mode 只接受 ${[...MODES].join(' / ')}，收到 "${mode}"。`);
        process.exit(1);
      }
      state.mode = mode;
      state.initialized = true;
      dirty = true;
      break;
    }
    case '--delegate':
      state.models.delegate = parseRoute(argv[++i], '--delegate');
      dirty = true;
      break;
    case '--cluster':
      state.models.cluster = parseRoute(argv[++i], '--cluster');
      dirty = true;
      break;
    case '--reset':
      state = { initialized: false, mode: 'solo', models: { delegate: null, cluster: null } };
      dirty = true;
      break;
    default:
      console.error(`不认识的参数: ${flag}`);
      usage(1);
  }
}

if (dirty) {
  write(state);
  console.log(`已写入 ${FILE}`);
}

console.log(JSON.stringify(state, null, 2));
