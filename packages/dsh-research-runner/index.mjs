import path from 'node:path';
import { defaultSettings, ResearchRunner } from './runner.mjs';

export const name = 'dsh-research-runner';
export const inject = ['commands', 'tools'];

function summary(run) {
  if (Array.isArray(run)) return run.length ? run.map((item) => `${item.id}  ${item.status}  ${item.completed.length}/3`).join('\n') : '当前会话还没有科研任务。';
  return [
    `科研任务 ${run.id}`,
    `状态 ${run.status}，已提交 ${run.completed.length}/3 阶段${run.next ? `，下一阶段 ${run.next}` : ''}`,
    `产物目录 ${run.directory}`,
    ...(run.status === 'complete' ? [`复现图 ${path.join(run.directory, 'analysis', 'figure.png')}`, `误差说明 ${path.join(run.directory, 'review', 'report.md')}`] : []),
    ...(run.error ? [run.error] : []),
  ].join('\n');
}

export function apply(ctx, config = {}) {
  const runner = new ResearchRunner({ ...defaultSettings(), ...config, logger: ctx.logger });
  ctx.effect(() => () => runner.dispose(), 'research-runner: lifecycle');

  const invoke = async (session, action, id, prepareOnly = false) => {
    switch (action) {
      case 'start': return runner.start(session, { prepareOnly });
      case 'status': return runner.status(session, id);
      case 'list': return runner.list(session);
      case 'pause': return runner.pause(session, id);
      case 'resume': return runner.resume(session, id);
      default: throw new Error('用法：/research start | status [ID] | list | pause [ID] | resume [ID]');
    }
  };

  ctx.effect(() => ctx.commands.register({
    definitionId: 'local/dsh-research-runner',
    name: 'research',
    description: '自动科研：运行和恢复公开论文图表复现任务',
    input: { hint: 'start | status | list | pause | resume' },
    async handler({ agent, rawInput }) {
      const [action, option, ...extra] = rawInput.trim().split(/\s+/);
      try {
        if (!action || extra.length || (['start', 'list'].includes(action) && option && !(action === 'start' && option === '--prepare-only'))) {
          throw new Error('用法：/research start | status [ID] | list | pause [ID] | resume [ID]');
        }
        return { kind: 'success', text: summary(await invoke(agent.session.id, action, option, option === '--prepare-only')) };
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : String(error) };
      }
    },
  }), 'research-runner: slash command');

  ctx.effect(() => ctx.tools.register({
    name: 'research_run',
    description: '在当前会话运行、检查、暂停或恢复 Bosoni 等人论文图 3 的复现。运行在后台，状态和产物在重启后仍然保留。',
    parameters: {
      type: 'object', additionalProperties: false, required: ['action'],
      properties: {
        action: { type: 'string', enum: ['start', 'status', 'list', 'pause', 'resume'] },
        id: { type: 'string', description: '任务 ID。缺省时选当前会话最近一项。' },
      },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, { agent, signal }) {
      signal.throwIfAborted();
      if (!agent || agent.session.header.parentSession !== undefined) throw new Error('请在主会话操作科研任务。');
      return summary(await invoke(agent.session.id, args?.action, args?.id));
    },
  }), 'research-runner: model tool');
}
