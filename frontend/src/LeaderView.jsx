import { useState, useRef, useEffect } from 'react'
import { t, statusLabel } from './i18n'
import './LeaderView.css'

const STATUS_COLOR = {
  安全: '#27ae60',
  要注意: '#e67e22',
  危険: '#c0392b',
}

const speechSupported =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

// フィールドごとの小型マイクボタン（押している間だけ録音）
function FieldMicBtn({ onResult, grammar = [] }) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)

  const start = () => {
    if (!speechSupported || recRef.current) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'ja-JP'
    rec.continuous = false
    rec.interimResults = false
    if (grammar.length > 0 && ('SpeechGrammarList' in window || 'webkitSpeechGrammarList' in window)) {
      const SGL = window.SpeechGrammarList || window.webkitSpeechGrammarList
      const list = new SGL()
      const words = grammar.join(' | ')
      list.addFromString(`#JSGF V1.0; grammar names; public <name> = ${words};`, 1)
      rec.grammars = list
    }
    rec.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) onResult(e.results[i][0].transcript)
      }
    }
    rec.onerror = () => { recRef.current = null; setListening(false) }
    rec.onend   = () => { recRef.current = null; setListening(false) }
    rec.start()
    recRef.current = rec
    setListening(true)
  }

  const stop = () => recRef.current?.stop()

  if (!speechSupported) return null

  return (
    <button
      type="button"
      className={`field-mic-btn ${listening ? 'listening' : ''}`}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      aria-label="音声入力"
      title="押している間だけ録音"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm7 8a1 1 0 0 1 1 1 8 8 0 0 1-7 7.938V22h2a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2h2v-2.062A8 8 0 0 1 4 12a1 1 0 0 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1z"/>
      </svg>
    </button>
  )
}

function ResultCard({ data, lang }) {
  const color = STATUS_COLOR[data.状態] || '#888'
  const unconfirmed = data.未確認人数 ?? 0
  const up = t(lang, 'unitPerson')
  return (
    <div className="result-card">
      <div className="result-header" style={{ borderLeftColor: color }}>
        <span className="result-team">{data.班}</span>
        <span className="result-status" style={{ background: color }}>{statusLabel(data.状態, lang)}</span>
      </div>
      <div className="result-grid">
        <div className="result-item">
          <span className="result-label">{t(lang, 'rcTotal')}</span>
          <span className="result-value">{data.人数} {up}</span>
        </div>
        <div className="result-item">
          <span className="result-label">{t(lang, 'rcSafe')}</span>
          <span className="result-value">{data.安全確認人数 ?? 0} {up}</span>
        </div>
        <div className="result-item">
          <span className="result-label">{t(lang, 'rcUnconfirmed')}</span>
          <span
            className="result-value"
            style={unconfirmed > 0 ? { color: '#e67e22', fontWeight: 700 } : { color: '#6b7a8d' }}
          >
            {unconfirmed} {up}
          </span>
        </div>
        <div className="result-item">
          <span className="result-label">{t(lang, 'rcInjured')}</span>
          <span className="result-value">{data.負傷者} {up}</span>
        </div>
        {data.負傷者 > 0 && data.負傷者名 && data.負傷者名.length > 0 && (
          <div className="result-item full-width">
            <span className="result-label">{t(lang, 'rcInjuredNames')}</span>
            <span className="result-value">{data.負傷者名.join('、')}</span>
          </div>
        )}
        <div className="result-item">
          <span className="result-label">{t(lang, 'rcLocation')}</span>
          <span className="result-value">{data.場所 || '—'}</span>
        </div>
        {data.備考 && (
          <div className="result-item full-width">
            <span className="result-label">{t(lang, 'rcRemarks')}</span>
            <span className="result-value">{data.備考}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LeaderView({ registeredTeams = [], editTarget = null, onEditLoaded, members = [], lang = 'ja' }) {
  // 班名
  const [selectedTeam, setSelectedTeam] = useState('')
  const [customTeam,   setCustomTeam]   = useState('')

  // 人数
  const [total,   setTotal]   = useState('')
  const [safe,    setSafe]    = useState('')
  const [unknown, setUnknown] = useState('')
  const [injured, setInjured] = useState('')
  const unknownManualRef = useRef(false)

  // テキスト
  const [injuredNames, setInjuredNames] = useState('')
  const [location,     setLocation]     = useState('')
  const [remarks,      setRemarks]      = useState('')

  // フォーム状態
  const [status,   setStatus]   = useState(null)
  const [result,   setResult]   = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // 表示制御
  const hasTeams   = registeredTeams.length > 0
  const showCustom = !hasTeams || selectedTeam === '__custom__'
  const teamName   = showCustom ? customTeam : selectedTeam

  // 現在の班のメンバー
  const teamMembers = members.filter(m => m.team === teamName).map(m => m.name)

  // 計算値
  const totalNum   = parseInt(total)   || 0
  const safeNum    = parseInt(safe)    || 0
  const unknownNum = parseInt(unknown) || 0
  const injuredNum = parseInt(injured) || 0
  const sumNum     = safeNum + unknownNum + injuredNum
  const isConsistent = !total || sumNum === totalNum

  // 状態自動判定
  const autoStatus = injuredNum > 0 || unknownNum > 0 ? '要注意' : '安全'

  // 未確認人数の自動計算（手動入力していない場合のみ）
  useEffect(() => {
    if (unknownManualRef.current) return
    const calc = (parseInt(total) || 0) - (parseInt(safe) || 0) - (parseInt(injured) || 0)
    setUnknown(calc >= 0 ? String(calc) : '')
  }, [total, safe, injured])

  // 本部画面から「修正」ボタンで渡された報告データをフォームに反映
  useEffect(() => {
    if (!editTarget) return
    applyReportData(editTarget)
    onEditLoaded?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget])

  // 報告データをフォームに反映する共通ヘルパー
  const applyReportData = (data) => {
    if (hasTeams && registeredTeams.includes(data.班)) {
      setSelectedTeam(data.班)
      setCustomTeam('')
    } else {
      if (hasTeams) setSelectedTeam('__custom__')
      setCustomTeam(data.班)
    }
    setTotal(data.人数 != null ? String(data.人数) : '')
    setSafe(data.安全確認人数 != null ? String(data.安全確認人数) : '')
    setUnknown(data.未確認人数 != null ? String(data.未確認人数) : '')
    setInjured(data.負傷者 != null ? String(data.負傷者) : '')
    setInjuredNames(Array.isArray(data.負傷者名) ? data.負傷者名.join('、') : '')
    setLocation(data.場所 || '')
    setRemarks(data.備考 || '')
    unknownManualRef.current = true
    setStatus(null)
    setResult(null)
  }

  const loadForEdit = () => {
    if (!result) return
    applyReportData(result)
  }

  const resetForm = () => {
    setSelectedTeam('')
    setCustomTeam('')
    setTotal('')
    setSafe('')
    setUnknown('')
    setInjured('')
    setInjuredNames('')
    setLocation('')
    setRemarks('')
    unknownManualRef.current = false
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!teamName.trim() || !total) return

    const rawParts = [
      teamName,
      totalNum   ? `総員${totalNum}名`   : null,
      safeNum    ? `安全${safeNum}名`    : null,
      unknownNum ? `未確認${unknownNum}名` : null,
      injuredNum ? `負傷者${injuredNum}名` : null,
      injuredNames ? `（${injuredNames}）` : null,
      location || null,
    ].filter(Boolean)

    const payload = {
      班:           teamName,
      人数:         totalNum,
      安全確認人数: safeNum,
      未確認人数:   unknownNum,
      負傷者:       injuredNum,
      負傷者名:     injuredNames,
      状態:         autoStatus,
      場所:         location,
      備考:         remarks,
      raw_text:     rawParts.join(' '),
    }

    setStatus('loading')
    setResult(null)
    setErrorMsg('')

    try {
      const res  = await fetch('/api/report/structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || `HTTP Error ${res.status}`)
      setResult(json.data)
      setStatus('success')
      resetForm()
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="leader-view">
      <h1 className="view-title">{t(lang, 'leaderTitle')}</h1>
      <p className="view-desc">
        {t(lang, 'leaderDesc1')}<br />
        {t(lang, 'leaderDesc2')}
      </p>

      <form className="report-form" onSubmit={handleSubmit}>

        {/* ── 班名 ──────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label">{t(lang, 'teamNameLabel')}</label>
          {hasTeams && (
            <select
              className="team-select"
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
            >
              <option value="">{t(lang, 'selectTeamPlaceholder')}</option>
              {registeredTeams.map((tm) => (
                <option key={tm} value={tm}>{tm}</option>
              ))}
              <option value="__custom__">{t(lang, 'customTeamOption')}</option>
            </select>
          )}
          {showCustom && (
            <div className="field-row">
              <input
                className="field-input"
                value={customTeam}
                onChange={(e) => setCustomTeam(e.target.value)}
                placeholder={t(lang, 'teamNamePlaceholder')}
              />
              <FieldMicBtn onResult={(tx) => setCustomTeam((prev) => prev ? prev + tx : tx)} />
            </div>
          )}
        </div>

        {/* ── 総人数 ─────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label" htmlFor="f-total">{t(lang, 'totalLabel')}</label>
          <div className="field-row">
            <input
              id="f-total"
              type="number"
              className="number-input"
              value={total}
              onChange={(e) => { unknownManualRef.current = false; setTotal(e.target.value) }}
              min="0"
              inputMode="numeric"
              placeholder="0"
            />
            <span className="number-unit">{t(lang, 'unitPerson')}</span>
          </div>
        </div>

        {/* ── 人数内訳 ───────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label">{t(lang, 'breakdownLabel')}</label>
          <div className="counts-row">
            <div className="count-item">
              <span className="count-label count-safe">{t(lang, 'safeLabel')}</span>
              <input
                type="number"
                className="count-input"
                value={safe}
                onChange={(e) => { unknownManualRef.current = false; setSafe(e.target.value) }}
                min="0"
                inputMode="numeric"
                placeholder="0"
              />
            </div>
            <div className="count-item">
              <span className="count-label count-unknown">{t(lang, 'unknownLabel')}</span>
              <input
                type="number"
                className="count-input"
                value={unknown}
                onChange={(e) => { unknownManualRef.current = true; setUnknown(e.target.value) }}
                min="0"
                inputMode="numeric"
                placeholder="0"
              />
            </div>
            <div className="count-item">
              <span className="count-label count-danger">{t(lang, 'injuredLabel')}</span>
              <input
                type="number"
                className="count-input"
                value={injured}
                onChange={(e) => { unknownManualRef.current = false; setInjured(e.target.value) }}
                min="0"
                inputMode="numeric"
                placeholder="0"
              />
            </div>
          </div>
          {total && (
            <div className={`sum-check ${isConsistent ? 'sum-ok' : 'sum-warning'}`}>
              {isConsistent
                ? t(lang, 'sumOk', safeNum, unknownNum, injuredNum, totalNum)
                : t(lang, 'sumWarning', safeNum, unknownNum, injuredNum, sumNum, totalNum)}
            </div>
          )}
        </div>

        {/* ── 負傷者名 ────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label">{t(lang, 'injuredNamesLabel')}</label>
          <div className="field-row">
            <input
              className="field-input"
              value={injuredNames}
              onChange={(e) => setInjuredNames(e.target.value)}
              placeholder={t(lang, 'injuredNamesPlaceholder')}
              disabled={injuredNum === 0}
            />
            <FieldMicBtn
              onResult={(tx) => setInjuredNames((prev) => prev ? prev + '、' + tx : tx)}
              grammar={teamMembers}
            />
          </div>
        </div>

        {/* ── 場所 ────────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label">{t(lang, 'locationLabel')}</label>
          <div className="field-row">
            <input
              className="field-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t(lang, 'locationPlaceholder')}
            />
            <FieldMicBtn onResult={(tx) => setLocation((prev) => prev ? prev + tx : tx)} />
          </div>
        </div>

        {/* ── 備考 ────────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label">{t(lang, 'remarksLabel')}</label>
          <div className="field-row remarks-row">
            <textarea
              className="remarks-textarea"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={t(lang, 'remarksPlaceholder')}
              rows={3}
            />
            <FieldMicBtn onResult={(tx) => setRemarks((prev) => prev ? prev + ' ' + tx : tx)} />
          </div>
        </div>

        {/* ── 判定状態プレビュー ─────────────────────────────── */}
        <div className="status-preview">
          <span className="status-preview-label">{t(lang, 'statusPreviewLabel')}</span>
          <span
            className="status-preview-badge"
            style={{ background: STATUS_COLOR[autoStatus] }}
          >
            {statusLabel(autoStatus, lang)}
          </span>
          <span className="status-preview-note">{t(lang, 'autoJudgeNote')}</span>
        </div>

        <button
          type="submit"
          className={`submit-btn ${status === 'loading' ? 'loading' : ''}`}
          disabled={status === 'loading' || !teamName.trim() || !total}
        >
          {status === 'loading' ? (
            <><span className="spinner" />{t(lang, 'submitting')}</>
          ) : t(lang, 'submit')}
        </button>
      </form>

      {status === 'error' && (
        <div className="alert alert-error">
          <strong>{t(lang, 'errorPrefix')}</strong> {errorMsg}
        </div>
      )}

      {status === 'success' && result && (
        <div className="success-block">
          <div className="alert alert-success">{t(lang, 'successMsg')}</div>
          <ResultCard data={result} lang={lang} />
          <button type="button" className="edit-btn" onClick={loadForEdit}>
            {t(lang, 'editBtn')}
          </button>
        </div>
      )}
    </div>
  )
}
