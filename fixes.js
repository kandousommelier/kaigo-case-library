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
