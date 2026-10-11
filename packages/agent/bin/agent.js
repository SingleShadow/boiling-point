#!/usr/bin/env node
/**
 * 沸点创意 · 内容情报 Agent 命令行
 *
 *   agent run       执行一次完整值守（感知→规划→执行→质检→修复→记忆→简报）
 *   agent plan      只感知与规划，打印思考过程
 *   agent status    查看最近一次值守状态与 KPI
 *   agent brief     打印当日 CEO 简报
 *   agent backfill  回溯补齐最近 N 天
 *   agent memory    查看长期记忆
 *   agent findings  查看问题与洞察
 *   agent loop      守护模式常驻（默认每 30 分钟检查一次，09:00 后自动值守）
 */
import { getDb } from '../../core/src/store/db.js';
import { toDateKey, shiftDateKey } from '../../core/src/utils/date.js';
import { loadEnv } from '../../core/src/env.js';

loadEnv();
import { runDaily } from '../../core/src/pipeline.js';
import {
  runAgent, planOnly, getSnapshot, startDaemon,
  listMemory, listFindings, getAgentStats, ensureAgentSchema,
} from '../src/agent.js';

const argv = process.argv.slice(2);
const cmd = argv[0] || 'run';

function parseFlags(list) {
  const o = {};
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    o[k] = v === undefined ? (list[i + 1] && !list[i + 1].startsWith('--') ? list[++i] : true) : v;
  }
  return o;
}
const flags = parseFlags(argv.slice(1));

const db = getDb(process.env.BOILING_DB);
ensureAgentSchema(db);

const line = (s = '') => console.log(s);

async function main() {
  switch (cmd) {
    case 'run': {
      const r = await runAgent({
        db,
        dateKey: flags.date,
        force: flags.force === true || flags.force === '1',
        mode: flags.mode,
        metric: flags.metric,
        limit: Number(flags.limit || 10),
      });
      line();
      line(`  值守完成 · ${r.dateKey}　状态 ${r.brief.statusLabel}　健康分 ${r.healthScore}（${r.grade}）`);
      line(`  数据源 ${r.source}　样本 ${r.qa.metrics.sampleSize} 条　耗时 ${(r.durationMs / 1000).toFixed(1)}s${r.repaired ? '（含修复跑）' : ''}`);
      line();
      line('  决策依据：');
      for (const x of r.plan.rationale) line(`    - ${x}`);
      line();
      line('  执行动作：');
      for (const a of r.actions) line(`    ${a.ok === false ? '×' : '✓'} ${a.type}｜${a.summary}${a.ms ? `（${a.ms}ms）` : ''}`);
      line();
      if (r.qa.issues.length) {
        line('  质检问题：');
        for (const i of r.qa.issues) line(`    ! [${i.severity}] ${i.label}：${i.message}`);
      } else {
        line('  质检问题：无（全部检查项通过）');
      }
      line();
      return;
    }

    case 'plan': {
      const { observation, plan } = await planOnly({ db, dateKey: flags.date, limit: Number(flags.limit || 10) });
      line();
      line(`  Agent 计划 · ${observation.dateKey}`);
      line();
      line('  观测：');
      line(`    今日报告：${observation.today.hasReport ? `已存在（${observation.today.ageHours}h 前）` : '缺失'}`);
      line(`    真实数据源：${observation.live.ok ? `可用（${observation.live.ms}ms / ${observation.live.count} 条）` : `不可用（${observation.live.detail}）`}`);
      line(`    历史缺口：${observation.gaps.length ? observation.gaps.join('、') : '无'}`);
      line(`    近 7 日题材：${observation.topicHistory.map((t) => t.topic).join(' → ') || '—'}`);
      line();
      line('  决策：');
      for (const x of plan.rationale) line(`    - ${x}`);
      line();
      line('  动作序列：');
      plan.actions.forEach((a, i) => line(`    ${i + 1}. [${a.type}] ${a.reason || a.title || ''}`));
      line();
      return;
    }

    case 'status': {
      const s = getSnapshot(db, { dateKey: flags.date });
      const st = s.stats;
      line();
      line(`  Agent 状态 · ${s.dateKey}`);
      line(`  值守次数 ${st.total}　成功率 ${st.successRate}%　平均健康分 ${st.avgHealthScore}　记忆 ${st.memoryCount} 条　待处理问题 ${st.openIssues}`);
      if (s.today) {
        line(`  今日：${s.today.status}　健康分 ${s.today.healthScore}（${s.today.grade}）　数据源 ${s.today.source}　样本 ${s.today.sampleSize}`);
        line(`  ${s.today.message}`);
      } else {
        line('  今日：尚未值守');
      }
      if (st.recent.length) {
        line();
        line('  近 7 次健康分：' + st.recent.map((r) => `${r.date_key.slice(5)}:${r.health_score}`).join('  '));
      }
      line();
      return;
    }

    case 'brief': {
      const s = getSnapshot(db, { dateKey: flags.date });
      if (!s.today) {
        line('  今日尚无值守记录，请先执行 `agent run`');
        return;
      }
      line();
      line(s.today.brief?.markdown || JSON.stringify(s.today.brief, null, 2));
      line();
      return;
    }

    case 'backfill': {
      const days = Number(flags.days || 7);
      line();
      line(`  回溯补齐最近 ${days} 天…`);
      for (let i = days - 1; i >= 0; i--) {
        const d = shiftDateKey(toDateKey(), -i);
        const r = await runDaily({ db, dateKey: d, limit: Number(flags.limit || 10), metric: flags.metric || 'play', mode: flags.mode || 'simulated' });
        line(`    ${d} → ${r.entries.length} 条，主导题材 ${r.report.audienceInsight.topTopics[0]?.name || '—'}`);
      }
      line();
      line('  补齐后建议执行 `agent run --force` 重新值守今日');
      line();
      return;
    }

    case 'memory': {
      const mem = listMemory(db, flags.category);
      line();
      line(`  长期记忆（${mem.length} 条）`);
      for (const m of mem) {
        line(`    [${m.category}] ${m.key} = ${JSON.stringify(m.value)}  (置信度 ${m.confidence} · 命中 ${m.hits} 次)`);
      }
      line();
      return;
    }

    case 'findings': {
      const f = listFindings(db, { limit: Number(flags.limit || 20) });
      line();
      line(`  问题与洞察（${f.length} 条）`);
      for (const x of f) line(`    [${x.severity}] ${x.dateKey} ${x.title}${x.detail ? ` — ${x.detail}` : ''}`);
      line();
      return;
    }

    case 'loop': {
      const intervalMin = Number(flags.interval || 30);
      const hour = Number(flags.hour ?? 9);
      line();
      line(`  Agent 守护模式启动：每 ${intervalMin} 分钟检查一次，${hour}:00 后自动值守当天`);
      line('  Ctrl+C 退出');
      line();
      await startDaemon({ db, intervalMs: intervalMin * 60 * 1000, hour, limit: Number(flags.limit || 10) });
      return;
    }

    default:
      line();
      line('  用法：agent <run|plan|status|brief|backfill|memory|findings|loop> [--date=YYYY-MM-DD] [--force] [--mode] [--limit] [--days]');
      line();
  }
}

main().catch((e) => {
  console.error(`[agent] 执行失败：${e.message}`);
  process.exit(1);
});
