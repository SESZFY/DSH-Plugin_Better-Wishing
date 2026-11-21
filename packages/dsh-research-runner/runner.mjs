import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const runFile = promisify(execFile);
const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const stages = ['inputs', 'analysis', 'review'];
const inputNames = ['Er-diamond-EOS-data.json', 'reproduce.py', 'LICENSE-upstream.txt', 'source.json'];
const analysisNames = ['figure.png', 'curves.csv', 'metrics.json', 'execution.log'];
const now = () => new Date().toISOString();
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

function processIsAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}

function checkpoint(directory, files) {
  return Object.fromEntries(files.map((name) => [name, hash(path.join(directory, name))]));
}

function verifyCheckpoint(directory) {
  const expected = readJson(path.join(directory, 'checkpoint.json'));
  if (!Object.keys(expected).length || Object.entries(expected).some(([name, digest]) => {
    return path.basename(name) !== name || hash(path.join(directory, name)) !== digest;
  })) throw new Error(`检查点损坏：${path.basename(directory)}`);
  return expected;
}

function audit(runDir, destination) {
  const input = path.join(runDir, 'inputs');
  const analysis = path.join(runDir, 'analysis');
  const inputHashes = verifyCheckpoint(input);
  const analysisHashes = verifyCheckpoint(analysis);
  const sources = readJson(path.join(input, 'source.json'));
  const metrics = readJson(path.join(analysis, 'metrics.json'));
  if (metrics.curves.length !== 12 || metrics.grid_points_per_curve !== 1000) throw new Error('图 3 曲线数或采样数不符合复现方案。');
  const maxError = Math.max(...metrics.curves.map((curve) => curve.max_curve_error_eV_per_atom));
  const unmatched = [];
  const matched = [];
  for (const curve of metrics.curves) {
    for (const [index, value] of curve.minima_A3_per_atom.entries()) {
      const reference = curve.reference_minima_A3_per_atom[index];
      if (value === null && reference === null) continue;
      if (value === null || reference === null) {
        unmatched.push({ smearing: curve.kind, width_meV: curve.width_meV, window: index === 0 ? 'low-volume' : 'high-volume', stationary_point_A3: value, original_marker_A3: reference });
      } else {
        matched.push(Math.abs(value - reference));
      }
    }
  }
  const maxMinimaError = Math.max(...matched);
  const curveTolerance = 1e-8;
  const markerTolerance = 2e-4;
  if (!Number.isFinite(maxError) || maxError > curveTolerance || !Number.isFinite(maxMinimaError) || maxMinimaError > markerTolerance) {
    throw new Error('曲线或共同极小值超出误差容限，请检查 metrics.json。');
  }
  writeJson(path.join(destination, 'verification.json'), {
    classification: 'published-data-figure-reproduction', curves: 12, samples: 12000,
    curveTolerance_eV_per_atom: curveTolerance, maxCurveError_eV_per_atom: maxError,
    markerTolerance_A3_per_atom: markerTolerance, maxSharedMarkerDifference_A3_per_atom: maxMinimaError,
    matchedMarkers: matched.length, unmatchedMarkers: unmatched, environment: metrics.environment,
    inputSha256: inputHashes, analysisSha256: analysisHashes, sources,
  });
  fs.writeFileSync(path.join(destination, 'report.md'), `# Er 金刚石结构状态方程复现\n\n`
    + `复现目标是 Bosoni 等人论文图 3 的 12 条自由能曲线。输入是作者发布的 Quantum ESPRESSO 自由能与体积样本。本次重新计算样条、归零、绘图和误差，原始 DFT 计算未重跑。\n\n`
    + `每条曲线独立用 CubicSpline 重建，并与按作者脚本方法生成的 interp1d 曲线比较。12,000 个采样点的最大绝对差为 **${maxError.toExponential(3)} eV/atom**，容限为 ${curveTolerance.toExponential(0)} eV/atom。${matched.length} 个共同找到的极小值，体积最大差为 **${maxMinimaError.toExponential(3)} Å³/atom**。图中的叉号沿用作者脚本的标记规则。\n\n`
    + unmatched.map((point) => `- ${point.smearing}、${point.width_meV} meV、${point.window} 区间。样条导数法得到 ${point.stationary_point_A3?.toFixed(5) ?? '无'} Å³/atom，原脚本优化器得到 ${point.original_marker_A3?.toFixed(5) ?? '无标记'}。`).join('\n')
    + `\n\n[论文](${sources.paper}) · [公开数据记录](${sources.archive}) · [作者绘图脚本](${sources.original_plot_script})\n`, 'utf8');
}

export class ResearchRunner {
  constructor({ root, python, logger = console }) {
    this.root = path.resolve(root);
    this.python = python;
    this.logger = logger;
    this.active = new Map();
    fs.mkdirSync(this.root, { recursive: true });
    this.db = new DatabaseSync(path.join(this.root, 'runs.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY, session TEXT NOT NULL, status TEXT NOT NULL, stage INTEGER NOT NULL,
        owner INTEGER, updated TEXT NOT NULL, error TEXT
      );`);
  }

  start(session, { prepareOnly = false } = {}) {
    const id = randomUUID();
    fs.mkdirSync(path.join(this.root, id));
    this.db.prepare(`INSERT INTO runs (id, session, status, stage, updated) VALUES (?, ?, 'paused', 0, ?)`).run(id, session, now());
    return this.resume(session, id, { prepareOnly });
  }

  list(session) {
    return this.db.prepare('SELECT id FROM runs WHERE session=? ORDER BY updated DESC LIMIT 10').all(session).map(({ id }) => this.status(session, id));
  }

  row(session, id) {
    if (id !== undefined && !/^[a-f\d-]{36}$/i.test(id)) throw new Error('任务 ID 格式无效。');
    const row = id === undefined
      ? this.db.prepare('SELECT * FROM runs WHERE session=? ORDER BY updated DESC LIMIT 1').get(session)
      : this.db.prepare('SELECT * FROM runs WHERE session=? AND id=?').get(session, id);
    if (!row) throw new Error('当前会话没有这项科研任务。');
    return row;
  }

  status(session, id) {
    const row = this.row(session, id);
    const stale = row.status === 'running' && row.owner && !processIsAlive(row.owner);
    return {
      id: row.id, status: stale ? 'interrupted' : row.status, completed: stages.slice(0, row.stage),
      next: stages[row.stage] ?? null, directory: path.join(this.root, row.id), error: row.error,
    };
  }

  resume(session, id, { prepareOnly = false } = {}) {
    this.db.exec('BEGIN IMMEDIATE');
    let row;
    try {
      row = this.row(session, id);
      if (row.status !== 'complete' && !(row.status === 'running' && row.owner && processIsAlive(row.owner))) {
        this.db.prepare(`UPDATE runs SET status='running', owner=?, updated=?, error=NULL WHERE id=?`).run(process.pid, now(), row.id);
      } else {
        this.db.exec('COMMIT');
        return this.status(session, row.id);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    const controller = new AbortController();
    const done = Promise.resolve().then(() => this.execute(row, controller.signal, prepareOnly));
    this.active.set(row.id, { controller, done });
    done.catch((error) => this.logger.error(`research-runner: ${String(error)}`)).finally(() => this.active.delete(row.id));
    return this.status(session, row.id);
  }

  async pause(session, id) {
    const row = this.row(session, id);
    const work = this.active.get(row.id);
    if (work) {
      work.controller.abort();
      await work.done;
    } else if (row.status === 'running' && row.owner && processIsAlive(row.owner)) {
      throw new Error('任务在另一个 DSH 进程中运行，请从原窗口暂停。');
    }
    return this.status(session, row.id);
  }

  async execute(row, signal, prepareOnly) {
    const runDir = path.join(this.root, row.id);
    const log = (event, data = {}) => fs.appendFileSync(path.join(runDir, 'run.log.jsonl'), `${JSON.stringify({ time: now(), event, ...data })}\n`);
    let status = 'paused';
    let errorMessage = null;
    try {
      log('claimed', { pid: process.pid, nextStage: stages[row.stage] });
      for (let index = row.stage; index < stages.length; index++) {
        signal.throwIfAborted();
        if (prepareOnly && index > 0) break;
        const stage = stages[index];
        const directory = path.join(runDir, stage);
        if (fs.existsSync(directory)) {
          verifyCheckpoint(directory);
          log('recovered-checkpoint', { stage });
        } else {
          const temporary = fs.mkdtempSync(path.join(runDir, `.attempt-${stage}-`));
          log('stage-start', { stage });
          const files = await this.runStage(stage, runDir, temporary, signal);
          signal.throwIfAborted();
          writeJson(path.join(temporary, 'checkpoint.json'), checkpoint(temporary, files));
          fs.renameSync(temporary, directory);
        }
        this.db.prepare('UPDATE runs SET stage=?, updated=? WHERE id=? AND owner=?').run(index + 1, now(), row.id, process.pid);
        log('stage-committed', { stage });
        if (index === stages.length - 1) status = 'complete';
      }
    } catch (error) {
      if (!signal.aborted) {
        status = 'failed';
        errorMessage = error instanceof Error ? error.message : String(error);
      }
    } finally {
      this.db.prepare('UPDATE runs SET status=?, owner=NULL, updated=?, error=? WHERE id=? AND owner=?').run(status, now(), errorMessage, row.id, process.pid);
      log(status, { error: errorMessage });
    }
  }

  async runStage(stage, runDir, destination, signal) {
    if (stage === 'inputs') {
      for (const name of inputNames) fs.copyFileSync(path.join(pluginDir, name), path.join(destination, name));
      const source = readJson(path.join(destination, 'source.json'));
      if (hash(path.join(destination, inputNames[0])) !== source.data_sha256) throw new Error('论文数据的 SHA256 校验失败。');
      return inputNames;
    }
    if (stage === 'analysis') {
      const inputs = path.join(runDir, 'inputs');
      verifyCheckpoint(inputs);
      const args = ['-I', '-B', path.join(inputs, 'reproduce.py'), path.join(inputs, inputNames[0]), destination];
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(SYSTEMROOT|WINDIR|PATH|TEMP|TMP|USERPROFILE|LOCALAPPDATA|LANG)$/i.test(key)));
      env.MPLCONFIGDIR = path.join(runDir, '.matplotlib');
      env.PYTHONIOENCODING = 'utf-8';
      const log = path.join(destination, 'execution.log');
      fs.writeFileSync(log, `${JSON.stringify([this.python, ...args])}\n`, 'utf8');
      try {
        const result = await runFile(this.python, args, { cwd: destination, env, signal, timeout: 120_000, windowsHide: true, encoding: 'utf8' });
        fs.appendFileSync(log, result.stdout + result.stderr);
      } catch (error) {
        fs.appendFileSync(log, `${error.stdout ?? ''}${error.stderr ?? ''}\n${String(error)}\n`);
        throw new Error(`计算未完成，详细日志在 ${log}`, { cause: error });
      }
      return analysisNames;
    }
    audit(runDir, destination);
    return ['report.md', 'verification.json'];
  }

  async dispose() {
    const work = [...this.active.values()];
    for (const { controller } of work) controller.abort();
    await Promise.allSettled(work.map(({ done }) => done));
    this.db.close();
  }
}

export function defaultSettings() {
  return {
    root: path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'research-runs'),
    python: process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'Python', 'Python310', 'python.exe')
      : 'python3',
  };
}
