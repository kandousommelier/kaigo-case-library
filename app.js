const FALLBACK_CASES = [];
const PROBLEM_CATEGORIES = [
  '物を探すこと、準備、片付け、移動',
  '仕事の流れ、誰が何をするか、仕事の偏り',
  '記録や書類の作成',
  '連絡、申し送り、みんなに伝えること',
  '目標の共有や改善活動'
];
const CSV_FORMATS = {
  old: { type: 'old', label: '問題虫めがね 旧版CSV' },
  new: { type: 'new', label: '問題虫めがね 新版CSV' },
  unknown: { type: 'unknown', label: '未対応CSV' }
};
const NEW_CSV_NOTICE = '新版CSVには、ありたい姿・解決状態・解決方向性・実施する取組・成果指標は含まれていません。改善計画を作成する際は、管理者・活動推進リーダーへの追加確認が必要です。';
const NEW_CSV_UNCONFIRMED = {
  desired: '未確認。管理者・活動推進リーダーへの確認が必要',
  resolved: '未確認。改善計画作成時に確認',
  direction: '未確認。関連事例を参考に確認が必要',
  action: '未確認。管理者・活動推進リーダーと決定',
  metric: '未確認。取組内容決定後に設定'
};
const BLOCKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const CAUSAL_LAYERS = [
  { key: 'background', label: '背景要因', description: '組織・体制・教育・会議体・ICT環境など、課題の背景にある構造的な要因です。' },
  { key: 'direct', label: '直接原因', description: '現場の困りごとを直接生んでいる業務手順、ルール、役割分担、情報共有方法などです。' },
  { key: 'field', label: '現場で起きている困りごと', description: '問題虫めがねで職員が実際に困っていると回答した内容です。' },
  { key: 'risk', label: '影響・リスク', description: 'その結果として起きている、または起きる可能性がある職員負担、残業、ミス、サービス品質低下、安全面のリスクです。' }
];
const DIRECTION_CATEGORY_MAP = {
  '道具（ICT）': ['ICT活用', '記録の効率化', '情報共有'],
  '道具（介護テクノロジー）': ['介護ロボット', '安全な介護', '業務の見直し'],
  '運用ルール': ['標準化', '手順書の作成', 'マニュアル作成'],
  '業務プロセス変更': ['業務の見直し', '役割分担'],
  '制度設計': ['人材育成', '改善活動', '標準化']
};
const state = {
  cases: [],
  query: '',
  filters: { problem: new Set(), service: new Set(), category: new Set() },
  sort: 'recommended'
};
const grid = document.querySelector('#case-grid');
const count = document.querySelector('#result-count');
const empty = document.querySelector('#empty-state');
const dialog = document.querySelector('#case-dialog');
let csvIssues = [];
let latestCausalCopyText = { layers: '', longTerm: '', questions: '' };

function q(selector) { return document.querySelector(selector); }
function displayValue(value) { return String(value || '').trim() || '未入力'; }
function normalized(value) { return String(value || '').toLocaleLowerCase('ja').replace(/[\s　]+/g, ''); }
function normalizeHeader(value) { return normalized(value).replace(/[〜～]/g, '~'); }
function uniqueValues(values) { return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]; }
function unique(field) { return uniqueValues(state.cases.flatMap(item => Array.isArray(item[field]) ? item[field] : [item[field]])); }
function addUnique(target, items) { items.forEach(item => { if (item && !target.includes(item)) target.push(item); }); }
function mapByIncludes(value, map) {
  const result = [];
  Object.entries(map).forEach(([label, values]) => { if (String(value || '').includes(label)) addUnique(result, values); });
  return result;
}
function bind(selector, event, handler) { const node = q(selector); if (node) node.addEventListener(event, handler); }

async function loadCases() {
  try {
    const response = await fetch('cases.json');
    if (!response.ok) throw new Error('cases');
    state.cases = await response.json();
  } catch (error) {
    state.cases = FALLBACK_CASES;
  }
  buildFilters();
  render();
}
function buildFilters() {
  const groups = [
    { key: 'problem', element: '#problem-tags', values: PROBLEM_CATEGORIES },
    { key: 'service', element: '#service-tags', values: unique('service').sort((a, b) => a.localeCompare(b, 'ja')) },
    { key: 'category', element: '#category-tags', values: unique('categories').sort((a, b) => a.localeCompare(b, 'ja')) }
  ];
  groups.forEach(group => {
    const container = q(group.element);
    if (!container) return;
    container.replaceChildren(...group.values.map(value => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-tag';
      button.textContent = value;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => toggleFilter(group.key, value, button));
      return button;
    }));
  });
}
function toggleFilter(type, value, button) {
  const selected = state.filters[type];
  selected.has(value) ? selected.delete(value) : selected.add(value);
  button.setAttribute('aria-pressed', String(selected.has(value)));
  render();
}
function getResults() {
  const query = normalized(state.query);
  const results = state.cases.filter(item => {
    const categories = item.categories || [];
    const searchable = normalized([
      item.title, item.service, item.problemCategory, item.problemDetails, ...categories,
      item.approach, item.outcome, item.tip, item.suitableFor, item.supportUse,
      item.sourceTitle, item.sourceNote || ''
    ].join(' '));
    return (!query || searchable.includes(query))
      && (!state.filters.problem.size || state.filters.problem.has(item.problemCategory))
      && (!state.filters.service.size || state.filters.service.has(item.service))
      && (!state.filters.category.size || categories.some(value => state.filters.category.has(value)));
  });
  return state.sort === 'title' ? results.sort((a, b) => a.title.localeCompare(b.title, 'ja')) : results;
}
function render() {
  const results = getResults();
  if (count) count.textContent = results.length;
  if (grid) grid.replaceChildren(...results.map(createCard));
  if (empty) empty.hidden = results.length !== 0;
  if (grid) grid.hidden = results.length === 0;
}
function createCard(item) {
  const card = q('#case-template').content.firstElementChild.cloneNode(true);
  const categories = item.categories || [];
  card.querySelector('.service-label').textContent = displayValue(item.service);
  card.querySelector('.case-number').textContent = 'CASE ' + String(item.id).padStart(2, '0');
  card.querySelector('.case-title').textContent = displayValue(item.title);
  card.querySelector('.case-source').textContent = '出典：' + displayValue(item.sourceTitle);
  card.querySelector('.case-problem').textContent = displayValue(item.problemCategory);
  card.querySelector('.case-outcome').textContent = displayValue(item.outcome);
  card.querySelector('.case-tip').textContent = displayValue(item.tip);
  card.querySelector('.case-suitable').textContent = displayValue(item.suitableFor);
  card.querySelector('.category-list').replaceChildren(...categories.map(value => {
    const tag = document.createElement('span');
    tag.className = 'category-chip';
    tag.textContent = value;
    return tag;
  }));
  card.querySelector('.detail-button').addEventListener('click', () => openDetail(item));
  card.querySelector('.plan-case-button').addEventListener('click', () => createPlanFromCase(item));
  return card;
}
function appendDetailBlock(target, heading, text) {
  const block = document.createElement('section');
  block.className = 'dialog-block';
  const h3 = document.createElement('h3');
  h3.textContent = heading;
  const p = document.createElement('p');
  p.textContent = displayValue(text);
  block.append(h3, p);
  target.append(block);
}
function openDetail(item) {
  const content = q('#dialog-content');
  content.replaceChildren();
  const service = document.createElement('p');
  service.className = 'dialog-service';
  service.textContent = displayValue(item.service) + ' / ' + displayValue(item.problemCategory);
  const title = document.createElement('h2');
  title.id = 'dialog-title';
  title.textContent = displayValue(item.title);
  const source = document.createElement('p');
  source.className = 'dialog-source';
  source.textContent = '出典：' + displayValue(item.sourceTitle) + (item.sourcePage ? '（' + item.sourcePage + '）' : item.sourceNote ? '（' + item.sourceNote + '）' : '');
  content.append(service, title, source);
  appendDetailBlock(content, '困っていたこと', item.problemDetails);
  appendDetailBlock(content, '取り組んだこと', item.approach);
  appendDetailBlock(content, '成果', item.outcome);
  appendDetailBlock(content, '真似できるポイント', item.tip);
  appendDetailBlock(content, 'この事例が向いている施設', item.suitableFor);
  appendDetailBlock(content, '伴走支援での使い方', item.supportUse);
  const link = document.createElement('a');
  link.className = 'source-link';
  link.href = item.sourcePdf || item.source || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = '出典リンクを開く';
  content.append(link);
  const planButton = document.createElement('button');
  planButton.type = 'button';
  planButton.className = 'dialog-plan-button';
  planButton.textContent = 'この事例をもとに計画を作る';
  planButton.addEventListener('click', () => { dialog.close(); createPlanFromCase(item); });
  content.append(planButton);
  dialog.showModal();
}
function reset() {
  state.query = '';
  Object.values(state.filters).forEach(set => set.clear());
  const input = q('#search-input');
  if (input) input.value = '';
  document.querySelectorAll('.filter-tag').forEach(button => button.setAttribute('aria-pressed', 'false'));
  render();
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header, index) => index === 0 ? header.replace(/^\uFEFF/, '').trim() : header.trim());
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()])));
}
function findHeader(row, ...parts) {
  const normalizedParts = parts.map(normalizeHeader).filter(Boolean);
  return Object.keys(row).find(header => normalizedParts.every(part => normalizeHeader(header).includes(part)));
}
function valueByHeader(row, ...parts) {
  const header = findHeader(row, ...parts);
  return header ? row[header] : '';
}
function csvValue(row, key) {
  const exact = Object.keys(row).find(header => header === key);
  if (exact) return row[exact];
  const prefix = key.split('｜')[0];
  const found = Object.keys(row).find(header => header.startsWith(prefix + '｜') || header.startsWith(prefix + '|') || header === prefix);
  return found ? row[found] : '';
}
function newCsvQuestionValue(row, number) { return valueByHeader(row, '設問' + number); }
function newCsvBlockValue(row, block, number) { return valueByHeader(row, '設問' + block + number); }
function detectCsvFormat(rows) {
  const headers = Object.keys(rows[0] || {}).map(normalizeHeader);
  const hasNew = [1, 2, 3].every(number => headers.some(header => header.includes(normalizeHeader('設問' + number))))
    && BLOCKS.some(block => headers.some(header => header.includes(normalizeHeader('設問' + block + '1'))));
  if (hasNew) return CSV_FORMATS.new;
  const hasOld = headers.some(header => /^q[1-7]/i.test(header) || header.includes('q1') || header.includes('q2') || header.includes('q3'));
  return hasOld ? CSV_FORMATS.old : CSV_FORMATS.unknown;
}
function activeNewCsvBlock(row) { return BLOCKS.find(block => newCsvBlockValue(row, block, 1).trim()) || ''; }
function problemCurrentText(issue) {
  return [
    ['頻度', issue.frequency],
    ['場面', issue.timing],
    ['場所', issue.location],
    ['困っていること', issue.impact],
    ['継続期間', issue.duration]
  ].map(([label, value]) => label + '：' + displayValue(value)).join('\n');
}
function categoriesFromNewCsvIssue(issue) {
  const text = [issue.problemCategory, issue.selectedProblem, issue.impact, issue.timing, issue.location].join(' ');
  const categories = [];
  if (/記録|書類|帳票|入力|転記/.test(text)) addUnique(categories, ['記録の効率化', '標準化']);
  if (/連絡|申し送り|共有|伝達|会議/.test(text)) addUnique(categories, ['情報共有', '標準化']);
  if (/探す|準備|片付け|移動|物品|置き場/.test(text)) addUnique(categories, ['5S活動', '業務の見直し']);
  if (/流れ|役割|偏り|分担|人手|配置|重な/.test(text)) addUnique(categories, ['業務の見直し', '役割分担']);
  if (/目標|改善|活動|リーダー|管理者/.test(text)) addUnique(categories, ['改善活動', '標準化']);
  return categories;
}
function frequencyScore(value) {
  const text = String(value || '');
  if (/常に|いつも|毎日|よく|頻繁|多い/.test(text)) return 5;
  if (/週|しばしば|ときどき|時々/.test(text)) return 3;
  if (/たまに|まれ/.test(text)) return 1;
  return 2;
}
function durationScore(value) {
  const text = String(value || '');
  if (/半年以上|以前から|ずっと|長期間|1年|一年|数年/.test(text)) return 5;
  if (/3か月|三か月|数か月|数ヶ月/.test(text)) return 3;
  if (/最近|今月|先月/.test(text)) return 1;
  return 2;
}
function impactScore(value) {
  const text = String(value || '');
  let score = 0;
  if (/残業|時間がかか|休憩|負担|疲/.test(text)) score += 3;
  if (/確認漏れ|漏れ|ミス|事故|安全|リスク/.test(text)) score += 4;
  if (/品質|サービス|利用者|家族|不安|ストレス/.test(text)) score += 2;
  return Math.min(score, 6);
}
function calculateNewCsvIssues(rows) {
  const raw = rows.map((row, index) => {
    const activeBlock = activeNewCsvBlock(row);
    const selectedProblem = activeBlock ? newCsvBlockValue(row, activeBlock, 1) : '';
    const issue = {
      id: index + 1,
      csvFormat: 'new',
      csvFormatLabel: CSV_FORMATS.new.label,
      office: '',
      facilityName: '',
      businessName: '',
      sourceRow: index + 1,
      activeBlock,
      service: newCsvQuestionValue(row, 1),
      role: newCsvQuestionValue(row, 2),
      problemCategory: newCsvQuestionValue(row, 3),
      theme: newCsvQuestionValue(row, 3),
      selectedProblem,
      frequency: activeBlock ? newCsvBlockValue(row, activeBlock, 2) : '',
      timing: activeBlock ? newCsvBlockValue(row, activeBlock, 3) : '',
      location: activeBlock ? newCsvBlockValue(row, activeBlock, 4) : '',
      impact: activeBlock ? newCsvBlockValue(row, activeBlock, 5) : '',
      duration: activeBlock ? newCsvBlockValue(row, activeBlock, 6) : ''
    };
    issue.title = issue.selectedProblem || '未選択の課題';
    issue.currentItems = issue.selectedProblem;
    issue.current = problemCurrentText(issue);
    issue.desired = NEW_CSV_UNCONFIRMED.desired;
    issue.gap = '仮：' + (issue.impact || issue.selectedProblem || '影響内容の確認が必要');
    issue.resolved = NEW_CSV_UNCONFIRMED.resolved;
    issue.direction = NEW_CSV_UNCONFIRMED.direction;
    issue.action = NEW_CSV_UNCONFIRMED.action;
    issue.metric = NEW_CSV_UNCONFIRMED.metric;
    issue.problemCategories = issue.problemCategory ? [issue.problemCategory] : [];
    issue.categories = categoriesFromNewCsvIssue(issue);
    issue.keywords = [issue.problemCategory, issue.selectedProblem, issue.impact, issue.timing, issue.location, issue.service, issue.role].filter(Boolean).join(' ');
    return issue;
  }).filter(issue => issue.problemCategory && issue.selectedProblem);
  const problemCounts = {};
  const categoryCounts = {};
  const rolesByProblem = {};
  raw.forEach(issue => {
    problemCounts[issue.selectedProblem] = (problemCounts[issue.selectedProblem] || 0) + 1;
    categoryCounts[issue.problemCategory] = (categoryCounts[issue.problemCategory] || 0) + 1;
    (rolesByProblem[issue.selectedProblem] || (rolesByProblem[issue.selectedProblem] = new Set())).add(issue.role || '未入力');
  });
  return raw.map(issue => {
    const sameProblem = problemCounts[issue.selectedProblem] || 1;
    const sameCategory = categoryCounts[issue.problemCategory] || 1;
    const roleCount = rolesByProblem[issue.selectedProblem]?.size || 1;
    const score = Math.round(sameProblem * 3 + sameCategory * 1.5 + roleCount * 2 + frequencyScore(issue.frequency) + durationScore(issue.duration) + impactScore(issue.impact));
    const reasons = ['同じ課題 ' + sameProblem + '件', '同じ困りごと分類 ' + sameCategory + '件', '回答者の立場 ' + roleCount + '種類', '頻度：' + displayValue(issue.frequency), '継続期間：' + displayValue(issue.duration), '影響：' + displayValue(issue.impact)];
    return { ...issue, priorityScore: score, priorityReason: reasons.join('・') };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}
function calculateOldCsvIssues(rows) {
  const raw = rows.map((row, index) => ({
    id: index + 1,
    csvFormat: 'old',
    csvFormatLabel: CSV_FORMATS.old.label,
    office: csvValue(row, '事業所名'),
    service: csvValue(row, '事業所種別'),
    role: csvValue(row, '回答者の立場'),
    theme: csvValue(row, 'Q1｜今回のワークで扱うテーマ'),
    currentItems: csvValue(row, 'Q2｜今の現場で当てはまるもの'),
    current: csvValue(row, 'Q3｜今の現場の状態を一言で表してください'),
    desired: csvValue(row, 'Q4｜こうなっていたらいいなと思う状態'),
    gap: csvValue(row, 'Q5｜現状との差が一番大きいもの'),
    resolved: csvValue(row, 'Q6｜この問題が解決された状態'),
    direction: csvValue(row, 'Q7｜課題を解決するための方向性')
  })).filter(issue => issue.theme || issue.current || issue.gap);
  const themeCounts = {};
  const gapCounts = {};
  raw.forEach(issue => {
    themeCounts[issue.theme] = (themeCounts[issue.theme] || 0) + 1;
    gapCounts[issue.gap] = (gapCounts[issue.gap] || 0) + 1;
  });
  return raw.map(issue => {
    const score = Math.round((themeCounts[issue.theme] || 1) * 2 + (gapCounts[issue.gap] || 1) * 1.5 + 2);
    return {
      ...issue,
      title: issue.gap || issue.current || issue.theme + 'の改善',
      problemCategory: issue.theme,
      problemCategories: issue.theme ? [issue.theme] : [],
      categories: mapByIncludes(issue.direction, DIRECTION_CATEGORY_MAP),
      priorityScore: score,
      priorityReason: '同テーマ ' + (themeCounts[issue.theme] || 1) + '件・同じギャップ ' + (gapCounts[issue.gap] || 1) + '件'
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}
function calculateCsvIssues(rows, format = detectCsvFormat(rows)) {
  if (format.type === 'new') return calculateNewCsvIssues(rows);
  if (format.type === 'old') return calculateOldCsvIssues(rows);
  return [];
}

function plannerTokens(text) {
  return String(text || '').toLocaleLowerCase('ja').split(/[、,・。/／\s]+/).map(value => value.trim()).filter(value => value.length > 1);
}
function findRelatedCases(issue, limit = 5) {
  const keywords = plannerTokens([issue.title, issue.current, issue.gap, issue.keywords, issue.problemCategory, issue.selectedProblem, issue.impact, issue.timing, issue.location, issue.service, issue.role].join(' '));
  return state.cases.map(item => {
    const categories = item.categories || [];
    let score = 0;
    if (issue.problemCategories?.includes(item.problemCategory) || issue.problemCategory === item.problemCategory) score += 8;
    (issue.categories || []).forEach(category => { if (categories.includes(category)) score += 4; });
    if (issue.service && item.service && (item.service.includes(issue.service) || issue.service.includes(item.service))) score += 5;
    const hay = normalized([item.title, item.service, item.problemCategory, item.problemDetails, item.approach, item.outcome, item.tip, item.suitableFor, item.supportUse, ...categories].join(' '));
    keywords.forEach(keyword => { if (hay.includes(normalized(keyword))) score += 2; });
    return { item, score };
  }).sort((a, b) => b.score - a.score || a.item.id - b.item.id).slice(0, Math.max(3, limit)).map(result => result.item);
}
function caseSourceText(item) {
  const title = item.sourceTitle || item.sourceType || '出典資料';
  const page = item.sourcePage ? '（' + item.sourcePage + '）' : '';
  const url = item.sourcePdf || item.source || '出典リンクは自施設で確認する';
  return title + page + '\n' + url;
}
function caseReferenceText(item) {
  return '事例タイトル：' + displayValue(item.title) + '\nサービス種別：' + displayValue(item.service) + '\n困りごと分類：' + displayValue(item.problemCategory) + '\n出典：' + caseSourceText(item);
}
function newCsvKnownText(issue) {
  return [
    '課題：' + displayValue(issue.selectedProblem),
    'サービス種別：' + displayValue(issue.service),
    '回答者の立場：' + displayValue(issue.role),
    '困りごと分類：' + displayValue(issue.problemCategory),
    '頻度：' + displayValue(issue.frequency),
    '起きる場面：' + displayValue(issue.timing),
    '起きる場所：' + displayValue(issue.location),
    '困っていること：' + displayValue(issue.impact),
    '継続期間：' + displayValue(issue.duration)
  ].join('\n');
}
function buildPlan(issue) {
  if (issue.planSource === 'case') {
    return {
      title: '改善計画のたたき台',
      issue,
      related: [],
      showRelated: false,
      fields: [
        ['参考にした事例', caseReferenceText(issue)],
        ['事例で確認された課題', displayValue(issue.problemDetails)],
        ['事例で行った取組', displayValue(issue.approach)],
        ['事例で確認された成果', '参考事例で確認された成果：' + displayValue(issue.outcome) + '\n自施設では、同じ成果が得られるかを確認すべき指標として扱います。'],
        ['最初の2週間でやること', displayValue(issue.tip)],
        ['注意点', '事例に書かれていない成果や効果を、自施設の成果として断定しません。']
      ]
    };
  }
  if (issue.csvFormat === 'new') {
    const related = findRelatedCases(issue, 5);
    return {
      title: '追加確認が必要な計画案',
      issue,
      related,
      relatedHeading: '参考候補',
      showRelated: true,
      fields: [
        ['このCSVから分かる課題', newCsvKnownText(issue)],
        ['優先度が高い理由', issue.priorityReason],
        ['関連する参考事例', related.length ? related.map((item, index) => (index + 1) + '. ' + item.title + '（' + item.service + ' / ' + item.problemCategory + '）').join('\n') : '関連する参考候補は、管理者・活動推進リーダーへの確認後に再検索してください。'],
        ['管理者・活動推進リーダーに確認すべき事項', ['ありたい姿はどのような状態ですか', 'この課題が解決された状態を、職員・利用者の行動で表すと何ですか', '解決方向性は、運用ルール・業務プロセス変更・ICT活用・人材育成などのどれに近いですか', '実施する取組を誰が、いつから、どの範囲で試しますか', '成果指標は何を、いつ、どの方法で確認しますか'].join('\n')],
        ['注意点', NEW_CSV_NOTICE]
      ]
    };
  }
  const related = findRelatedCases(issue);
  return {
    title: '改善計画のたたき台',
    issue,
    related,
    showRelated: true,
    fields: [
      ['課題名', issue.title],
      ['現状', issue.current || issue.currentItems || '現場の状況をチームで確認する'],
      ['ありたい姿', issue.desired || issue.resolved || '職員が迷わず安全に業務を進められる状態'],
      ['優先順位の理由', issue.priorityReason || '選択した課題・事例を起点に整理'],
      ['取り組む方向性', issue.direction || '業務の見直しと小さな試行'],
      ['成果指標', '対象業務の所要時間、職員の負担感、利用者と関わる時間']
    ]
  };
}
function planText(plan) {
  const fields = plan.fields.map(([heading, value]) => '【' + heading + '】\n' + value).join('\n\n');
  if (plan.showRelated === false) return fields;
  return fields + '\n\n【' + (plan.relatedHeading || '参考事例') + '】\n' + plan.related.map((item, index) => (index + 1) + '. ' + item.title + '（' + item.service + '）').join('\n');
}
function renderPlan(issue) {
  const plan = buildPlan(issue);
  const output = q('#plan-output');
  if (!output) return;
  output.hidden = false;
  output.replaceChildren();
  const head = document.createElement('div');
  head.className = 'plan-output-head';
  const title = document.createElement('h3');
  title.textContent = plan.title;
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'copy-plan-button';
  copy.textContent = '計画案をコピー';
  copy.addEventListener('click', () => copyTextContent(planText(plan), copy, '計画案をコピー'));
  head.append(title, copy);
  const fields = document.createElement('div');
  fields.className = 'plan-fields';
  plan.fields.forEach(([heading, value]) => {
    const block = document.createElement('section');
    block.className = 'plan-field';
    const h = document.createElement('h4');
    h.textContent = heading;
    const p = document.createElement('p');
    p.textContent = displayValue(value);
    block.append(h, p);
    fields.append(block);
  });
  if (plan.showRelated !== false) {
    const related = document.createElement('section');
    related.className = 'plan-field related-cases';
    const h = document.createElement('h4');
    h.textContent = plan.relatedHeading || '参考事例';
    const list = document.createElement('div');
    list.className = 'related-case-list';
    plan.related.forEach(item => {
      const card = document.createElement('div');
      card.className = 'related-case';
      const strong = document.createElement('strong');
      strong.textContent = item.title;
      const meta = document.createElement('span');
      meta.textContent = displayValue(item.service) + ' / ' + displayValue(item.problemCategory);
      card.append(strong, meta);
      list.append(card);
    });
    related.append(h, list);
    fields.append(related);
  }
  output.append(head, fields);
  output.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function copyTextContent(text, button, defaultLabel) {
  const value = String(text || '').trim();
  if (!value) { button.textContent = 'コピーする内容がありません'; setTimeout(() => button.textContent = defaultLabel, 1800); return; }
  const done = () => { button.textContent = 'コピーしました'; setTimeout(() => button.textContent = defaultLabel, 1800); };
  const failed = () => { button.textContent = 'コピーできませんでした'; setTimeout(() => button.textContent = defaultLabel, 1800); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(done).catch(failed);
  else failed();
}

function conciseNodeName(value, fallback) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean ? (clean.length > 52 ? clean.slice(0, 51) + '…' : clean) : fallback;
}
function defaultRiskName(issue) {
  const text = [issue.problemCategory, issue.selectedProblem, issue.currentItems, issue.impact, issue.gap].join(' ');
  if (/記録|連絡|申し送り|共有/.test(text)) return '確認漏れや情報共有のばらつきが生じる';
  if (/役割|流れ|偏り|分担/.test(text)) return '職員負担や役割の偏りが続く';
  if (/探す|準備|片付け|移動/.test(text)) return '準備・移動時間と職員負担が増える';
  return '職員負担とサービス品質への影響が続く';
}
function groupNodes(nodes) {
  const map = new Map();
  nodes.forEach(node => {
    const key = normalized(node.name);
    if (!map.has(key)) map.set(key, { ...node, issues: [] });
    map.get(key).issues.push(node.issue);
  });
  return [...map.values()].sort((a, b) => b.issues.length - a.issues.length).slice(0, 8);
}
function buildCausalStructure(issues) {
  const raw = { background: [], direct: [], field: [], risk: [] };
  issues.forEach(issue => {
    if (issue.csvFormat === 'new') {
      raw.background.push({ name: issue.duration ? '継続している背景要因の確認が必要（仮説）' : '背景要因は追加確認が必要', issue });
      raw.direct.push({ name: conciseNodeName(issue.impact || issue.selectedProblem, '直接原因の確認が必要'), issue });
      raw.field.push({ name: conciseNodeName(issue.selectedProblem, '現場で起きている困りごと'), issue });
      raw.risk.push({ name: conciseNodeName(issue.impact || defaultRiskName(issue), defaultRiskName(issue)), issue });
      return;
    }
    raw.background.push({ name: '改善を支える体制・ルールの確認が必要', issue });
    raw.direct.push({ name: conciseNodeName(issue.gap || issue.direction, '現状と目指す状態の差を具体化する必要'), issue });
    raw.field.push({ name: conciseNodeName(issue.currentItems || issue.current || issue.title, '現場で起きている困りごと'), issue });
    raw.risk.push({ name: defaultRiskName(issue), issue });
  });
  const layers = {};
  CAUSAL_LAYERS.forEach(layer => { layers[layer.key] = groupNodes(raw[layer.key]); });
  return {
    layers,
    shortTerm: layers.field.slice(0, 5),
    longTerm: [...layers.background, ...layers.direct].slice(0, 8),
    confirmationPoints: ['ありたい姿が未確認です。', '解決された状態が未確認です。', '解決方向性が未確認です。', '実施する取組が未確認です。', '成果指標が未確認です。'],
    interviewQuestions: ['この課題について、どの状態になれば解決と言えますか。', '関連事例を参考にする場合、どの取組が自施設で試せそうですか。', '最初に試す範囲、担当者、期間はどうしますか。', '成果指標は何を使って確認しますか。']
  };
}
function nodeAnswerLines(node) {
  const definitions = node.issues.some(issue => issue.csvFormat === 'new')
    ? [['選んだ課題', 'selectedProblem'], ['頻度', 'frequency'], ['場面', 'timing'], ['場所', 'location'], ['困っていること', 'impact'], ['継続期間', 'duration']]
    : [['Q2', 'currentItems'], ['Q3', 'current'], ['Q5', 'gap'], ['Q7', 'direction']];
  return definitions.flatMap(([label, key]) => uniqueValues(node.issues.map(issue => issue[key])).slice(0, 2).map(value => label + '：' + value));
}
function nodeReasonText(node) {
  if (node.issues.some(issue => issue.csvFormat === 'new')) {
    if (node.layer === 'direct') return '新版CSVの選択課題と困っていることから、直接原因の仮説として整理しました。';
    if (node.layer === 'field') return '新版CSVの選択課題・頻度・場面・場所から、現場で起きている困りごとの要点として整理しました。';
    if (node.layer === 'risk') return '新版CSVの困っていること欄を中心に、影響やリスクとして整理しました。';
    return '新版CSVだけでは背景要因を確定できないため、追加確認が必要な仮説として整理しました。';
  }
  return '回答内容から同じ、または近い内容をまとめて整理しました。';
}
function appendList(target, items, emptyText) {
  if (!target) return;
  target.replaceChildren();
  (items.length ? items : [emptyText]).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    target.append(li);
  });
}
function renderCausalNode(node, layerLabel, layerKey) {
  node.layer = layerKey;
  const card = document.createElement('article');
  card.className = 'causal-node';
  const kind = document.createElement('span');
  kind.className = 'node-kind';
  kind.textContent = '分類：' + layerLabel;
  const point = document.createElement('span');
  point.className = 'node-point-label';
  point.textContent = '要点';
  const title = document.createElement('h5');
  title.textContent = node.name;
  const meta = document.createElement('p');
  meta.className = 'node-meta';
  meta.textContent = '該当カード件数：' + node.issues.length + '件';
  const reason = document.createElement('p');
  reason.className = 'node-reason';
  const strong = document.createElement('strong');
  strong.textContent = 'この要点に整理した理由：';
  reason.append(strong, document.createTextNode(nodeReasonText(node)));
  const answers = document.createElement('div');
  answers.className = 'node-answers';
  const answerLabel = document.createElement('strong');
  answerLabel.textContent = '該当する回答';
  const list = document.createElement('ul');
  (nodeAnswerLines(node).length ? nodeAnswerLines(node) : ['該当回答は未入力です。']).forEach(value => {
    const li = document.createElement('li');
    li.textContent = value;
    list.append(li);
  });
  answers.append(answerLabel, list);
  const roles = document.createElement('p');
  roles.className = 'node-meta';
  roles.textContent = '回答者の立場：' + (uniqueValues(node.issues.map(issue => issue.role)).join('、') || '未入力');
  const themes = document.createElement('p');
  themes.className = 'node-meta';
  themes.textContent = '関連テーマ：' + (uniqueValues(node.issues.map(issue => issue.problemCategory || issue.theme)).join('、') || '未入力');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'evidence-button';
  button.textContent = '該当回答を見る';
  button.addEventListener('click', () => openCausalEvidence(node, layerLabel));
  card.append(kind, point, title, meta, reason, answers, roles, themes, button);
  return card;
}
function evidenceFields(issue) {
  return issue.csvFormat === 'new'
    ? [['サービス種別', issue.service], ['回答者の立場', issue.role], ['困りごと分類', issue.problemCategory], ['選んだ課題', issue.selectedProblem], ['頻度', issue.frequency], ['場面', issue.timing], ['場所', issue.location], ['困っていること', issue.impact], ['継続期間', issue.duration]]
    : [['回答者の立場', issue.role], ['テーマ', issue.theme], ['Q2の困りごと', issue.currentItems], ['Q3の現状', issue.current], ['Q5のギャップ', issue.gap], ['Q7の方向性', issue.direction]];
}
function openCausalEvidence(node, layerLabel) {
  const content = q('#causal-evidence-content');
  if (!content) return;
  content.replaceChildren();
  const title = document.createElement('h2');
  title.id = 'evidence-dialog-title';
  title.textContent = node.name;
  const intro = document.createElement('p');
  intro.className = 'dialog-service';
  intro.textContent = layerLabel + ' / 該当カード ' + node.issues.length + '件';
  content.append(title, intro);
  node.issues.forEach(issue => {
    const record = document.createElement('section');
    record.className = 'evidence-record';
    const h = document.createElement('h3');
    h.textContent = issue.office || issue.selectedProblem || '回答' + issue.id;
    record.append(h);
    evidenceFields(issue).forEach(([label, value]) => {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = label + '：';
      p.append(strong, document.createTextNode(displayValue(value)));
      record.append(p);
    });
    content.append(record);
  });
  q('#causal-evidence-dialog').showModal();
}
function causalLayerText(structure) {
  return CAUSAL_LAYERS.map(layer => '【' + layer.label + '】\n' + structure.layers[layer.key].map(node => '要点：' + node.name + '\n分類：' + layer.label + '\n該当カード件数：' + node.issues.length + '件\nこの要点に整理した理由：' + nodeReasonText({ ...node, layer: layer.key }) + '\n該当する回答：\n' + nodeAnswerLines(node).map(value => '・' + value).join('\n')).join('\n\n')).join('\n\n');
}
function renderCausalStructure(issues) {
  const section = q('#causal-draft');
  if (!section) return;
  section.removeAttribute('hidden');
  section.hidden = false;
  section.style.removeProperty('display');
  const structure = buildCausalStructure(issues);
  const layers = q('#causal-layers');
  layers.replaceChildren();
  CAUSAL_LAYERS.forEach((definition, index) => {
    const column = document.createElement('section');
    column.className = 'causal-layer';
    const head = document.createElement('div');
    head.className = 'causal-layer-head';
    const step = document.createElement('span');
    step.textContent = 'LAYER ' + (index + 1);
    const title = document.createElement('h4');
    title.textContent = definition.label;
    const desc = document.createElement('span');
    desc.textContent = definition.description;
    head.append(step, title, desc);
    const list = document.createElement('div');
    list.className = 'causal-node-list';
    structure.layers[definition.key].forEach(node => list.append(renderCausalNode(node, definition.label, definition.key)));
    if (!list.children.length) {
      const p = document.createElement('p');
      p.className = 'node-meta';
      p.textContent = '該当する内容はまだ抽出されていません。';
      list.append(p);
    }
    column.append(head, list);
    layers.append(column);
  });
  appendList(q('#short-term-issues'), structure.shortTerm.map(node => node.name + '（' + node.issues.length + '件）'), '短期改善候補は、管理者との確認後に整理してください。');
  appendList(q('#long-term-issues'), structure.longTerm.map(node => node.name + '（' + node.issues.length + '件）'), '中長期課題候補は、管理者との確認後に整理してください。');
  appendList(q('#confirmation-points'), structure.confirmationPoints, '現時点では主要な課題構造を整理できています。');
  appendList(q('#interview-questions'), structure.interviewQuestions, '現時点では主要な課題構造を整理できています。');
  latestCausalCopyText = {
    layers: causalLayerText(structure),
    longTerm: '【中長期課題候補】\n' + structure.longTerm.map(node => '・' + node.name + '（該当カード ' + node.issues.length + '件）').join('\n'),
    questions: '【追加確認が必要な場合の質問】\n' + structure.interviewQuestions.map(item => '・' + item).join('\n')
  };
}

function selectPlannerTab(name) {
  document.querySelectorAll('.planner-tab').forEach(button => {
    const active = button.dataset.plannerTab === name;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  ['csv', 'manual', 'case'].forEach(key => { const panel = q('#planner-' + key + '-panel'); if (panel) panel.hidden = key !== name; });
}
function createPlanFromCase(item) {
  selectPlannerTab('case');
  const message = q('#selected-case-message');
  if (message) message.textContent = '選択中：' + item.title;
  renderPlan({ ...item, planSource: 'case', problemCategories: [item.problemCategory], categories: item.categories || [] });
  const planner = q('#planner');
  if (planner) planner.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderCsvSummary(rows, issues, format) {
  const services = uniqueValues(issues.map(issue => issue.service));
  const roles = uniqueValues(issues.map(issue => issue.role));
  const themeCounts = {};
  issues.forEach(issue => { const key = issue.problemCategory || issue.theme; if (key) themeCounts[key] = (themeCounts[key] || 0) + 1; });
  const cards = [
    ['読込形式', format.label],
    ['回答件数', rows.length + '件'],
    ['課題カード件数', issues.length + '件'],
    ['事業所', format.type === 'new' ? '未入力' : uniqueValues(issues.map(issue => issue.office)).join('、') || '未入力'],
    ['事業所種別', services.join('、') || '未入力'],
    ['回答者の立場', roles.join('、') || '未入力']
  ];
  const summary = q('#csv-summary');
  summary.hidden = false;
  summary.replaceChildren(...cards.map(([heading, value]) => {
    const card = document.createElement('div');
    card.className = 'summary-card';
    const strong = document.createElement('strong');
    strong.textContent = heading;
    const p = document.createElement('p');
    p.textContent = value;
    card.append(strong, p);
    return card;
  }));
  const themes = document.createElement('div');
  themes.className = 'summary-card';
  themes.style.gridColumn = '1/-1';
  const label = document.createElement('span');
  label.textContent = 'テーマ別集計';
  const text = document.createElement('p');
  text.textContent = Object.entries(themeCounts).map(([key, value]) => key + ' ' + value + '件').join(' / ') || '未入力';
  themes.append(label, text);
  summary.append(themes);
  if (format.type === 'new') {
    const notice = document.createElement('div');
    notice.className = 'summary-card';
    notice.style.gridColumn = '1/-1';
    const noticeLabel = document.createElement('span');
    noticeLabel.textContent = '注意書き';
    const noticeText = document.createElement('p');
    noticeText.textContent = NEW_CSV_NOTICE;
    notice.append(noticeLabel, noticeText);
    summary.append(notice);
  }
}
function renderCausalDraftSection(issues) {
  const issueList = q('#csv-issue-list');
  const section = q('#causal-draft');
  if (!issueList || !section) return;
  issueList.insertAdjacentElement('afterend', section);
  renderCausalStructure(issues);
}
function issueCardFields(issue) {
  return issue.csvFormat === 'new'
    ? [['サービス種別', issue.service], ['回答者の立場', issue.role], ['困りごと分類', issue.problemCategory], ['頻度', issue.frequency], ['起きる場面', issue.timing], ['起きる場所', issue.location], ['困っていること', issue.impact], ['継続期間', issue.duration]]
    : [['今の困りごと', issue.currentItems], ['現状の一言', issue.current], ['ありたい姿', issue.desired], ['一番大きいギャップ', issue.gap], ['解決された状態', issue.resolved], ['解決方向性', issue.direction]];
}
function issueMetaParts(issue) {
  return issue.csvFormat === 'new'
    ? [displayValue(issue.service), displayValue(issue.role), displayValue(issue.problemCategory)]
    : [displayValue(issue.office), displayValue(issue.service), displayValue(issue.theme)];
}
function renderIssueCards(issues) {
  const list = q('#csv-issue-list');
  list.replaceChildren(...issues.map(issue => {
    const card = document.createElement('article');
    card.className = 'issue-card';
    const head = document.createElement('div');
    head.className = 'issue-card-head';
    const title = document.createElement('h4');
    title.textContent = issue.title;
    const score = document.createElement('span');
    score.className = 'priority-score';
    score.textContent = '優先度 ' + issue.priorityScore;
    head.append(title, score);
    const meta = document.createElement('p');
    meta.className = 'issue-meta';
    meta.textContent = issueMetaParts(issue).join(' / ');
    const grid = document.createElement('div');
    grid.className = 'issue-grid';
    issueCardFields(issue).forEach(([heading, value]) => {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = heading + '：';
      p.append(strong, document.createTextNode(displayValue(value)));
      grid.append(p);
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'issue-plan-button';
    button.textContent = issue.csvFormat === 'new' ? '追加確認が必要な計画案を作る' : 'この課題の計画案を作る';
    button.addEventListener('click', () => renderPlan(issue));
    card.append(head, meta, grid, button);
    return card;
  }));
  renderCausalDraftSection(issues);
}
function handleCsvLoaded(text) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error('empty csv');
  const format = detectCsvFormat(rows);
  if (format.type === 'unknown') throw new Error('unknown csv');
  csvIssues = calculateCsvIssues(rows, format);
  const status = q('#csv-status');
  status.textContent = rows.length + '件を読み込み、' + csvIssues.length + '件の課題カードを作成しました。読込形式：' + format.label + '。';
  renderCsvSummary(rows, csvIssues, format);
  renderIssueCards(csvIssues);
  status.textContent += ' 因果関係図のたたき台を表示しました。';
}

bind('#search-form', 'submit', event => {
  event.preventDefault();
  state.query = q('#search-input').value.trim();
  render();
  const title = q('#library-title');
  if (title) title.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
bind('#search-input', 'input', event => { state.query = event.target.value.trim(); render(); });
bind('#sort-select', 'change', event => { state.sort = event.target.value; render(); });
bind('#reset-button', 'click', reset);
bind('#empty-reset', 'click', reset);
bind('#dialog-close', 'click', () => dialog.close());
if (dialog) dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
bind('#evidence-dialog-close', 'click', () => q('#causal-evidence-dialog').close());
const evidenceDialog = q('#causal-evidence-dialog');
if (evidenceDialog) evidenceDialog.addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
bind('#copy-causal-layers', 'click', event => copyTextContent(latestCausalCopyText.layers, event.currentTarget, '4層整理をコピー'));
bind('#copy-long-term', 'click', event => copyTextContent(latestCausalCopyText.longTerm, event.currentTarget, '中長期課題候補をコピー'));
bind('#copy-interview-questions', 'click', event => copyTextContent(latestCausalCopyText.questions, event.currentTarget, '追加確認質問をコピー'));
document.querySelectorAll('.planner-tab').forEach(button => button.addEventListener('click', () => selectPlannerTab(button.dataset.plannerTab)));
const manualCategory = q('#manual-plan-form select[name=problemCategory]');
if (manualCategory) PROBLEM_CATEGORIES.forEach(value => {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value;
  manualCategory.append(option);
});
bind('#problem-csv-input', 'change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { handleCsvLoaded(String(reader.result)); }
    catch (error) { q('#csv-status').textContent = 'CSVを読み取れませんでした。見出しと文字コード（UTF-8）を確認してください。'; }
  };
  reader.readAsText(file, 'UTF-8');
});
bind('#manual-plan-form', 'submit', event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  renderPlan({
    title: values.title,
    current: values.current,
    desired: values.desired,
    problemCategories: [values.problemCategory],
    categories: mapByIncludes(values.direction, DIRECTION_CATEGORY_MAP),
    direction: values.direction,
    service: values.service,
    keywords: values.keywords,
    priorityReason: '手入力された課題をもとに、分類・方向性・キーワードが近い事例を優先'
  });
});
loadCases();
