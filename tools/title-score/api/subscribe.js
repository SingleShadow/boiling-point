/**
 * 标题体检工具 · 留资 serverless 函数（Vercel Node 运行时）
 *
 * 纯前端工具没有数据库，留资靠这里转发到你能接收的地方。
 * 三种接收方式按环境变量切换，都不用改代码：
 *   1) TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID  → 线索直接发到你的 Telegram（免费、即时，推荐）
 *   2) FORMSPREE_ID                           → 转发到 Formspree（免费 50 条/月，网页后台看）
 *   3) 都不配                                  → 仅 console.log（开发/自测用，不留痕）
 *
 * 部署：把这个 tools/title-score 目录作为站点根部署到 Vercel，
 * /api/subscribe 会自动映射到本函数。本地跑沸点 server 时则走 server 的 SQLite 落库。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: { message: '仅支持 POST' } });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    res.status(400).json({ ok: false, error: { message: '请求体不是合法 JSON' } });
    return;
  }

  const email = String(body.email || '').trim();
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ ok: false, error: { message: '邮箱格式不对' } });
    return;
  }

  const text = [
    '【标题体检 · 新线索】',
    `邮箱：${email}`,
    `来源：${body.source || 'title-tool'}`,
    `备注：${body.note || '（无）'}`,
    `时间：${new Date().toISOString()}`,
  ].join('\n');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const formspree = process.env.FORMSPREE_ID;

  try {
    if (token && chatId) {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (!r.ok) throw new Error('Telegram 发送失败 ' + r.status);
    } else if (formspree) {
      const r = await fetch(`https://formspree.io/f/${formspree}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, source: body.source, note: body.note }),
      });
      if (!r.ok) throw new Error('Formspree 提交失败 ' + r.status);
    } else {
      console.log('[subscribe] 未配置转发目标，仅记录：', text);
    }
    res.status(200).json({ ok: true, data: { created: true } });
  } catch (e) {
    console.error('[subscribe] 转发失败：', e.message);
    res.status(502).json({ ok: false, error: { message: '留资转发失败，请稍后再试' } });
  }
}
