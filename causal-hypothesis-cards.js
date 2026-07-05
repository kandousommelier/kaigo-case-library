/*
 * 4列の気づきシートCSVに対し、
 * 「介護事業所に共通して見られた問題点.pdf」を参照した仮説カードを追加する。
 * insight-causal-fix.js の後に読み込む。
 */

(() => {
  'use strict';

  const PREFIX = '【仮説】';
  const SOURCE_NAME = '介護事業所に共通して見られた問題点.pdf';
  const RISK_SECTION = '8．ケアの質、安全、利用者への影響';

  const CATEGORY_RULES = {
    '物を探すこと、準備、片付け、移動': {
      background: '物品の定位置、返却、在庫確認、不要物処分のルールが標準化されていない',
      backgroundSection: '5．手順書、ルール、業務の標準化',
      fallbackDirect: '必要な物の定位置、準備・片付けの手順、移動動線のいずれかが整理されていない',
      fallbackRisk: '職員が物探しや準備に追われ、利用者と関わる時間が少なくなっている',
      directSection: '1．物を探すこと、準備、片付け、移動',
      rules: [
        { pattern: /探|見つから|置き場|どこに|備品|書類|物品/, direct: '備品や書類の置き場所が決まっていない' },
        { pattern: /戻|片付|散ら|放置|元の場所/, direct: '使った物が元の場所に戻されていない' },
        { pattern: /在庫|欠品|不足|過剰/, direct: '必要な備品の在庫が分からず、欠品や過剰在庫が発生している' },
        { pattern: /準備|入浴|レク|訪問/, direct: '準備中の物と使用後の物が混在している、または準備手順が整理されていない' },
        { pattern: /移動|往復|遠い|遠く|動線/, direct: '収納場所が業務を行う場所から遠い、または移動動線が整理されていない' },
        { pattern: /送迎|ルート/, direct: '送迎や訪問ルートにムダや偏りがある' },
        { pattern: /待|エレベーター|処置/, risk: '利用者が入浴、処置、エレベーターなどを待つ時間が長くなっている' }
      ]
    },
    '仕事の流れ、誰が何をするか、仕事の偏り': {
      background: '業務手順や役割分担が職員の経験やその場の判断に依存し、標準化されていない',
      backgroundSection: '5．手順書、ルール、業務の標準化',
      fallbackDirect: '一日の業務の流れと役割分担が職員間で共有されていない',
      fallbackRisk: '休憩や利用者と関わる時間が確保できず、職員負担が偏っている',
      directSection: '2．仕事の流れ、誰が何をするか、仕事の偏り',
      rules: [
        { pattern: /誰|担当|役割|分担/, direct: '誰が何を担当するのか明確でない' },
        { pattern: /偏り|偏って|集中|一部|特定/, direct: '特定の職員や管理者に仕事が集中している' },
        { pattern: /管理者|リーダー|サービス提供責任者|サ責/, direct: '管理者やサービス提供責任者が現場業務に追われ、管理・育成・相談対応の時間を確保できていない' },
        { pattern: /ベテラン|属人|できない|できる人/, direct: 'ベテランしかできない業務があり、職員によって担当できる業務に差がある' },
        { pattern: /看護|介護|リハ|専門職|多職種/, direct: '職種間の役割分担が曖昧で、複数職種が同じ確認や記録を行っている' },
        { pattern: /忙しい|時間帯|配置|シフト/, direct: '忙しい時間帯と職員配置が合っていない' },
        { pattern: /複数|同時|中断|集中でき/, direct: '職員が複数の業務を同時に抱え、一つの仕事に集中できない' },
        { pattern: /引継|欠勤|退職/, direct: '引継ぎが不十分で、欠勤者や退職者が出ると業務が止まりやすい' }
      ]
    },
    '記録や書類の作成': {
      background: '記録や書類ごとの目的、必要項目、記載基準を見直す仕組みがない',
      backgroundSection: '3．記録や書類の作成',
      fallbackDirect: '記録する書類が多く、目的や必要項目が整理されていない',
      fallbackRisk: '記録の遅れ、漏れ、残業が発生し、必要な情報を適時に活用できていない',
      directSection: '3．記録や書類の作成',
      rules: [
        { pattern: /同じ|重複|複数|二重/, direct: '同じ内容を複数の書類やシステムに記入している' },
        { pattern: /転記|紙|FAX|印刷|別のシステム/, direct: '紙、パソコン、別システム、FAXの間で転記が発生している' },
        { pattern: /後から|戻って|たまる|溜まる|残業|時間が経/, direct: '記録をその場で行えず、後から思い出して入力している' },
        { pattern: /書き方|詳しさ|情報量|ばらつ|人によって/, direct: '記録の書き方や情報量が職員によって異なる' },
        { pattern: /見づら|検索|時系列|把握しにく/, direct: '記録様式が見づらく、必要な情報や時系列の変化を把握しにくい' },
        { pattern: /使いにく|入力に時間|ICT|記録システム/, direct: '記録システムの操作方法や業務上の使い方が定まらず、入力に時間がかかっている' }
      ]
    },
    '連絡、申し送り、みんなに伝えること': {
      background: '連絡手段ごとの使い分け、確認、対応完了のルールが標準化されていない',
      backgroundSection: '5．手順書、ルール、業務の標準化',
      fallbackDirect: '申し送り、確認、対応完了までの情報共有ルールが決まっていない',
      fallbackRisk: '伝達漏れや認識のずれにより、利用者への対応が職員ごとに異なる、または事故・状態悪化につながるおそれがある',
      directSection: '4．連絡、申し送り、みんなに伝えること',
      rules: [
        { pattern: /申し送り|伝える内容|詳しさ/, direct: '申し送りで伝える内容と詳しさが決まっていない' },
        { pattern: /忘れ|漏れ|届か|休み|夜勤/, direct: '必要な情報が休み・夜勤を含む職員へ確実に届く仕組みがない' },
        { pattern: /誰が|確認した|対応した|どこまで/, direct: '誰が情報を確認し、誰がどこまで対応したか分からない' },
        { pattern: /電話|口頭|メモ|FAX|ノート|チャット|インカム|分散/, direct: '情報が複数の連絡手段に分散し、使い分けや運用ルールがない' },
        { pattern: /個別|何度も|繰り返|かけ直/, direct: '同じ情報を複数の人へ個別に伝え、確認や連絡を繰り返している' },
        { pattern: /ケアマネ|家族|医療|他事業所|多職種/, direct: '外部関係者へ報告すべき情報と連絡方法が整理されていない' }
      ]
    },
    '目標の共有や改善活動': {
      background: '改善活動の目的、優先順位、担当、期限、評価方法を決める運営体制が整っていない',
      backgroundSection: '7．目標の共有や改善活動',
      fallbackDirect: '改善活動の目的、優先順位、担当、期限、評価方法が決まっていない',
      fallbackRisk: '改善が一度きりで終わり、取組や導入機器が定着・横展開しない',
      directSection: '7．目標の共有や改善活動',
      rules: [
        { pattern: /理念|目標|ケア|自立支援|利用者本位/, direct: '法人理念や事業所の目標、目指すケアが具体化・共有されていない' },
        { pattern: /原因|整理|課題|優先順位/, direct: '現場の困りごとを集め、原因を整理し、優先順位を決める手順がない' },
        { pattern: /誰|いつまで|担当|期限/, direct: '誰が、いつまでに、何を行うか決めていない' },
        { pattern: /時間|勤務|忙しい|追加業務/, direct: '改善活動の時間を勤務内に確保しておらず、追加業務と受け取られている' },
        { pattern: /管理者|現場|参加|やらされ/, direct: '管理者だけで改善策を決め、現場職員が十分に参加していない' },
        { pattern: /効果|測定|振り返|見直し/, direct: '改善後の効果測定、振り返り、見直しを行っていない' },
        { pattern: /ICT|ロボット|機器|補助金|導入/, direct: '導入自体が目的となり、解決したい問題と運用方法が明確でない' },
        { pattern: /横展開|他部署|他ユニット|他事業所/, direct: '成果を他部署・他事業所へ展開する仕組みがない' }
      ]
    }
  };

  function compact(value) {
    return String(value || '').replace(/[\s　]+/g, ' ').trim();
  }

  function keyOf(value) {
    return compact(value).toLocaleLowerCase('ja').replace(/[\s　、。・：:｜|]/g, '');
  }

  function addHypothesis(store, layer, text, issue, sourceSection) {
    if (!text || !issue) return;
    const name = text.startsWith(PREFIX) ? text : PREFIX + text;
    const key = keyOf(name);
    if (!store[layer].has(key)) {
      store[layer].set(key, {
        name,
        kind: 'hypothesis' + layer.charAt(0).toUpperCase() + layer.slice(1),
        issues: [],
        sourceName: SOURCE_NAME,
        sourceSection,
        order: store[layer].size
      });
    }
    const node = store[layer].get(key);
    if (!node.issues.some(item => item.sourceRow === issue.sourceRow)) node.issues.push(issue);
  }

  function collectHypotheses(issues) {
    const store = {
      background: new Map(),
      direct: new Map(),
      risk: new Map()
    };

    issues.forEach(issue => {
      const category = compact(issue.problemCategory);
      const config = CATEGORY_RULES[category];
      if (!config) return;

      const text = [issue.selectedProblem, issue.timing, issue.location].map(compact).filter(Boolean).join(' ');
      addHypothesis(store, 'background', config.background, issue, config.backgroundSection);

      const matchingRules = config.rules.filter(rule => rule.pattern.test(text));
      const directRules = matchingRules.filter(rule => rule.direct).slice(0, 2);
      if (directRules.length) {
        directRules.forEach(rule => addHypothesis(store, 'direct', rule.direct, issue, config.directSection));
      } else {
        addHypothesis(store, 'direct', config.fallbackDirect, issue, config.directSection);
      }

      const matchedRisk = matchingRules.find(rule => rule.risk)?.risk;
      addHypothesis(store, 'risk', matchedRisk || config.fallbackRisk, issue, RISK_SECTION);
    });

    const sortNodes = map => [...map.values()]
      .sort((a, b) => b.issues.length - a.issues.length || a.order - b.order);

    return {
      background: sortNodes(store.background),
      direct: sortNodes(store.direct),
      risk: sortNodes(store.risk)
    };
  }

  function mergeLayer(existing, hypotheses, limit = 12, hypothesisLimit = 6) {
    const filteredExisting = existing.filter(node => !(node.kind === 'unknownCause' && hypotheses.length));
    const selectedHypotheses = hypotheses.slice(0, hypothesisLimit);
    const existingLimit = Math.max(0, limit - selectedHypotheses.length);
    const merged = filteredExisting.slice(0, existingLimit);
    const seen = new Set(merged.map(node => keyOf(node.name)));

    selectedHypotheses.forEach(node => {
      if (merged.length >= limit || seen.has(keyOf(node.name))) return;
      seen.add(keyOf(node.name));
      merged.push(node);
    });
    return merged;
  }

  const buildBeforeHypothesisCards = buildCausalStructure;
  buildCausalStructure = function buildCausalStructureWithHypothesisCards(issues) {
    const result = buildBeforeHypothesisCards(issues);
    if (!issues.length || !issues.every(isInsightCsvIssue)) return result;

    const hypotheses = collectHypotheses(issues);
    result.layers.background = mergeLayer(result.layers.background || [], hypotheses.background, 12, 5);
    result.layers.direct = mergeLayer(result.layers.direct || [], hypotheses.direct, 12, 7);
    result.layers.risk = mergeLayer(result.layers.risk || [], hypotheses.risk, 12, 6);
    result.longTerm = [...result.layers.background, ...result.layers.direct].slice(0, 12);

    result.confirmationPoints = [
      '「【仮説】」カードは、CSVの困りごと分類・記述に近い共通問題点を「' + SOURCE_NAME + '」から追加したものです。',
      '「【仮説】」カードは当該施設で確認された事実ではありません。管理者・活動推進リーダーと確認し、採用・修正・削除してください。',
      'CSVに明記された原因表現は「CSVに明記された原因」として区別しています。',
      '現場で起きている困りごとはCSV記載を優先し、仮説で置き換えていません。',
      'ありたい姿、解決方向性、実施する取組、成果指標は未確認です。'
    ];

    const existingQuestions = Array.isArray(result.interviewQuestions) ? result.interviewQuestions : [];
    result.interviewQuestions = [
      '「【仮説】」カードのうち、実際に当てはまるものはどれですか。',
      '当てはまらない仮説、表現の修正が必要な仮説はどれですか。',
      ...existingQuestions
    ];
    return result;
  };

  const nodeAnswerLinesBeforeHypothesisCards = nodeAnswerLines;
  nodeAnswerLines = function nodeAnswerLinesWithHypothesisCards(node) {
    if (!String(node.kind || '').startsWith('hypothesis')) {
      return nodeAnswerLinesBeforeHypothesisCards(node);
    }

    const categories = [...new Set((node.issues || []).map(issue => compact(issue.problemCategory)).filter(Boolean))];
    const observations = [...new Set((node.issues || []).map(issue => compact(issue.selectedProblem)).filter(Boolean))];
    return [
      '位置づけ：当該施設では未確認の仮説',
      '参照資料：' + node.sourceName,
      '参照箇所：' + node.sourceSection,
      categories.length ? '関連する困りごと：' + categories.join(' / ') : '',
      ...observations.slice(0, 3).map(value => '関連するCSV記載：' + value)
    ].filter(Boolean);
  };

  const nodeReasonTextBeforeHypothesisCards = nodeReasonText;
  nodeReasonText = function nodeReasonTextWithHypothesisCards(node) {
    if (!String(node.kind || '').startsWith('hypothesis')) {
      return nodeReasonTextBeforeHypothesisCards(node);
    }
    return 'CSVの困りごと分類と記述に近い共通問題点を参照資料から候補として追加しました。当該施設の事実を断定するものではなく、確認・修正・削除が必要です。';
  };
})();
