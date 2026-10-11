/**
 * Agent 规划层 —— 把观测结果翻译成一串"带理由的动作"。
 *
 * 设计原则：每一步都必须能回答"为什么这么做"。
 * 计划是 Agent 的思考痕迹，会被完整记录并展示在控制台上。
 */

const SEV = { info: 'info', warn: 'warn', error: 'error', critical: 'critical' };

/**
 * @returns {{actions: Array, rationale: string[], mode: string, metric: string}}
 */
export function planActions(obs, opts = {}) {
  const actions = [];
  const rationale = [];
  const dateKey = opts.dateKey || obs.dateKey;
  const force = Boolean(opts.force);
  const limit = opts.limit || obs.limit || 10;
  const metric = opts.metric || obs.metric || 'play';

  /* --- 决策 1：数据源模式 --- */
  let mode = opts.mode;
  if (!mode) {
    if (obs.live.ok) {
      mode = 'auto';
      rationale.push(`真实数据源可用（${obs.live.ms}ms 返回 ${obs.live.count} 条），今日走真实优先通道`);
    } else if (obs.live.available) {
      mode = 'auto';
      rationale.push(`已配置真实数据源但本次探测失败（${obs.live.detail}），仍走 auto 由内核自动降级`);
    } else {
      mode = 'simulated';
      rationale.push('未配置真实数据源凭据，今日使用仿真引擎（报告将标注「演示数据」）');
      actions.push({
        type: 'alert',
        severity: SEV.warn,
        category: 'data-source',
        title: '真实数据源未接通',
        detail: '缺少 DOUYIN_API_KEY / DOUYIN_API_BASE，当前输出为仿真数据，趋势结论不可用于商业决策',
      });
    }
  } else {
    rationale.push(`外部指定数据模式：${mode}`);
  }

  /* --- 决策 2：今天要不要跑 --- */
  if (obs.today.hasReport && !force) {
    rationale.push(`今日报告已存在（生成于 ${obs.today.ageHours} 小时前），本轮只做复检，不重复抓取`);
    actions.push({ type: 'verify', dateKey, reason: '已有报告，进入复检' });
  } else {
    if (force && obs.today.hasReport) {
      rationale.push('收到强制刷新指令，今日重新抓取并覆盖');
    } else {
      rationale.push('今日无报告，执行抓取-拆解-出报全流程');
    }
    actions.push({
      type: 'run_daily',
      dateKey,
      mode,
      metric,
      limit,
      retries: 2,
      backoffMs: 800,
      reason: force ? '强制刷新今日数据' : '补齐今日数据',
    });
  }

  /* --- 决策 3：历史缺口补齐（一次最多 3 天，避免长任务阻塞） --- */
  if (obs.gaps.length) {
    const take = obs.gaps.slice(-3);
    rationale.push(`检测到历史缺口 ${obs.gaps.length} 天，本轮补齐最近 ${take.length} 天：${take.join('、')}`);
    for (const d of take) {
      actions.push({ type: 'backfill_gap', dateKey: d, mode, metric, limit, reason: '补齐历史数据缺口，保证趋势曲线连续' });
    }
    if (obs.gaps.length > 3) {
      actions.push({
        type: 'alert',
        severity: SEV.info,
        category: 'history',
        title: `仍有 ${obs.gaps.length - 3} 天缺口待补`,
        detail: `剩余缺口：${obs.gaps.slice(0, -3).join('、')}（下一轮继续）`,
      });
    }
  } else {
    rationale.push('近 7 天数据完整，无需回填');
  }

  /* --- 决策 4：题材僵化预警（连续多天同一题材主导 = 趋势信号失真） --- */
  const recentTopics = obs.topicHistory.map((t) => t.topic).filter(Boolean);
  if (recentTopics.length >= 3) {
    const last3 = recentTopics.slice(-3);
    if (last3.every((t) => t === last3[0])) {
      actions.push({
        type: 'alert',
        severity: SEV.warn,
        category: 'trend',
        title: `题材信号僵化：连续 3 天「${last3[0]}」主导`,
        detail: '榜单题材缺乏波动，趋势结论参考价值下降，建议检查数据源样本量是否过小',
      });
      rationale.push('连续 3 天主导题材相同，已登记趋势僵化预警');
    }
  }

  /* --- 决策 5：数据源连续失败升级 --- */
  const failStreak = Number(obs.experience?.['source:douyin:consecutive_fail'] || 0);
  if (obs.live.available && !obs.live.ok && failStreak >= 3) {
    actions.push({
      type: 'alert',
      severity: SEV.error,
      category: 'data-source',
      title: `真实数据源连续 ${failStreak + 1} 天不可用`,
      detail: `最近一次失败原因：${obs.live.detail}。建议核查接口配额、签名或网络出口`,
    });
    rationale.push(`真实源已连续失败 ${failStreak + 1} 天，升级为 error 级告警`);
  }

  return { actions, rationale, mode, metric, limit, dateKey, createdAt: new Date().toISOString() };
}

/**
 * 质检不达标时的修复计划 —— 只做"真正可能变好"的动作，
 * 不做无意义的重跑（比如仿真模式下重跑，结果还是仿真）。
 */
export function planRepair(qa, obs, opts = {}) {
  const dateKey = opts.dateKey || obs.dateKey;
  const limit = opts.limit || obs.limit || 10;

  const codes = new Set(qa.issues.map((i) => i.code));
  const canImproveByRerun = ['sample_incomplete', 'diversity_low', 'dispersion_low', 'dimension_missing'];
  const hit = [...codes].find((c) => canImproveByRerun.includes(c));
  if (!hit) return null; // 数据源问题等，重跑不会更好

  if (!obs.live.ok) {
    // 仿真数据重跑只是换一批随机数，价值有限：改为换 metric 扩大候选池后重取
    return {
      actions: [{
        type: 'run_daily',
        dateKey,
        mode: 'simulated',
        metric: obs.metric === 'play' ? 'interaction' : 'play',
        limit: Math.min(limit + 5, 20),
        retries: 1,
        backoffMs: 500,
        reason: `质检未达标（${hit}）：切换排序指标并扩大候选池至 ${Math.min(limit + 5, 20)} 条后重取 TOP${limit}`,
      }],
      rationale: [`健康分 ${qa.score} 低于阈值，判定为样本质量问题，执行修复跑`],
    };
  }

  return {
    actions: [{
      type: 'run_daily',
      dateKey,
      mode: 'auto',
      metric: obs.metric,
      limit: Math.min(limit + 5, 20),
      retries: 1,
      backoffMs: 500,
      reason: `质检未达标（${hit}）：扩大候选池至 ${Math.min(limit + 5, 20)} 条重取`,
    }],
    rationale: [`健康分 ${qa.score} 低于阈值，真实源可用，扩大候选池重取`],
  };
}

export const REPAIR_THRESHOLD = 85;
