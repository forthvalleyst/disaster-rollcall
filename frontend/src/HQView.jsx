import { useState } from 'react'
import { t, statusLabel } from './i18n'
import './HQView.css'

const STATUS_COLOR = {
  安全: '#27ae60',
  要注意: '#e67e22',
  危険: '#c0392b',
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function HistoryModal({ team, history, onClose, lang }) {
  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="history-modal-header">
          <span className="history-modal-title">{t(lang, 'historyTitle', team)}</span>
          <button className="history-close-btn" onClick={onClose}>✕</button>
        </div>
        {history.length === 0 ? (
          <p className="history-empty">{t(lang, 'historyEmpty')}</p>
        ) : (
          <div className="history-timeline">
            {[...history].reverse().map((entry, i) => (
              <div key={i} className="history-entry">
                <div className="history-entry-time">{formatTime(entry.updated_at ?? entry.timestamp)}</div>
                <div className="history-card">
                  <div className="history-card-row">
                    <span className="history-card-label">{t(lang, 'histStatus')}</span>
                    <span className="history-card-value" style={{ color: STATUS_COLOR[entry.状態] || '#888' }}>
                      {statusLabel(entry.状態, lang)}
                    </span>
                  </div>
                  <div className="history-card-row">
                    <span className="history-card-label">{t(lang, 'histTotal')}</span>
                    <span className="history-card-value">
                      {entry.人数}{t(lang, 'unitPerson')}
                    </span>
                  </div>
                  <div className="history-card-row">
                    <span className="history-card-label">{t(lang, 'histInjured')}</span>
                    <span className="history-card-value">
                      {entry.負傷者}{t(lang, 'unitPerson')}
                      {entry.負傷者名?.length > 0 ? `（${entry.負傷者名.join('、')}）` : ''}
                    </span>
                  </div>
                  {entry.場所 && (
                    <div className="history-card-row">
                      <span className="history-card-label">{t(lang, 'histLocation')}</span>
                      <span className="history-card-value">{entry.場所}</span>
                    </div>
                  )}
                  {entry.備考 && (
                    <div className="history-card-row">
                      <span className="history-card-label">{t(lang, 'histRemarks')}</span>
                      <span className="history-card-value">{entry.備考}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, unit = '', accent }) {
  return (
    <div className="summary-card" style={accent ? { borderTopColor: accent } : {}}>
      <div className="summary-label">{label}</div>
      <div className="summary-value" style={accent ? { color: accent } : {}}>
        {value}
        <span className="summary-unit">{unit}</span>
      </div>
    </div>
  )
}

export default function HQView({ reports = [], registeredTeams = [], connected, lastUpdate, onReset, onEdit, lang = 'ja' }) {
  const [resetConfirm, setResetConfirm] = useState(false)
  const [historyTeam, setHistoryTeam] = useState(null)

  // 集計（各班の内訳フィールドを直接合算）
  const totalPeople       = reports.reduce((s, r) => s + (r.人数 || 0), 0)
  const safePeople        = reports.reduce((s, r) => s + (r.安全確認人数 || 0), 0)
  const unconfirmedPeople = reports.reduce((s, r) => s + (r.未確認人数 || 0), 0)
  const totalInjured      = reports.reduce((s, r) => s + (r.負傷者 || 0), 0)
  const teamCount    = reports.length
  const dangerCount  = reports.filter((r) => r.状態 === '危険').length

  // 未報告班
  const reportedNames   = new Set(reports.map((r) => r.班))
  const unreportedTeams = registeredTeams.filter((name) => !reportedNames.has(name))
  const hasSetup    = registeredTeams.length > 0
  const allReported = hasSetup && unreportedTeams.length === 0

  const handleReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true)
      setTimeout(() => setResetConfirm(false), 3000)
      return
    }
    await onReset()
    setResetConfirm(false)
  }

  const up = t(lang, 'unitPerson')
  const ut = t(lang, 'unitTeam')

  return (
    <div className="hq-view">
      <div className="hq-header">
        <h1 className="view-title">{t(lang, 'hqTitle')}</h1>
        <div className="hq-meta">
          <span className={`conn-badge ${connected ? 'conn-ok' : 'conn-err'}`}>
            {connected ? t(lang, 'connOk') : t(lang, 'connErr')}
          </span>
          {lastUpdate && (
            <span className="last-update">
              {t(lang, 'lastUpdate')} {lastUpdate.toLocaleTimeString('ja-JP')}
            </span>
          )}
          <button
            className={`reset-btn ${resetConfirm ? 'confirm' : ''}`}
            onClick={handleReset}
          >
            {resetConfirm ? t(lang, 'resetConfirm') : t(lang, 'reset')}
          </button>
        </div>
      </div>

      {/* 集計カード */}
      <div className="summary-grid">
        <SummaryCard label={t(lang, 'cardReported')} value={teamCount} unit={ut} />
        {hasSetup && (
          <SummaryCard
            label={t(lang, 'cardUnreported')}
            value={unreportedTeams.length}
            unit={ut}
            accent={unreportedTeams.length > 0 ? '#c0392b' : '#27ae60'}
          />
        )}
        <SummaryCard label={t(lang, 'cardTotal')} value={totalPeople} unit={up} />
        <SummaryCard label={t(lang, 'cardSafe')} value={safePeople} unit={up} accent="#27ae60" />
        <SummaryCard label={t(lang, 'cardUnconfirmed')} value={unconfirmedPeople} unit={up} accent={unconfirmedPeople > 0 ? '#e67e22' : undefined} />
        <SummaryCard
          label={t(lang, 'cardInjured')}
          value={totalInjured}
          unit={up}
          accent={totalInjured > 0 ? '#c0392b' : undefined}
        />
        {dangerCount > 0 && (
          <SummaryCard label={t(lang, 'cardDanger')} value={dangerCount} unit={ut} accent="#c0392b" />
        )}
      </div>

      {/* 全班報告完了バナー */}
      {allReported && (
        <div className="all-reported-banner">
          <span className="all-reported-icon">✓</span>
          {t(lang, 'allReported', registeredTeams.length)}
        </div>
      )}

      {/* 未報告班パネル */}
      {hasSetup && !allReported && (
        <div className="unreported-panel">
          <div className="unreported-header">
            <span className="unreported-label">{t(lang, 'unreportedLabel')}</span>
            <span className="unreported-count">{unreportedTeams.length} {ut}</span>
          </div>
          <div className="unreported-tags">
            {unreportedTeams.map((name) => (
              <span key={name} className="unreported-tag">{name}</span>
            ))}
          </div>
        </div>
      )}

      {/* 班一覧テーブル */}
      {reports.length === 0 ? (
        <div className="empty-state">
          <p>{t(lang, 'emptyLine1')}</p>
          <p>{t(lang, 'emptyLine2')}</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>{t(lang, 'colTeam')}</th>
                <th>{t(lang, 'colStatus')}</th>
                <th>{t(lang, 'colTotal')}</th>
                <th>{t(lang, 'colSafe')}</th>
                <th>{t(lang, 'colUnconfirmed')}</th>
                <th>{t(lang, 'colInjured')}</th>
                <th>{t(lang, 'colInjuredNames')}</th>
                <th>{t(lang, 'colLocation')}</th>
                <th>{t(lang, 'colRemarks')}</th>
                <th>{t(lang, 'colTime')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.班}
                  className={`row-${r.状態 === '危険' ? 'danger' : r.状態 === '要注意' ? 'caution' : 'safe'}`}
                >
                  <td className="cell-team" data-label={t(lang, 'colTeam')}>
                    {r.班}
                    {r.updated_at && <span className="update-tag">{t(lang, 'updated')}</span>}
                  </td>
                  <td data-label={t(lang, 'colStatus')}>
                    <span
                      className="status-badge"
                      style={{ background: STATUS_COLOR[r.状態] || '#555' }}
                    >
                      {statusLabel(r.状態, lang)}
                    </span>
                  </td>
                  <td className="cell-num" data-label={t(lang, 'colTotal')}>{r.人数}</td>
                  <td className="cell-num" data-label={t(lang, 'colSafe')} style={{ color: '#6b7a8d' }}>
                    {r.安全確認人数 ?? 0}
                  </td>
                  <td
                    className="cell-num"
                    data-label={t(lang, 'colUnconfirmed')}
                    style={(r.未確認人数 || 0) > 0 ? { color: '#e67e22', fontWeight: 700 } : { color: '#6b7a8d' }}
                  >
                    {r.未確認人数 ?? 0}
                  </td>
                  <td
                    className="cell-num"
                    data-label={t(lang, 'colInjured')}
                    style={r.負傷者 > 0 ? { color: '#e74c3c', fontWeight: 700 } : {}}
                  >
                    {r.負傷者}
                  </td>
                  <td className="cell-names" data-label={t(lang, 'colInjuredNames')}>
                    {r.負傷者名 && r.負傷者名.length > 0 ? r.負傷者名.join('、') : '—'}
                  </td>
                  <td data-label={t(lang, 'colLocation')}>{r.場所 || '—'}</td>
                  <td className="cell-remarks" data-label={t(lang, 'colRemarks')}>{r.備考 || '—'}</td>
                  <td className="cell-time" data-label={t(lang, 'colTime')}>
                    {r.updated_at ? (
                      <>
                        <span className="time-original">{formatTime(r.timestamp)}</span>
                        <span className="time-updated">{t(lang, 'updated')} {formatTime(r.updated_at)}</span>
                      </>
                    ) : formatTime(r.timestamp)}
                  </td>
                  <td className="cell-actions" data-label="">
                    <button
                      className="action-btn edit-action"
                      onClick={() => onEdit?.(r)}
                    >
                      {t(lang, 'edit')}
                    </button>
                    {r.history && r.history.length > 0 && (
                      <button
                        className="action-btn hist-action"
                        onClick={() => setHistoryTeam(r)}
                      >
                        {t(lang, 'history')} {r.history.length}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 危険班の詳細 */}
      {dangerCount > 0 && (
        <div className="danger-alert">
          <div className="danger-alert-title">{t(lang, 'dangerAlertTitle')}</div>
          {reports
            .filter((r) => r.状態 === '危険')
            .map((r) => (
              <div key={r.班} className="danger-detail">
                <strong>{r.班}</strong>：{r.raw_text}
              </div>
            ))}
        </div>
      )}

      {/* 履歴モーダル */}
      {historyTeam && (
        <HistoryModal
          team={historyTeam.班}
          history={historyTeam.history || []}
          onClose={() => setHistoryTeam(null)}
          lang={lang}
        />
      )}
    </div>
  )
}
