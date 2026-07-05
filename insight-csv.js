/*
 * 問題虫めがね「気づきシート集計表」CSV対応
 * 対応列:
 * - 課題の発生場面（いつ）
 * - 課題の発生場面（どこで）
 * - 課題や気づきの内容
 * - 困りごと
 */

const INSIGHT_CSV_FORMAT = {
  type: 'insight',
  label: '問題虫めがね 気づきシート集計表CSV'
};
const INSIGHT_CSV_NOTICE = '気づきシート集計表には、サービス種別、回答者の立場、直接原因、背景要因、ありたい姿、解決方向性、実施する取組、成果指標は含まれていません。課題の把握と追加確認事項の整理に使用してください。';

function isInsightCsvIssue(issue) {
  return issue?.csvSourceType === 'insight';
}

function insightCsvValue(row, ...parts) {
  return valueByHeader(row, ...parts);
}

function isInsightCsvHeaders(rows) {
  const headers = Object.keys(rows[0] || {}).map(normalizeHeader);
  const includesParts = (...parts) => {
    const targets = parts.map(normalizeHeader);
    return headers.some(header => targets.every(target => header.includes(target)));
  };
  return includesParts('課題の発生場面', 'いつ')
    && includesParts('課題の発生場面', 'どこで')
    && includesParts('課題や気づきの内容')
    && includesParts('困りごと');
}

const detectCsvFormatBeforeInsight = detectCsvFormat;
detectCsvFormat = function detectCsvFormatIncludingInsight(rows) {
  if (isInsightCsvHeaders(rows)) return INSIGHT_CSV_FORMAT;
  return detectCsvFormatBeforeInsight(rows);
};

function insightTimingScore(value) {
  const text = String(value || '');
  if (/常に|いつも|毎日|毎回|頻繁|よく/.test(text)) return 4;
  if (/週|時々|ときどき|しばしば/.test(text)) return 2;
  if (/まれ|たまに/.test(text)) return 1;
  return 0;
}

function insightRiskScore(value) {
  const text = String(value || '');
  let score = 0;
  if (/事故|誤配|誤薬|服薬|転倒|安全|感染|漏れ|見守り|個人情報/.test(text)) score += 4;
  if (/残業|負担|人手|時間がかか|忙し|休憩/.test(text)) score += 2;
  return Math.min(score, 6);
}

function insightPriorityReason(issue, sameCategory) {
  const details = [];
  if (issue.timing) details.push('発生場面（いつ）が「' + issue.timing + '」');
  if (issue.location) details.push('発生場所が「' + issue.location + '」');
  if (sameCategory > 1) details.push('同じ困りごと分類の回答が' + sameCategory + '件ある');
  if (insightRiskScore(issue.selectedProblem) > 0) details.push('安全性や職員負担に関する記載が含まれる');
  if (!details.length) return '課題や気づきの内容が入力されているため、追加確認の対象として整理しています。';
  return details.join('、') + 'ため、管理者・活動推進リーダーと優先度を確認する候補です。';
}

function calculateInsightCsvIssues(rows) {
  const raw = rows.map((row, index) => {
    const timing = insightCsvValue(row, '課題の発生場面', 'いつ');
    const location = insightCsvValue(row, '課題の発生場面', 'どこで');
    const content = insightCsvValue(row, '課題や気づきの内容');
    const problemCategory = insightCsvValue(row, '困りごと');
    const issueForCategory = {
      problemCategory,
      selectedProblem: content,
      impact: content,
      timing,
      location
    };
    return {
      id: index + 1,
      csvFormat: 'new',
      csvSourceType: 'insight',
      csvFormatLabel: INSIGHT_CSV_FORMAT.label,
      sourceRow: index + 1,
      office: '',
      facilityName: '',
      businessName: '',
      service: '',
      role: '',
      theme: problemCategory,
      problemCategory,
      problemCategories: PROBLEM_CATEGORIES.includes(problemCategory) ? [problemCategory] : [],
      selectedProblem: content,
      title: content || '未入力の気づき',
      currentItems: content,
      current: [
        timing ? '発生場面（いつ）：' + timing : '',
        location ? '発生場所：' + location : '',
        content ? '課題や気づき：' + content : ''
      ].filter(Boolean).join('\n'),
      frequency: '',
      timing,
      location,
      impact: '',
      duration: '',
      desired: NEW_CSV_UNCONFIRMED.desired,
      gap: '',
      resolved: NEW_CSV_UNCONFIRMED.resolved,
      direction: NEW_CSV_UNCONFIRMED.direction,
      action: NEW_CSV_UNCONFIRMED.action,
      metric: NEW_CSV_UNCONFIRMED.metric,
      categories: categoriesFromNewCsvIssue(issueForCategory),
      keywords: [problemCategory, content, timing, location].filter(Boolean).join(' ')
    };
  }).filter(issue => issue.selectedProblem);

  const categoryCounts = {};
  raw.forEach(issue => {
    const key = issue.problemCategory || '未分類';
    categoryCounts[key] = (categoryCounts[key] || 0) + 1;
  });

  return raw.map(issue => {
    const sameCategory = categoryCounts[issue.problemCategory || '未分類'] || 1;
    const priorityScore = 5
      + Math.min(sameCategory, 10)
      + insightTimingScore(issue.timing)
      + insightRiskScore(issue.selectedProblem);
    return {
      ...issue,
      priorityScore,
      priorityReason: insightPriorityReason(issue, sameCategory)
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore || a.id - b.id);
}

const calculateCsvIssuesBeforeInsight = calculateCsvIssues;
calculateCsvIssues = function calculateCsvIssuesIncludingInsight(rows, format = detectCsvFormat(rows)) {
  if (format.type === INSIGHT_CSV_FORMAT.type) return calculateInsightCsvIssues(rows);
  return calculateCsvIssuesBeforeInsight(rows, format);
};

const renderCsvSummaryBeforeInsight = renderCsvSummary;
renderCsvSummary = function renderCsvSummaryIncludingInsight(rows, issues, format) {
  if (format.type !== INSIGHT_CSV_FORMAT.type) {
    renderCsvSummaryBeforeInsight(rows, issues, format);
    return;
  }

  const categoryCounts = {};
  issues.forEach(issue => {
    const key = issue.problemCategory || '未分類';
    categoryCounts[key] = (categoryCounts[key] || 0) + 1;
  });
  const timingBlank = issues.filter(issue => !issue.timing).length;
  const locationBlank = issues.filter(issue => !issue.location).length;
  const cards = [
    ['読込形式', format.label],
    ['回答件数', rows.length + '件'],
    ['課題カード件数', issues.length + '件'],
    ['困りごと分類', Object.keys(categoryCounts).length + '種類'],
    ['発生場面の空欄', timingBlank + '件'],
    ['発生場所の空欄', locationBlank + '件']
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
  const themeLabel = document.createElement('span');
  themeLabel.textContent = '困りごと別集計';
  const themeText = document.createElement('p');
  themeText.textContent = Object.entries(categoryCounts)
    .map(([key, value]) => key + ' ' + value + '件')
    .join(' / ') || '未入力';
  themes.append(themeLabel, themeText);
  summary.append(themes);

  const notice = document.createElement('div');
  notice.className = 'summary-card';
  notice.style.gridColumn = '1/-1';
  const noticeLabel = document.createElement('span');
  noticeLabel.textContent = '注意書き';
  const noticeText = document.createElement('p');
  noticeText.textContent = INSIGHT_CSV_NOTICE;
  notice.append(noticeLabel, noticeText);
  summary.append(notice);
};

const issueCardFieldsBeforeInsight = issueCardFields;
issueCardFields = function issueCardFieldsIncludingInsight(issue) {
  if (isInsightCsvIssue(issue)) {
    return [
      ['困りごと分類', issue.problemCategory],
      ['課題の発生場面（いつ）', issue.timing],
      ['課題の発生場面（どこで）', issue.location]
    ];
  }
  return issueCardFieldsBeforeInsight(issue);
};

const issueMetaPartsBeforeInsight = issueMetaParts;
issueMetaParts = function issueMetaPartsIncludingInsight(issue) {
  if (isInsightCsvIssue(issue)) {
    return [
      displayValue(issue.problemCategory),
      issue.timing ? 'いつ：' + issue.timing : 'いつ：未入力',
      issue.location ? 'どこで：' + issue.location : 'どこで：未入力'
    ];
  }
  return issueMetaPartsBeforeInsight(issue);
};

const evidenceFieldsBeforeInsight = evidenceFields;
evidenceFields = function evidenceFieldsIncludingInsight(issue) {
  if (isInsightCsvIssue(issue)) {
    return [
      ['困りごと分類', issue.problemCategory],
      ['課題の発生場面（いつ）', issue.timing],
      ['課題の発生場面（どこで）', issue.location],
      ['課題や気づきの内容', issue.selectedProblem]
    ];
  }
  return evidenceFieldsBeforeInsight(issue);
};

const nodeAnswerLinesBeforeInsight = nodeAnswerLines;
nodeAnswerLines = function nodeAnswerLinesIncludingInsight(node) {
  if (node.issues?.some(isInsightCsvIssue)) {
    const definitions = [
      ['課題や気づき', 'selectedProblem'],
      ['発生場面（いつ）', 'timing'],
      ['発生場所', 'location']
    ];
    return definitions.flatMap(([label, key]) =>
      uniqueValues(node.issues.map(issue => issue[key]))
        .slice(0, 2)
        .map(value => label + '：' + value)
    );
  }
  return nodeAnswerLinesBeforeInsight(node);
};

const newCsvKnownTextBeforeInsight = newCsvKnownText;
newCsvKnownText = function newCsvKnownTextIncludingInsight(issue) {
  if (isInsightCsvIssue(issue)) {
    return [
      '課題や気づき：' + displayValue(issue.selectedProblem),
      '困りごと分類：' + displayValue(issue.problemCategory),
      '課題の発生場面（いつ）：' + displayValue(issue.timing),
      '課題の発生場面（どこで）：' + displayValue(issue.location)
    ].join('\n');
  }
  return newCsvKnownTextBeforeInsight(issue);
};

function insightConfirmationQuestions() {
  return [
    'この気づきが起きる直接の原因は何だと考えますか。',
    '背景にある体制・ルール・教育・環境上の要因はありますか。',
    'この課題によって、職員・利用者・業務にどのような影響が出ていますか。',
    'どのような状態になれば解決したと言えますか。',
    '最初に試す取組を、誰が、いつから、どの範囲で行いますか。',
    '成果を何で確認しますか。'
  ].join('\n');
}

const buildPlanBeforeInsight = buildPlan;
buildPlan = function buildPlanIncludingInsight(issue) {
  if (!isInsightCsvIssue(issue)) return buildPlanBeforeInsight(issue);

  const related = findRelatedCases(issue, 5);
  return {
    title: '改善計画作成前の確認メモ',
    copyLabel: '確認メモをコピー',
    issue,
    related,
    relatedHeading: '参考候補',
    showRelated: true,
    fields: [
      ['このCSVから分かる課題', newCsvKnownText(issue)],
      ['追加確認の優先度を考える理由', issue.priorityReason],
      ['未確認項目', unconfirmedItemsText()],
      ['関連する参考事例', related.length
        ? related.map((item, index) => (index + 1) + '. ' + item.title + '（' + item.service + ' / ' + item.problemCategory + '）').join('\n')
        : '入力内容と十分に近い事例は見つかりませんでした。困りごと分類や課題内容を確認してください。'],
      ['管理者・活動推進リーダーに確認すべき事項', insightConfirmationQuestions()],
      ['注意点', INSIGHT_CSV_NOTICE]
    ]
  };
};

const buildCausalStructureBeforeInsight = buildCausalStructure;
buildCausalStructure = function buildCausalStructureIncludingInsight(issues) {
  if (!issues.some(isInsightCsvIssue)) return buildCausalStructureBeforeInsight(issues);

  const raw = { background: [], direct: [], field: [], risk: [] };
  issues.forEach(issue => {
    const issueName = conciseNodeName(issue.selectedProblem, 'この課題');
    raw.background.push({ name: '「' + issueName + '」の背景要因は追加確認が必要', issue });
    raw.direct.push({ name: '「' + issueName + '」の直接原因は追加確認が必要', issue });
    raw.field.push({ name: issueName, issue });
    raw.risk.push({ name: '「' + issueName + '」による影響・リスクは追加確認が必要', issue });
  });

  const layers = {};
  CAUSAL_LAYERS.forEach(layer => {
    layers[layer.key] = groupNodes(raw[layer.key]);
  });

  return {
    layers,
    shortTerm: layers.field.slice(0, 5),
    longTerm: [...layers.background, ...layers.direct].slice(0, 8),
    confirmationPoints: [
      '直接原因は気づきシートから確定できません。',
      '背景要因は気づきシートから確定できません。',
      '職員・利用者・業務への影響は未確認です。',
      'ありたい姿と解決された状態は未確認です。',
      '解決方向性、実施する取組、成果指標は未確認です。'
    ],
    interviewQuestions: insightConfirmationQuestions().split('\n')
  };
};

const nodeReasonTextBeforeInsight = nodeReasonText;
nodeReasonText = function nodeReasonTextIncludingInsight(node) {
  if (node.issues?.some(isInsightCsvIssue)) {
    if (node.layer === 'background') return '気づきシートには背景要因を確認する項目がないため、追加確認が必要な項目として整理しました。';
    if (node.layer === 'direct') return '気づきシートには直接原因を確認する項目がないため、追加確認が必要な項目として整理しました。';
    if (node.layer === 'field') return '気づきシートの「課題や気づきの内容」を、現場で起きている困りごととして整理しました。';
    if (node.layer === 'risk') return '気づきシートには影響・リスクを確認する項目がないため、追加確認が必要な項目として整理しました。';
  }
  return nodeReasonTextBeforeInsight(node);
};
