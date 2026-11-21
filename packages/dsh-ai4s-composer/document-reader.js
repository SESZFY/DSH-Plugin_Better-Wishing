import { spawn } from 'node:child_process';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOCUMENT_TOOL = 'read_document';
const python = fileURLToPath(new URL('./document-runtime/Scripts/python.exe', import.meta.url));
const parser = fileURLToPath(new URL('./document_reader.py', import.meta.url));
const tessdata = fileURLToPath(new URL('./document-runtime/tessdata/', import.meta.url));
const formats = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'xsl']);
const maxBytes = 64 * 1024 * 1024;

function parseDocument(bytes, options, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    // The OCR library opens its model files through narrow paths on Windows.
    const child = spawn(python, ['-I', '-B', parser, JSON.stringify(options)], {
      cwd: tessdata,
      env: { ...process.env, OMP_THREAD_LIMIT: '1' },
      windowsHide: true,
      signal,
    });
    let output = '';
    let diagnostic = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { diagnostic = (diagnostic + chunk).slice(-1500); });
    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE' && error.code !== 'ERR_STREAM_DESTROYED') reject(error);
    });
    child.once('error', (error) => reject(signal.aborted ? signal.reason : error));
    child.once('close', (code) => {
      if (signal.aborted) reject(signal.reason);
      else if (code === 0) resolve(output);
      else reject(new Error(diagnostic.trim() || `文档解析进程退出（${code}）。`));
    });
    child.stdin.end(bytes);
  });
}

export function registerDocumentReader(ctx) {
  return ctx.tools.register({
    name: DOCUMENT_TOOL,
    description: '只读提取本地或上传的 PDF、Word（.docx/.doc）和 Excel（.xlsx/.xls），也可读取 XSL 样式表的 XML 源文。PDF 按页读取并自动识别扫描页，Excel 按工作表和单元格读取。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['file_path'],
      properties: {
        file_path: { type: 'string', minLength: 1, description: '会话工作目录内的相对路径、绝对路径，或附件提供的已保存路径。' },
        start: { type: 'integer', minimum: 1, description: '从第几页、Word 文本块、Excel 行或 XSL 源码行开始。默认 1。' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: '读取数量。PDF 或 .doc 默认 3 页，单次最多 8 页。Word .docx 默认 40 块。Excel 默认 25 行。' },
        sheet: { type: 'string', minLength: 1, description: 'Excel 工作表名，默认第一张。' },
        column_start: { type: 'integer', minimum: 1, maximum: 16384, description: 'Excel 起始列，默认为 1（A 列）。' },
        column_limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Excel 本次读取多少列，默认 16。' },
        formulas: { type: 'boolean', description: '.xlsx 设为 true 读取公式，默认读取单元格值和已存在的计算缓存。' },
      },
    },
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: value }]; },
    },
    isConcurrencySafe: () => true,
    async execute({ file_path: filePath, ...options }, { agent, signal: callerSignal }) {
      const format = extname(filePath).slice(1).toLowerCase();
      if (!formats.has(format)) throw new Error('read_document 支持 PDF、DOCX、DOC、XLSX、XLS 和 XSL。普通纯文本请选择 read。');

      const signal = AbortSignal.any([callerSignal, AbortSignal.timeout(90_000)]);
      const cwd = agent && await ctx.workingDirectory.ensure(agent, signal);
      const target = await ctx.fs.resolve(filePath, { cwd, signal });
      const info = await ctx.fs.stat(target, signal);
      if (info?.type !== 'file') throw new Error(`找不到可读取的文件「${target.displayPath}」。`);
      if (info.size > maxBytes) throw new Error('文档超过 64 MiB 的单文件读取上限。');
      const bytes = await ctx.fs.readBytes(target, signal, maxBytes);

      if (format === 'doc') {
        const converter = ctx.get('officeToPdf');
        if (!converter) throw new Error('此 DSH 环境没有挂载旧版 Word 转换器。请将 .doc 另存为 .docx 后读取。');
        const converted = await converter.convert({
          extension: 'doc',
          priority: 'foreground',
          source: {
            key: ctx.fs.processPath(target),
            version: info.version,
            bytes: bytes.byteLength,
            read: async () => ({ bytes, version: info.version }),
          },
        }, signal);
        return parseDocument(converted.pdf, { ...options, format: 'pdf' }, signal);
      }
      return parseDocument(bytes, { ...options, format }, signal);
    },
  });
}
