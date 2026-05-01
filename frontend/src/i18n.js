export const TRANSLATIONS = {
  ja: {
    // App header
    appTitle:    '災害時人員点呼システム',
    navLeader:   '班リーダー報告',
    navHQ:       '本部集計画面',
    navSetup:    '⚙ 班設定',

    // Status values (server always sends Japanese)
    safe:     '安全',
    caution:  '要注意',
    critical: '危険',

    // HQView
    hqTitle:      '本部 集計画面',
    connOk:       '● リアルタイム接続中',
    connErr:      '○ 接続待機中...',
    lastUpdate:   '最終更新:',
    reset:        'リセット',
    resetConfirm: '本当にリセット？',
    updated:      '更新',

    // Summary cards
    cardReported:    '報告班数',
    cardUnreported:  '未報告班数',
    cardTotal:       '総人数',
    cardSafe:        '安全確認済',
    cardUnconfirmed: '未確認',
    cardInjured:     '負傷者数',
    cardDanger:      '危険班',
    unitPerson:      '名',
    unitTeam:        '班',

    // Table headers
    colTeam:          '班名',
    colStatus:        '状態',
    colTotal:         '人数',
    colSafe:          '安全確認',
    colUnconfirmed:   '未確認',
    colInjured:       '負傷者',
    colInjuredNames:  '負傷者名',
    colLocation:      '場所',
    colRemarks:       '備考',
    colTime:          '報告時刻',

    // Banners / panels
    allReported:      (n) => `全 ${n} 班からの報告が揃いました！`,
    unreportedLabel:  '未報告',
    dangerAlertTitle: '⚠ 危険班の報告内容',

    // History modal
    historyTitle: (team) => `${team} の修正履歴`,
    historyEmpty: '修正履歴はありません。',
    histStatus:   '状態',
    histTotal:    '人数',
    histInjured:  '負傷者',
    histLocation: '場所',
    histRemarks:  '備考',

    // Action buttons
    edit:    '修正',
    history: '履歴',

    // Empty state
    emptyLine1: 'まだ報告がありません。',
    emptyLine2: '班リーダー画面から報告を送信してください。',

    // LeaderView
    leaderTitle: '班リーダー 報告入力',
    leaderDesc1: '各項目を入力して送信してください。',
    leaderDesc2: 'マイクボタンを押している間だけ音声入力できます。',

    teamNameLabel:        '班名',
    selectTeamPlaceholder:'-- 班名を選択 --',
    customTeamOption:     'その他（直接入力）',
    teamNamePlaceholder:  '班名を入力（例：第3班）',

    totalLabel:       '総人数',
    breakdownLabel:   '人数内訳',
    safeLabel:        '安全確認',
    unknownLabel:     '未確認',
    injuredLabel:     '負傷者',

    injuredNamesLabel:       '負傷者名',
    injuredNamesPlaceholder: '田中、山田（読点区切り）',
    locationLabel:           '場所',
    locationPlaceholder:     '体育館、北棟出口付近 など',
    remarksLabel:            '備考',
    remarksPlaceholder:      '特記事項、状況詳細など',

    statusPreviewLabel: '判定状態',
    autoJudgeNote:      '人数から自動判定',

    submit:     '送信する',
    submitting: '送信中...',
    errorPrefix:'エラー：',
    successMsg: '送信完了。以下の内容で本部に登録されました。',
    editBtn:    'この報告を修正する',

    // ResultCard
    rcTotal:        '人数',
    rcSafe:         '安全確認',
    rcUnconfirmed:  '未確認者',
    rcInjured:      '負傷者',
    rcInjuredNames: '負傷者名',
    rcLocation:     '場所',
    rcRemarks:      '備考',

    // Sum check
    sumOk:      (safe, unknown, injured, total) =>
      `✓ ${safe} + ${unknown} + ${injured} = ${total} 名`,
    sumWarning: (safe, unknown, injured, sum, total) =>
      `⚠ ${safe} + ${unknown} + ${injured} = ${sum} 名（総人数 ${total} 名と一致しません）`,

    // SetupView
    setupTitle:   '班の設定',
    setupDesc:    '班の一覧をあらかじめ登録しておくと、本部画面で未報告班をリアルタイムに確認できます。設定内容はサーバーで管理され、全画面・全端末で共有されます。',
    presetTitle:  'プリセットから一括登録',
    registering:  '登録中...',
    manualTitle:  '班を手動で追加',
    teamInputPlaceholder: '班名を入力（例：A班、救護班）',
    addBtn:       '追加',
    duplicateMsg: 'その班名はすでに登録されています。',
    registeredTitle: '登録済み班',
    clearAll:     'すべて削除',
    setupEmpty:   'まだ班が登録されていません。\nプリセットか手動追加で班を登録してください。',
    memberInputPlaceholder: '氏名を入力',
  },

  en: {
    appTitle:    'Disaster Roll Call System',
    navLeader:   'Team Report',
    navHQ:       'Headquarters',
    navSetup:    '⚙ Team Setup',

    safe:     'Safe',
    caution:  'Caution',
    critical: 'Critical',

    hqTitle:      'Headquarters',
    connOk:       '● Connected',
    connErr:      '○ Connecting...',
    lastUpdate:   'Last update:',
    reset:        'Reset',
    resetConfirm: 'Confirm Reset?',
    updated:      'Updated',

    cardReported:    'Reported',
    cardUnreported:  'Unreported',
    cardTotal:       'Total',
    cardSafe:        'Safe',
    cardUnconfirmed: 'Unconfirmed',
    cardInjured:     'Injured',
    cardDanger:      'Critical Teams',
    unitPerson:      '',
    unitTeam:        '',

    colTeam:         'Team',
    colStatus:       'Status',
    colTotal:        'Total',
    colSafe:         'Safe',
    colUnconfirmed:  'Unconfirmed',
    colInjured:      'Injured',
    colInjuredNames: 'Injured Names',
    colLocation:     'Location',
    colRemarks:      'Remarks',
    colTime:         'Time',

    allReported:      (n) => `All ${n} teams have reported!`,
    unreportedLabel:  'Unreported',
    dangerAlertTitle: '⚠ Critical Team Reports',

    historyTitle: (team) => `${team} Edit History`,
    historyEmpty: 'No edit history.',
    histStatus:   'Status',
    histTotal:    'Total',
    histInjured:  'Injured',
    histLocation: 'Location',
    histRemarks:  'Remarks',

    edit:    'Edit',
    history: 'History',

    emptyLine1: 'No reports yet.',
    emptyLine2: 'Submit a report from the Team Report screen.',

    leaderTitle: 'Team Report',
    leaderDesc1: 'Fill in each field and submit.',
    leaderDesc2: 'Hold the mic button to use voice input.',

    teamNameLabel:         'Team Name',
    selectTeamPlaceholder: '-- Select Team --',
    customTeamOption:      'Other (type manually)',
    teamNamePlaceholder:   'Enter team name (e.g. Team 3)',

    totalLabel:     'Total Members',
    breakdownLabel: 'Breakdown',
    safeLabel:      'Safe',
    unknownLabel:   'Unconfirmed',
    injuredLabel:   'Injured',

    injuredNamesLabel:       'Injured Names',
    injuredNamesPlaceholder: 'Names separated by commas',
    locationLabel:           'Location',
    locationPlaceholder:     'e.g. Gymnasium, North Exit',
    remarksLabel:            'Remarks',
    remarksPlaceholder:      'Additional notes, details, etc.',

    statusPreviewLabel: 'Status',
    autoJudgeNote:      'Auto-determined from counts',

    submit:      'Submit',
    submitting:  'Submitting...',
    errorPrefix: 'Error: ',
    successMsg:  'Submitted. Registered with HQ.',
    editBtn:     'Edit This Report',

    rcTotal:        'Total',
    rcSafe:         'Safe',
    rcUnconfirmed:  'Unconfirmed',
    rcInjured:      'Injured',
    rcInjuredNames: 'Injured Names',
    rcLocation:     'Location',
    rcRemarks:      'Remarks',

    sumOk:      (safe, unknown, injured, total) =>
      `✓ ${safe} + ${unknown} + ${injured} = ${total}`,
    sumWarning: (safe, unknown, injured, sum, total) =>
      `⚠ ${safe} + ${unknown} + ${injured} = ${sum} (total is ${total})`,

    setupTitle:   'Team Setup',
    setupDesc:    'Register teams in advance to track unreported teams in real time on the HQ screen. Settings are managed on the server and shared across all screens and devices.',
    presetTitle:  'Apply Preset',
    registering:  'Adding...',
    manualTitle:  'Add Team Manually',
    teamInputPlaceholder: 'Enter team name (e.g. Team A)',
    addBtn:       'Add',
    duplicateMsg: 'That team name is already registered.',
    registeredTitle: 'Registered Teams',
    clearAll:     'Clear All',
    setupEmpty:   'No teams registered yet.\nUse a preset or add teams manually.',
    memberInputPlaceholder: 'Enter name',
  },
}

export function t(lang, key, ...args) {
  const v = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.ja[key] ?? key
  return typeof v === 'function' ? v(...args) : v
}

/** サーバー値（日本語）→ 表示ラベル */
export function statusLabel(serverValue, lang) {
  const map = {
    安全:  lang === 'en' ? 'Safe'     : '安全',
    要注意: lang === 'en' ? 'Caution'  : '要注意',
    危険:  lang === 'en' ? 'Critical' : '危険',
  }
  return map[serverValue] ?? serverValue
}
