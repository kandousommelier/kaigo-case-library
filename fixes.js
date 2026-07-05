/*
 * 介護の事例ライブラリー 緊急修正
 * 1. 未精査事例の区別
 * 2. 関連度0点事例の除外
 * 3. 新版CSVにない直接原因を断定しない
 * 4. CSV読込エラー時に前回結果を消去
 */

function isUnreviewedCase(item) {
  const note = String(item?.sourceNote || '');
  return /未精査|簡易カード|詳細ページの精査は後続/.test(note);
}

function createVerificationBadge(item, className = 'case-verification-badge') {
  const badge = document.createElement('span');
  const unreviewed = isUnreviewedCase(item);
  badge.className = className + (unreviewed ? ' is-unreviewed' : ' is-verified');
  badge.textContent = unreviewed ? '概要のみ・詳細未確認' : '個別PDF確認済み';
  return badge;
}

const createCardBeforeVerificationFix = createCard;
createCard = function createCardWithVerification(item) {
  const card = createCardBeforeVerificationFix(item);
  card.classList.toggle('is-unreviewed-case', isUnreviewedCase(item));
  const topLine = card.querySelector('.card-topline');
  if (topLine) topLine.insertAdjacentElement('afterend', createVerificationBadge(item));
  return card;
};

const openDetailBeforeVerificationFix = openDetail;
openDetail = function openDetailWithVerification(item) {
  openDetailBeforeVerificationFix(item);
  const content = q('#dialog-content');
  const source = content?.querySelector('.dialog-source');
  if (!content || !source) return;

  const notice = document.createElement('div');
  const unreviewed = isUnreviewedCase(item);
  notice.className = 'case-verification-notice' + (unreviewed ? ' is-unreviewed' : ' is-verified');
  notice.append(createVerificationBadge(item, 'case-verification-badge'));

  const text = document.createElement('p');
  text.textContent = unreviewed
    ? 'この事例は資料の一覧・概要から作成した簡易カードです。取組内容や成果は、必ず出典資料で確認してください。'
    : 'この事例は個別の出典PDFと主要な表示内容を照合しています。詳細は出典資料もご確認ください。';
  notice.append(text);
  source.insertAdjacentElement('afterend', notice);
};

findRelatedCases = function findRelatedCasesExcludingZeroScore(issue, limit = 5) {
  const keywords = plannerTokens([
    issue.title,
    issue.current,
    issue.gap,
    issue.keywords,
    issue.problemCategory,
    issue.selectedProblem,
    issue.impact,
    issue.timing,
    issue.location,
    issue.service,
    issue.role
  ].join(' '));

  return state.cases
    .map(item => {
      const categories = item.categories || [];
      let score = 0;
      if (issue.problemCategories?.includes(item.problemCategory) || issue.problemCategory === item.problemCategory) score += 8;
      (issue.categories || []).forEach(category => {
        if (categories.includes(category)) score += 4;
      });
      if (issue.service && item.service && (item.service.includes(issue.service) || issue.service.includes(item.service))) score += 5;
      const hay = normalized([
        item.title,
        item.service,
        item.problemCategory,
        item.problemDetails,
        item.approach,
        item.outcome,
        item.tip,
        item.suitableFor,
        item.supportUse,
        ...categories
      ].join(' '));
      keywords.forEach(keyword => {
        if (hay.includes(normalized(keyword))) score += 2;
      });
      return { item, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.item.id - b.item.id)
    .slice(0, limit)
    .map(result => result.item);
};

buildCausalStructure = function buildCausalStructureWithoutAssumedDirectCause(issues) {
  const raw = { background: [], direct: [], field: [], risk: [] };

  issues.forEach(issue => {
    if (issue.csvFormat === 'new') {
      const issueName = conciseNodeName(issue.selectedProblem, 'この課題');
      raw.background.push({ name: '背景要因は追加確認が必要', issue });
      raw.direct.push({ name: '「' + issueName + '」の直接原因は追加確認が必要', issue });
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
  CAUSAL_LAYERS.forEach(layer => {
    layers[layer.key] = groupNodes(raw[layer.key]);
  });

  return {
    layers,
    shortTerm: layers.field.slice(0, 5),
    longTerm: [...layers.background, ...layers.direct].slice(0, 8),
    confirmationPoints: [
      '背景要因はCSVから確定できません。',
      '直接原因はCSVから確定できません。',
      'ありたい姿が未確認です。',
      '解決された状態が未確認です。',
      '解決方向性が未確認です。',
      '実施する取組が未確認です。',
      '成果指標が未確認です。'
    ],
    interviewQuestions: [
      'この困りごとが起きる直接の原因は何だと考えますか。',
      'その原因の背景にある、体制・ルール・教育・環境上の要因はありますか。',
      'この課題について、どの状態になれば解決と言えますか。',
      '関連事例を参考にする場合、どの取組が自施設で試せそうですか。',
      '最初に試す範囲、担当者、期間はどうしますか。',
      '成果指標は何を使って確認しますか。'
    ]
  };
};


const nodeReasonTextBeforeDirectCauseFix = nodeReasonText;
nodeReasonText = function nodeReasonTextWithoutAssumption(node) {
  if (node.issues?.some(issue => issue.csvFormat === 'new')) {
    if (node.layer === 'direct') {
      return '新版CSVには直接原因を確認する設問がないため、追加確認が必要な項目として整理しました。';
    }
    if (node.layer === 'background') {
      return '新版CSVだけでは背景要因を確定できないため、追加確認が必要な項目として整理しました。';
    }
  }
  return nodeReasonTextBeforeDirectCauseFix(node);
};

function clearCsvAnalysisResults() {
  csvIssues = [];
  latestCausalCopyText = { layers: '', longTerm: '', questions: '' };

  const summary = q('#csv-summary');
  if (summary) {
    summary.replaceChildren();
    summary.hidden = true;
  }

  const issueList = q('#csv-issue-list');
  if (issueList) issueList.replaceChildren();

  const causalDraft = q('#causal-draft');
  if (causalDraft) {
    causalDraft.hidden = true;
    causalDraft.style.removeProperty('display');
  }

  ['#causal-layers', '#short-term-issues', '#long-term-issues', '#confirmation-points', '#interview-questions']
    .forEach(selector => {
      const node = q(selector);
      if (node) node.replaceChildren();
    });

  const planOutput = q('#plan-output');
  if (planOutput) {
    planOutput.replaceChildren();
    planOutput.hidden = true;
  }
}

handleCsvLoaded = function handleCsvLoadedWithReset(text) {
  clearCsvAnalysisResults();
  const status = q('#csv-status');
  if (status) status.textContent = 'CSVを確認しています。';

  const rows = parseCSV(text);
  if (!rows.length) throw new Error('empty csv');

  const format = detectCsvFormat(rows);
  if (format.type === 'unknown') throw new Error('unknown csv');

  csvIssues = calculateCsvIssues(rows, format);
  if (status) {
    status.textContent = rows.length + '件を読み込み、' + csvIssues.length + '件の課題カードを作成しました。読込形式：' + format.label + '。';
  }
  renderCsvSummary(rows, csvIssues, format);
  renderIssueCards(csvIssues);
  if (status) status.textContent += ' 因果関係図のたたき台を表示しました。';
};


const csvInputForReset = q('#problem-csv-input');
if (csvInputForReset) {
  csvInputForReset.addEventListener('change', () => {
    clearCsvAnalysisResults();
    const status = q('#csv-status');
    if (status) status.textContent = 'CSVを確認しています。';
  }, { capture: true });
}

/*
 * 5. 「気づきシート集計表.csv」を第3の読込形式として追加
 */

const INSIGHT_CSV_FORMAT = { type: 'insight', label: '気づきシート集計表CSV' };
const INSIGHT_CSV_NOTICE = '気づきシート集計表には、事業所種別・回答者の立場・発生頻度・継続期間・ありたい姿・解決状態・解決方向性・実施する取組・成果指標は含まれていません。入力された発生場面・場所・気づき内容・困りごと分類をもとに、課題候補と追加確認事項を整理します。';
CSV_FORMATS.insight = INSIGHT_CSV_FORMAT;

function isInsightCsvIssue(issue) {
  return issue?.sourceCsvFormat === 'insight';
}

function insightCsvValue(row, ...parts) {
  return valueByHeader(row, ...parts);
}

function hasInsightCsvHeaders(row) {
  const headers = Object.keys(row || {}).map(normalizeHeader);
  const hasWhen = headers.some(header => header.includes(normalizeHeader('課題の発生場面')) && header.includes(normalizeHeader('いつ')));
  const hasWhere = headers.some(header => header.includes(normalizeHeader('課題の発生場面')) && header.includes(normalizeHeader('どこで')));
  const hasContent = headers.some(header => header.includes(normalizeHeader('課題や気づきの内容')));
  const hasProblem = headers.some(header => header === normalizeHeader('困りごと') || header.includes(normalizeHeader('困りごと')));
  return hasWhen && hasWhere && hasContent && hasProblem;
}

const detectCsvFormatBeforeInsightCsvFix = detectCsvFormat;
detectCsvFormat = function detectCsvFormatWithInsightSheet(rows) {
  if (hasInsightCsvHeaders(rows[0])) return CSV_FORMATS.insight;
  return detectCsvFormatBeforeInsightCsvFix(rows);
};

function categoriesFromInsightCsvIssue(issue) {
  const categories = categoriesFromNewCsvIssue(issue);
  const text = [issue.problemCategory, issue.selectedProblem, issue.timing, issue.location].join(' ');
  if (/ICT|ＰＣ|PC|パソコン|タブレット|Tablet|システム|データ/.test(text)) addUnique(categories, ['ICT活用']);
  if (/危険|事故|転倒|感染|出血|誤配|ブレーキ|安全|ヒヤリ/.test(text)) addUnique(categories, ['安全な介護']);
  if (/統一|ばらつき|やり方が違|ルール|手順|申し送り/.test(text)) addUnique(categories, ['標準化']);
  if (/教育|人材|若いスタッフ|会議|目標|改善/.test(text)) addUnique(categories, ['人材育成', '改善活動']);
  if (/人手不足|業務過多|偏り|勤務時間|時間外|残業|休憩|負担/.test(text)) addUnique(categories, ['業務の見直し', '役割分担']);
  return categories;
}

function insightRiskScore(value) {
  const text = String(value || '');
  let score = impactScore(text);
  if (/危険|事故|転倒|感染|出血|誤配|ブレーキ|安全|ヒヤリ/.test(text)) score += 4;
  if (/人手不足|業務過多|負担|疲|休憩|時間外|残業|ムリ/.test(text)) score += 3;
  if (/利用者|家族/.test(text)) score += 1;
  return Math.min(score, 10);
}

function insightPriorityReason(issue, sameCategory) {
  const details = ['同じ困りごと分類の気づきが' + sameCategory + '件ある'];
  if (!isUnconfirmedValue(issue.timing)) details.push('発生場面（いつ）が「' + issue.timing + '」');
  if (!isUnconfirmedValue(issue.location)) details.push('発生場所が「' + issue.location + '」');
  if (/危険|事故|転倒|感染|出血|誤配|安全|人手不足|業務過多|負担|時間外|残業/.test(issue.selectedProblem)) {
    details.push('安全面または職員負担に関する記述がある');
  }
  return details.join('、') + 'ため、追加確認の優先度が高い項目として整理しています。';
}

function insightCurrentText(issue) {
  return [
    ['発生場面（いつ）', issue.timing],
    ['発生場面（どこで）', issue.location],
    ['気づき内容', issue.selectedProblem],
    ['困りごと分類', issue.problemCategory]
  ].map(([label, value]) => label + '：' + displayValue(value)).join('\n');
}

function calculateInsightCsvIssues(rows) {
  const raw = rows.map((row, index) => {
    const timing = insightCsvValue(row, '課題の発生場面', 'いつ');
    const location = insightCsvValue(row, '課題の発生場面', 'どこで');
    const selectedProblem = insightCsvValue(row, '課題や気づきの内容');
    const problemCategory = insightCsvValue(row, '困りごと');
    const issue = {
      id: index + 1,
      csvFormat: 'new',
      sourceCsvFormat: 'insight',
      csvFormatLabel: CSV_FORMATS.insight.label,
      office: '',
      facilityName: '',
      businessName: '',
      sourceRow: index + 1,
      service: '',
      role: '',
      problemCategory,
      theme: problemCategory,
      selectedProblem,
      frequency: '',
      timing,
      location,
      impact: '',
      duration: ''
    };
    issue.title = selectedProblem || '未入力の気づき';
    issue.currentItems = selectedProblem;
    issue.current = insightCurrentText(issue);
    issue.desired = NEW_CSV_UNCONFIRMED.desired;
    issue.gap = '仮：' + (selectedProblem || '気づき内容の確認が必要');
    issue.resolved = NEW_CSV_UNCONFIRMED.resolved;
    issue.direction = NEW_CSV_UNCONFIRMED.direction;
    issue.action = NEW_CSV_UNCONFIRMED.action;
    issue.metric = NEW_CSV_UNCONFIRMED.metric;
    issue.problemCategories = problemCategory ? [problemCategory] : [];
    issue.categories = categoriesFromInsightCsvIssue(issue);
    issue.keywords = [problemCategory, selectedProblem, timing, location].filter(Boolean).join(' ');
    return issue;
  }).filter(issue => issue.problemCategory && issue.selectedProblem);

  const categoryCounts = {};
  raw.forEach(issue => {
    categoryCounts[issue.problemCategory] = (categoryCounts[issue.problemCategory] || 0) + 1;
  });

  return raw.map(issue => {
    const sameCategory = categoryCounts[issue.problemCategory] || 1;
    const score = Math.round(
      Math.min(sameCategory, 10) * 1.5
      + scoredValue(issue.timing, frequencyScore)
      + insightRiskScore(issue.selectedProblem)
    );
    return {
      ...issue,
      priorityScore: score,
      priorityReason: insightPriorityReason(issue, sameCategory)
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore || a.id - b.id);
}

const calculateCsvIssuesBeforeInsightCsvFix = calculateCsvIssues;
calculateCsvIssues = function calculateCsvIssuesWithInsightSheet(rows, format = detectCsvFormat(rows)) {
  if (format.type === 'insight') return calculateInsightCsvIssues(rows);
  return calculateCsvIssuesBeforeInsightCsvFix(rows, format);
};

const newCsvKnownTextBeforeInsightCsvFix = newCsvKnownText;
newCsvKnownText = function newCsvKnownTextWithInsightSheet(issue) {
  if (!isInsightCsvIssue(issue)) return newCsvKnownTextBeforeInsightCsvFix(issue);
  return [
    '気づき内容：' + displayValue(issue.selectedProblem),
    '困りごと分類：' + displayValue(issue.problemCategory),
    '発生場面（いつ）：' + displayValue(issue.timing),
    '発生場面（どこで）：' + displayValue(issue.location)
  ].join('\n');
};

function insightUnconfirmedItemsText() {
  return [
    '事業所種別：' + UNCONFIRMED_TEXT,
    '回答者の立場：' + UNCONFIRMED_TEXT,
    '発生頻度：' + UNCONFIRMED_TEXT,
    '継続期間：' + UNCONFIRMED_TEXT,
    unconfirmedItemsText()
  ].join('\n');
}

function insightConfirmationQuestions() {
  return [
    'この気づきは、どのくらいの頻度で起きていますか。',
    'いつ頃から続いていますか。',
    'この困りごとが起きる直接の原因は何だと考えますか。',
    'その原因の背景にある、体制・ルール・教育・環境上の要因はありますか。',
    'どの状態になれば解決したと言えますか。',
    '最初に試す取組を、誰が・いつから・どの範囲で行いますか。',
    '成果指標は何を、いつ、どの方法で確認しますか。'
  ].join('\n');
}

const buildPlanBeforeInsightCsvFix = buildPlan;
buildPlan = function buildPlanWithInsightSheet(issue) {
  if (!isInsightCsvIssue(issue)) return buildPlanBeforeInsightCsvFix(issue);
  const related = findRelatedCases(issue, 5);
  return {
    title: '気づきシートの確認メモ',
    copyLabel: '確認メモをコピー',
    issue,
    related,
    relatedHeading: '参考候補',
    showRelated: true,
    fields: [
      ['このCSVから分かる気づき', newCsvKnownText(issue)],
      ['追加確認の優先度が高い理由', issue.priorityReason],
      ['未確認項目', insightUnconfirmedItemsText()],
      ['関連する参考事例', related.length ? related.map((item, index) => (index + 1) + '. ' + item.title + '（' + item.service + ' / ' + item.problemCategory + '）').join('\n') : '関連する参考候補は、管理者・活動推進リーダーへの確認後に再検索してください。'],
      ['管理者・活動推進リーダーに確認すべき事項', insightConfirmationQuestions()],
      ['注意点', INSIGHT_CSV_NOTICE]
    ]
  };
};

const renderCsvSummaryBeforeInsightCsvFix = renderCsvSummary;
renderCsvSummary = function renderCsvSummaryWithInsightSheet(rows, issues, format) {
  renderCsvSummaryBeforeInsightCsvFix(rows, issues, format);
  if (format.type !== 'insight') return;
  const summary = q('#csv-summary');
  if (!summary) return;
  const notice = document.createElement('div');
  notice.className = 'summary-card';
  notice.style.gridColumn = '1/-1';
  const label = document.createElement('span');
  label.textContent = '注意書き';
  const text = document.createElement('p');
  text.textContent = INSIGHT_CSV_NOTICE;
  notice.append(label, text);
  summary.append(notice);
};

const issueCardFieldsBeforeInsightCsvFix = issueCardFields;
issueCardFields = function issueCardFieldsWithInsightSheet(issue) {
  if (!isInsightCsvIssue(issue)) return issueCardFieldsBeforeInsightCsvFix(issue);
  return [
    ['気づき内容', issue.selectedProblem],
    ['困りごと分類', issue.problemCategory],
    ['発生場面（いつ）', issue.timing],
    ['発生場面（どこで）', issue.location]
  ];
};

const issueMetaPartsBeforeInsightCsvFix = issueMetaParts;
issueMetaParts = function issueMetaPartsWithInsightSheet(issue) {
  if (!isInsightCsvIssue(issue)) return issueMetaPartsBeforeInsightCsvFix(issue);
  return [displayValue(issue.problemCategory), displayValue(issue.timing), displayValue(issue.location)];
};

const evidenceFieldsBeforeInsightCsvFix = evidenceFields;
evidenceFields = function evidenceFieldsWithInsightSheet(issue) {
  if (!isInsightCsvIssue(issue)) return evidenceFieldsBeforeInsightCsvFix(issue);
  return [
    ['困りごと分類', issue.problemCategory],
    ['気づき内容', issue.selectedProblem],
    ['発生場面（いつ）', issue.timing],
    ['発生場面（どこで）', issue.location]
  ];
};

const nodeAnswerLinesBeforeInsightCsvFix = nodeAnswerLines;
nodeAnswerLines = function nodeAnswerLinesWithInsightSheet(node) {
  if (!node.issues?.some(isInsightCsvIssue)) return nodeAnswerLinesBeforeInsightCsvFix(node);
  const definitions = [
    ['気づき内容', 'selectedProblem'],
    ['発生場面（いつ）', 'timing'],
    ['発生場面（どこで）', 'location'],
    ['困りごと分類', 'problemCategory']
  ];
  return definitions.flatMap(([label, key]) => uniqueValues(node.issues.map(issue => issue[key])).slice(0, 2).map(value => label + '：' + value));
};

const nodeReasonTextBeforeInsightCsvFix = nodeReasonText;
nodeReasonText = function nodeReasonTextWithInsightSheet(node) {
  if (!node.issues?.some(isInsightCsvIssue)) return nodeReasonTextBeforeInsightCsvFix(node);
  if (node.layer === 'direct') return '気づきシート集計表には直接原因を確認する欄がないため、追加確認が必要な項目として整理しました。';
  if (node.layer === 'background') return '気づきシート集計表だけでは背景要因を確定できないため、追加確認が必要な項目として整理しました。';
  if (node.layer === 'field') return '入力された気づき内容・発生場面・場所を、現場で起きている困りごとの要点として整理しました。';
  if (node.layer === 'risk') return '困りごと分類と気づき内容から、確認すべき影響・リスク候補として整理しました。実際に発生している影響は追加確認が必要です。';
  return nodeReasonTextBeforeInsightCsvFix(node);
};
