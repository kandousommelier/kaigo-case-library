/*
 * 気づきシート集計表CSVの因果関係図を、4層それぞれの役割で整理する補正。
 * insight-csv.js の後に読み込む。
 */

const INSIGHT_CAUSE_CONFIRMATION = '直接原因：追加確認が必要';
const INSIGHT_RISK_BY_CATEGORY = {
  '物を探すこと、準備、片付け、移動': '探す・準備・片付け・移動の手間や時間が増える可能性',
  '仕事の流れ、誰が何をするか、仕事の偏り': '業務の滞り、役割の偏り、職員負担につながる可能性',
  '記録や書類の作成': '記録作成の負担、記録の遅れや漏れにつながる可能性',
  '連絡、申し送り、みんなに伝えること': '伝達漏れや認識のずれにつながる可能性',
  '目標の共有や改善活動': '改善活動が進みにくく、取組が定着しにくい可能性'
};

function insightCompactText(value) {
  return String(value || '').replace(/[\s　]+/g, ' ').trim();
}

function insightTimingGroup(value) {
  const text = insightCompactText(value);
  if (!text) return '';
  if (/入浴|特浴|おふろ|浴槽/.test(text)) return '入浴・特浴時';
  if (/申し送り|朝礼|会議/.test(text)) return '申し送り・会議時';
  if (/送迎|訪問|来訪|入所受け|家族来訪/.test(text)) return '送迎・来訪・受入時';
  if (/記録|アンケート|回答時|結果通知/.test(text)) return '記録・回答時';
  if (/離床|体位変換|オムツ|シーツ|更衣|夕食後/.test(text)) return 'ケア実施時';
  if (/朝|就業前|始業前|開始前|来所時/.test(text)) return '朝・業務開始前後';
  if (/いつも|常に|日常的|業務中|就業中|日勤|時間に関係なく/.test(text)) return '日常的・常時';
  return text;
}

function insightLocationGroup(value) {
  const text = insightCompactText(value);
  if (!text) return '';
  if (/浴室|特浴室|おふろ|浴槽/.test(text)) return '浴室・特浴室';
  if (/フロア|ホール|食堂/.test(text)) return 'フロア・ホール等';
  if (/玄関|下駄箱|通用口/.test(text)) return '玄関・出入口';
  if (/部署|サービスステーション|従事部署/.test(text)) return '各部署・ステーション';
  if (/居室|ベッド/.test(text)) return '居室・ベッド周辺';
  return text;
}

function insightExplicitCause(issue) {
  const text = insightCompactText(issue?.selectedProblem);
  if (!text) return '';

  const canonicalRules = [
    [/人手不足|人員不足|スタッフ不足|職員不足|人員が足りず|スタッフの手が足り/, '人手・人員不足'],
    [/(?:PC|パソコン|タブレット|tablet|端末)[^。]{0,24}(?:不足|足りない|足りず)/i, 'PC・タブレット等の不足'],
    [/車両を共有している|車両の共有/, '車両を共有している'],
    [/(?:各フロア|部署)[^。]{0,28}やり方が違/, 'フロア・部署ごとにやり方が違う'],
    [/準備[^。]{0,18}時間がかかる|準備時間がかかる/, '準備に時間がかかる'],
    [/準備のため[^。]{0,18}早く出勤/, '準備のため早出が必要'],
    [/業務量[^。]{0,24}多すぎ|業務過多(?!なのでしょうか)/, '業務量が多すぎる'],
    [/収納スペース[^。]{0,16}(?:足りない|不足)/, '収納スペースが足りない'],
    [/休憩できる場所がない/, '休憩できる場所がない'],
    [/受付場所[^。]{0,24}離れている/, '受付場所が離れている'],
    [/一部職員に偏っている/, '業務が一部職員に偏っている'],
    [/業務開始時間[^。]{0,36}バラバラ/, '業務開始時間が統一されていない'],
    [/ベッドを壁付けしている/, 'ベッドを壁付けしている'],
    [/申し送りが送られていない/, '申し送りが送られていない'],
    [/連絡系統が不透明/, '連絡系統が不透明']
  ];
  const matchedRule = canonicalRules.find(([pattern]) => pattern.test(text));
  if (matchedRule) return matchedRule[1];

  const sentences = text.split(/[。！？!?]/).map(value => value.trim()).filter(Boolean);
  for (const sentence of sentences) {
    const patterns = [
      /([^、,]{2,64}?)(?:のため|ため)(?!に|なら)/,
      /([^、,]{2,64}?)ことから/,
      /([^、,]{2,64}?)(?:が|は)?足りず/
    ];
    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (!match) continue;
      let cause = insightCompactText(match[1]).replace(/^[・、,]+|[・、,]+$/g, '');
      if (!cause || cause.length < 4 || /(したい|してほしい|戻したい|防ぎたい|なくしたい|考えたい)$/.test(cause)) continue;
      if (cause.length > 48) cause = cause.slice(-48);
      return cause;
    }
  }
  return '';
}

function groupInsightCausalNodes(nodes, limit = 8) {
  const map = new Map();
  nodes.forEach(node => {
    const key = normalized(node.name);
    if (!key) return;
    if (!map.has(key)) map.set(key, { ...node, issues: [], order: map.size });
    map.get(key).issues.push(node.issue);
  });
  return [...map.values()]
    .sort((a, b) => b.issues.length - a.issues.length || a.order - b.order)
    .slice(0, limit);
}

function pushInsightTrend(raw, issues, type, label, valueGetter) {
  const groups = new Map();
  issues.forEach(issue => {
    const value = valueGetter(issue);
    if (!value) return;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(issue);
  });
  groups.forEach((groupIssues, value) => {
    if (groupIssues.length < 2) return;
    groupIssues.forEach(issue => raw.background.push({
      name: label + '：' + value,
      kind: type,
      trendValue: value,
      issue
    }));
  });
}

const buildCausalStructureBeforeInsightRoleFix = buildCausalStructure;
buildCausalStructure = function buildCausalStructureWithInsightRoles(issues) {
  if (!issues.length || !issues.every(isInsightCsvIssue)) {
    return buildCausalStructureBeforeInsightRoleFix(issues);
  }

  const raw = { background: [], direct: [], field: [], risk: [] };

  pushInsightTrend(raw, issues, 'timingTrend', '発生場面の共通傾向', issue => insightTimingGroup(issue.timing));
  pushInsightTrend(raw, issues, 'locationTrend', '発生場所の共通傾向', issue => insightLocationGroup(issue.location));
  pushInsightTrend(raw, issues, 'categoryTrend', '複数回答の共通傾向', issue => insightCompactText(issue.problemCategory));

  const unresolvedDirect = [];
  issues.forEach(issue => {
    const content = insightCompactText(issue.selectedProblem) || '課題や気づきは未入力';
    const category = insightCompactText(issue.problemCategory) || '未分類';
    const fieldContent = conciseNodeName(content, '課題や気づきは未入力');
    raw.field.push({
      name: '課題や気づき：' + fieldContent + '｜困りごと：' + category,
      kind: 'fieldObservation',
      issue
    });

    const cause = insightExplicitCause(issue);
    if (cause) {
      raw.direct.push({
        name: 'CSVに明記された原因：' + cause,
        kind: 'explicitCause',
        cause,
        issue
      });
    } else {
      unresolvedDirect.push(issue);
    }

    const risk = INSIGHT_RISK_BY_CATEGORY[category];
    raw.risk.push({
      name: risk ? '困りごとから読み取れる影響：' + risk : '影響・リスク：追加確認が必要',
      kind: risk ? 'categoryRisk' : 'unknownRisk',
      riskCategory: category,
      issue
    });
  });

  unresolvedDirect.forEach(issue => raw.direct.push({
    name: INSIGHT_CAUSE_CONFIRMATION,
    kind: 'unknownCause',
    issue
  }));

  const layers = {
    background: groupInsightCausalNodes(raw.background, 8),
    direct: groupInsightCausalNodes(raw.direct, 8),
    field: groupInsightCausalNodes(raw.field, 8),
    risk: groupInsightCausalNodes(raw.risk, 8)
  };

  return {
    layers,
    shortTerm: layers.field.slice(0, 5),
    longTerm: [...layers.background, ...layers.direct].slice(0, 8),
    confirmationPoints: [
      '背景要因は、発生場面と複数回答の共通傾向までを整理しており、因果関係は未確定です。',
      '直接原因は、CSV本文に明記された表現だけを表示し、それ以外は追加確認が必要です。',
      '影響・リスクは、困りごと分類から読み取れる範囲だけを可能性として表示しています。',
      'ありたい姿、解決方向性、実施する取組、成果指標は未確認です。'
    ],
    interviewQuestions: insightConfirmationQuestions().split('\n')
  };
};

const nodeAnswerLinesBeforeInsightRoleFix = nodeAnswerLines;
nodeAnswerLines = function nodeAnswerLinesWithInsightRoles(node) {
  if (!node.issues?.length || !node.issues.every(isInsightCsvIssue)) {
    return nodeAnswerLinesBeforeInsightRoleFix(node);
  }
  if (node.kind === 'timingTrend') {
    return uniqueValues(node.issues.map(issue => issue.timing)).slice(0, 5).map(value => '発生場面（いつ）：' + value);
  }
  if (node.kind === 'locationTrend') {
    return uniqueValues(node.issues.map(issue => issue.location)).slice(0, 5).map(value => '発生場面（どこで）：' + value);
  }
  if (node.kind === 'categoryTrend') {
    return ['困りごと：' + (node.trendValue || node.issues[0].problemCategory), '同じ分類の回答：' + node.issues.length + '件'];
  }
  if (node.kind === 'explicitCause') {
    return ['CSV記載の原因表現：' + node.cause];
  }
  if (node.kind === 'unknownCause') {
    return ['直接原因の明記なし：' + node.issues.length + '件', '管理者・活動推進リーダーへの追加確認が必要'];
  }
  if (node.kind === 'fieldObservation') {
    const issue = node.issues[0];
    return ['課題や気づき：' + displayValue(issue.selectedProblem), '困りごと：' + displayValue(issue.problemCategory)];
  }
  if (node.kind === 'categoryRisk') {
    return ['困りごと：' + node.riskCategory, '個別の影響は追加確認が必要'];
  }
  if (node.kind === 'unknownRisk') {
    return ['困りごとの分類から影響を読み取れないため、追加確認が必要'];
  }
  return nodeAnswerLinesBeforeInsightRoleFix(node);
};

const nodeReasonTextBeforeInsightRoleFix = nodeReasonText;
nodeReasonText = function nodeReasonTextWithInsightRoles(node) {
  if (!node.issues?.length || !node.issues.every(isInsightCsvIssue)) {
    return nodeReasonTextBeforeInsightRoleFix(node);
  }
  if (node.kind === 'timingTrend' || node.kind === 'locationTrend') {
    return 'CSVの発生場面を集計し、2件以上の回答に共通する場面として整理しました。原因とは断定していません。';
  }
  if (node.kind === 'categoryTrend') {
    return '同じ困りごと分類に複数の回答が集まっている傾向として整理しました。原因とは断定していません。';
  }
  if (node.kind === 'explicitCause') {
    return '「課題や気づきの内容」に原因を示す表現が明記されている回答だけを整理しました。';
  }
  if (node.kind === 'unknownCause') {
    return 'CSV本文から直接原因を判断できない回答は推測せず、「追加確認が必要」としてまとめました。';
  }
  if (node.kind === 'fieldObservation') {
    return 'CSVの「課題や気づきの内容」と「困りごと」を組み合わせ、現場で起きている問題として整理しました。';
  }
  if (node.kind === 'categoryRisk') {
    return 'CSVの「困りごと」分類から読み取れる範囲だけを、影響の可能性として整理しました。';
  }
  if (node.kind === 'unknownRisk') {
    return '困りごとの分類から影響を読み取れないため、推測せず追加確認事項としました。';
  }
  return nodeReasonTextBeforeInsightRoleFix(node);
};
