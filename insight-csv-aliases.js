/*
 * 気づきシートCSVの見出し別表記対応
 *
 * 対応例:
 * - 課題の発生場面（いつ） / いつ？
 * - 課題の発生場面（どこで） / どこで？
 * - 課題や気づきの内容 / どんな課題や気づき？
 * - 困りごと / 困りごと分類
 */
(function enableInsightCsvHeaderAliases() {
  const normalizeAliasHeader = value => normalizeHeader(String(value || ''))
    .replace(/[?？]/g, '')
    .replace(/[「」『』（）()【】\[\]]/g, '');

  const aliasGroups = {
    timing: [
      ['課題の発生場面', 'いつ'],
      ['いつ']
    ],
    location: [
      ['課題の発生場面', 'どこで'],
      ['どこで'],
      ['発生場所']
    ],
    content: [
      ['課題や気づき', '内容'],
      ['どんな課題や気づき'],
      ['課題や気づき'],
      ['気づきの内容']
    ],
    problemCategory: [
      ['困りごと分類'],
      ['困りごと']
    ]
  };

  function matchesAnyAlias(header, groups) {
    const normalizedHeader = normalizeAliasHeader(header);
    return groups.some(group => group.every(part =>
      normalizedHeader.includes(normalizeAliasHeader(part))
    ));
  }

  function findHeaderValue(row, groups) {
    const entry = Object.entries(row || {}).find(([header]) => matchesAnyAlias(header, groups));
    return entry ? String(entry[1] ?? '').trim() : '';
  }

  function hasHeader(rows, groups) {
    return Object.keys(rows[0] || {}).some(header => matchesAnyAlias(header, groups));
  }

  isInsightCsvHeaders = function isInsightCsvHeadersIncludingAliases(rows) {
    return hasHeader(rows, aliasGroups.timing)
      && hasHeader(rows, aliasGroups.location)
      && hasHeader(rows, aliasGroups.content)
      && hasHeader(rows, aliasGroups.problemCategory);
  };

  const insightCsvValueBeforeAliases = insightCsvValue;
  insightCsvValue = function insightCsvValueIncludingAliases(row, ...parts) {
    const requested = parts.map(normalizeAliasHeader).join(' ');
    let groups = null;

    if (requested.includes('いつ')) groups = aliasGroups.timing;
    else if (requested.includes('どこで') || requested.includes('発生場所')) groups = aliasGroups.location;
    else if (requested.includes('課題や気づき')) groups = aliasGroups.content;
    else if (requested.includes('困りごと')) groups = aliasGroups.problemCategory;

    if (groups) {
      const value = findHeaderValue(row, groups);
      if (value) return value;
    }
    return insightCsvValueBeforeAliases(row, ...parts);
  };
})();
