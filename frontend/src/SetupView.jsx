import { useState } from 'react'
import { t } from './i18n'
import './SetupView.css'

const PRESETS = [
  { label: '第一〜三班', teams: ['第一班', '第二班', '第三班'] },
  { label: '第一〜五班', teams: ['第一班', '第二班', '第三班', '第四班', '第五班'] },
  {
    label: '第一〜十班',
    teams: [
      '第一班', '第二班', '第三班', '第四班', '第五班',
      '第六班', '第七班', '第八班', '第九班', '第十班',
    ],
  },
]

export default function SetupView({ teams, onAdd, onRemove, onClear, onApplyPreset, members = [], onAddMember, onRemoveMember, lang = 'ja' }) {
  const [input, setInput] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const [expandedTeam, setExpandedTeam] = useState(null)
  const [memberInputs, setMemberInputs] = useState({}) // team → input value

  const addTeam = async () => {
    const name = input.trim()
    if (!name) return
    if (teams.includes(name)) {
      setShake(true)
      setTimeout(() => setShake(false), 400)
      return
    }
    await onAdd(name)
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTeam()
    }
  }

  const handleApplyPreset = async (presetTeams) => {
    setBusy(true)
    await onApplyPreset(presetTeams)
    setBusy(false)
  }

  const getMemberInput = (team) => memberInputs[team] ?? ''
  const setMemberInput = (team, val) => setMemberInputs(prev => ({ ...prev, [team]: val }))

  const handleAddMember = async (team) => {
    const name = getMemberInput(team).trim()
    if (!name) return
    await onAddMember(name, team)
    setMemberInput(team, '')
  }

  const handleMemberKeyDown = (e, team) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddMember(team)
    }
  }

  return (
    <div className="setup-view">
      <h1 className="setup-title">{t(lang, 'setupTitle')}</h1>
      <p className="setup-desc">{t(lang, 'setupDesc')}</p>

      {/* プリセット */}
      <section className="setup-section">
        <h2 className="setup-section-title">{t(lang, 'presetTitle')}</h2>
        <div className="preset-row">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className="preset-btn"
              onClick={() => handleApplyPreset(p.teams)}
              disabled={busy}
            >
              {busy ? t(lang, 'registering') : p.label}
            </button>
          ))}
        </div>
      </section>

      {/* 手動追加 */}
      <section className="setup-section">
        <h2 className="setup-section-title">{t(lang, 'manualTitle')}</h2>
        <div className={`add-row ${shake ? 'shake' : ''}`}>
          <input
            className="team-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t(lang, 'teamInputPlaceholder')}
            maxLength={20}
          />
          <button
            className="add-btn"
            onClick={addTeam}
            disabled={!input.trim()}
          >
            {t(lang, 'addBtn')}
          </button>
        </div>
        {shake && (
          <p className="dup-msg">{t(lang, 'duplicateMsg')}</p>
        )}
      </section>

      {/* 登録済みリスト */}
      <section className="setup-section">
        <div className="setup-list-header">
          <h2 className="setup-section-title">
            {t(lang, 'registeredTitle')}
            <span className="team-count">{teams.length}</span>
          </h2>
          {teams.length > 0 && (
            <button className="clear-btn" onClick={onClear}>
              {t(lang, 'clearAll')}
            </button>
          )}
        </div>

        {teams.length === 0 ? (
          <div className="setup-empty">
            {t(lang, 'setupEmpty').split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </div>
        ) : (
          <ul className="team-list">
            {teams.map((name, i) => {
              const isExpanded = expandedTeam === name
              const teamMembers = members.filter(m => m.team === name)
              return (
                <li key={name} className="team-item">
                  <div
                    className="team-item-row"
                    onClick={() => setExpandedTeam(isExpanded ? null : name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="team-index">{i + 1}</span>
                    <span className="team-name">{name}</span>
                    <button
                      className="remove-btn"
                      onClick={(e) => { e.stopPropagation(); onRemove(name) }}
                      aria-label={`${name}を削除`}
                    >
                      ✕
                    </button>
                    <span className="team-toggle">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                  {isExpanded && (
                    <div className="member-section">
                      {teamMembers.length > 0 && (
                        <div className="member-list">
                          {teamMembers.map((m) => (
                            <span key={m.name} className="member-chip">
                              {m.name}
                              <button
                                className="member-chip-remove"
                                onClick={() => onRemoveMember(m.name, name)}
                                aria-label={`${m.name}を削除`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="member-add-row">
                        <input
                          className="member-input"
                          value={getMemberInput(name)}
                          onChange={(e) => setMemberInput(name, e.target.value)}
                          onKeyDown={(e) => handleMemberKeyDown(e, name)}
                          placeholder={t(lang, 'memberInputPlaceholder')}
                          maxLength={20}
                        />
                        <button
                          className="member-add-btn"
                          onClick={() => handleAddMember(name)}
                          disabled={!getMemberInput(name).trim()}
                        >
                          {t(lang, 'addBtn')}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
