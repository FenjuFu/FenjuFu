// Pulls the Astron community leaderboard and redraws the profile headers,
// the rank cards and the rank lines in both READMEs. Files are only
// rewritten when the numbers change, so scheduled runs stay quiet otherwise.
//
//   node scripts/render.mjs           # sync from the live leaderboard
//   node scripts/render.mjs --force   # redraw even if nothing changed

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOGIN = 'FenjuFu';
const BOARD_URL = 'https://www.awesome-astron-workflow.dev/stats';
const API_URL = 'https://www.awesome-astron-workflow.dev/api/github?action=leaderboard';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'assets');
const dataFile = path.join(assets, 'astron-rank.json');
const force = process.argv.includes('--force');

const FONT = `'PingFang SC','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC','Helvetica Neue',Arial,sans-serif`;
const themes = {
  light: { bg: '#ffffff', card: '#f6f8fa', border: '#d0d7de', text: '#1f2328', muted: '#59636e', accent: '#a3161b', pill: '#fff1f0' },
  dark: { bg: '#0d1117', card: '#161b22', border: '#30363d', text: '#e6edf3', muted: '#9198a1', accent: '#ff7b72', pill: '#2d1517' },
};

const locales = {
  en: {
    readme: 'README.md',
    suffix: '',
    name: ['Fenju Fu', 290, '符芬菊'],
    role: 'Developer Relations · Open Source Community',
    lines: [
      '🎓 Peking University · M.A. Journalism & Communication · B.A. Journalism',
      '💼 iFlytek Open Source DevRel',
      '🏅 Academic Secretary, CCF Women in Computing "Yifang Salon" Committee, 2026–2027',
    ],
    pills: (s) => [
      ['iFlytek Agent & Model Ecosystem', `Contributor #${s.rank}`],
      ['Spark-X2.5', 'Hugging Face Trending #1'],
      ['Open Source', '300+ merged PRs'],
    ],
    cardTitle: 'Astron Community Leaderboard · iFlytek Open Source Agent & Model Ecosystem',
    ranked: (n) => `/ ${n} ranked`,
    metrics: ['Contribution score', 'Pull requests', 'Merged PRs', 'Issues'],
    footer: (s, updated) => `Across ${s.repos} repositories · Updated ${updated} · Auto-synced every 3 hours`,
    line: (s) => `${medal(s.rank)} **#${s.rank} contributor to iFlytek's open-source agent & model ecosystem** · [Astron Community Leaderboard](${BOARD_URL})`,
  },
  zh: {
    readme: 'README.zh-CN.md',
    suffix: '-zh',
    name: ['符芬菊', 232, 'Fenju Fu'],
    role: '开源项目运营 · Developer Relations',
    lines: [
      '🎓 北京大学 新闻与传播（辅修管理学）硕士 · 新闻学学士',
      '💼 讯飞开源 DevRel',
      '🏅 2026–2027 CCF 女工委「一方沙龙」学术委员会学术秘书',
    ],
    pills: (s) => [
      ['讯飞开源智能体与模型生态', `贡献 #${s.rank}`],
      ['Spark-X2.5', 'Hugging Face Trending #1'],
      ['Open Source', '300+ merged PRs'],
    ],
    cardTitle: 'Astron 社区贡献榜 · 讯飞开源智能体与模型生态',
    ranked: (n) => `/ ${n} 位上榜`,
    metrics: ['贡献值', 'Pull Requests', '已合并 PR', 'Issues'],
    footer: (s, updated) => `覆盖 ${s.repos} 个仓库 · 数据更新于 ${updated} · 每 3 小时自动同步`,
    line: (s) => `${medal(s.rank)} **讯飞开源智能体与模型生态贡献 #${s.rank}** · [Astron 社区贡献榜](${BOARD_URL})`,
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function medal(rank) {
  return { 1: '🥇', 2: '🥈', 3: '🥉' }[rank] || '🏅';
}

async function fetchBoard() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(API_URL, { signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const board = await res.json();
      if (!Array.isArray(board)) throw new Error('unexpected payload');
      return board;
    } catch (err) {
      lastError = err;
      console.warn(`leaderboard fetch attempt ${attempt} failed: ${err.message}`);
    }
  }
  throw lastError;
}

function summarize(board) {
  const index = board.findIndex((e) => e.login?.toLowerCase() === LOGIN.toLowerCase());
  if (index === -1) return null;
  const me = board[index];
  const stats = { rank: me.rank ?? index + 1, of: board.length, score: me.total_contributions ?? 0, prs: 0, merged: 0, issues: 0, repos: 0 };
  for (const repo of Object.values(me.repo_summary || {})) {
    stats.prs += repo.pr_created || 0;
    stats.merged += repo.pr_merged || 0;
    stats.issues += repo.issues_created || 0;
    if ((repo.pr_created || 0) + (repo.issues_created || 0) > 0) stats.repos += 1;
  }
  return stats;
}

function header(t, l, s) {
  const W = 1000, H = 250;
  const [name, altX, alt] = l.name;
  const pillSvg = l.pills(s).map(([k, v], i) => {
    const y = 40 + i * 58;
    return `
  <rect x="700" y="${y}" width="262" height="50" rx="12" fill="${t.pill}" stroke="${t.border}"/>
  <rect x="700" y="${y + 10}" width="4" height="30" rx="2" fill="${t.accent}"/>
  <text x="720" y="${y + 20}" font-size="12" fill="${t.muted}">${esc(k)}</text>
  <text x="720" y="${y + 40}" font-size="16" font-weight="700" fill="${t.text}">${esc(v)}</text>`;
  }).join('');
  const lines = l.lines.map((line, i) => `
    <text x="48" y="${168 + i * 28}">${esc(line)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="${t.bg}" stroke="${t.border}"/>
  <rect x="1" y="24" width="6" height="${H - 48}" rx="3" fill="${t.accent}"/>
  <text x="48" y="86" font-size="46" font-weight="700" fill="${t.text}" letter-spacing="2">${esc(name)}</text>
  <text x="${altX}" y="86" font-size="24" fill="${t.muted}">${esc(alt)}</text>
  <text x="48" y="126" font-size="20" font-weight="700" fill="${t.accent}">${esc(l.role)}</text>
  <g font-size="15" fill="${t.muted}">${lines}
  </g>
  <line x1="672" y1="44" x2="672" y2="${H - 44}" stroke="${t.border}"/>${pillSvg}
</svg>
`;
}

function rankCard(t, l, s, updated) {
  const W = 1000, H = 172;
  const values = [s.score, s.prs, s.merged, s.issues];
  const cols = values.map((v, i) => {
    const x = 400 + i * 148;
    return `
  <text x="${x}" y="88" font-size="32" font-weight="800" fill="${t.text}">${esc(v)}</text>
  <text x="${x}" y="114" font-size="13" fill="${t.muted}">${esc(l.metrics[i])}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${t.card}" stroke="${t.border}"/>
  <text x="32" y="40" font-size="14" font-weight="700" fill="${t.muted}">${esc(l.cardTitle)}</text>
  <text x="32" y="114" font-size="68" font-weight="800" fill="${t.accent}">#${esc(s.rank)}</text>
  <text x="${32 + 44 * String(s.rank).length + 46}" y="112" font-size="15" fill="${t.muted}">${esc(l.ranked(s.of))}</text>
  <line x1="370" y1="56" x2="370" y2="122" stroke="${t.border}"/>${cols}
  <text x="32" y="152" font-size="12" fill="${t.muted}">${esc(l.footer(s, updated))}</text>
</svg>
`;
}

const board = await fetchBoard();
const stats = summarize(board);
if (!stats) {
  console.warn(`${LOGIN} is not on the leaderboard; leaving files untouched`);
  process.exit(0);
}

const previous = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : null;
const same = previous && Object.keys(stats).every((k) => previous.stats?.[k] === stats[k]);
if (same && !force) {
  console.log('leaderboard unchanged:', stats);
  process.exit(0);
}

const updated = same ? previous.updated : new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(dataFile, JSON.stringify({ updated, stats }, null, 2) + '\n');

const marker = /(<!-- astron-rank:start -->\n)[\s\S]*?(\n<!-- astron-rank:end -->)/;
for (const l of Object.values(locales)) {
  for (const [name, t] of Object.entries(themes)) {
    fs.writeFileSync(path.join(assets, `header${l.suffix}-${name}.svg`), header(t, l, stats));
    fs.writeFileSync(path.join(assets, `rank${l.suffix}-${name}.svg`), rankCard(t, l, stats, updated));
  }
  const readmeFile = path.join(root, l.readme);
  const readme = fs.readFileSync(readmeFile, 'utf8');
  if (!marker.test(readme)) throw new Error(`astron-rank markers missing from ${l.readme}`);
  fs.writeFileSync(readmeFile, readme.replace(marker, `$1${l.line(stats)}$2`));
}

console.log('leaderboard synced:', stats);
