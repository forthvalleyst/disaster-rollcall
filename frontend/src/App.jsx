import { useState, useEffect, useRef, useCallback } from 'react'
import LeaderView from './LeaderView'
import HQView from './HQView'
import SetupView from './SetupView'
import { t } from './i18n'
import './App.css'

const STATUS_ORDER = { 危険: 0, 要注意: 1, 安全: 2 }

export default function App() {
  const [view, setView] = useState('leader')
  const [lang, setLang] = useState('ja')

  // ── 共有状態 ────────────────────────────────────────────
  const [reports, setReports] = useState([])
  const [registeredTeams, setRegisteredTeams] = useState([])
  const [members, setMembers] = useState([])
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const esRef = useRef(null)

  // ── メンバー初期ロード ──────────────────────────────────
  useEffect(() => {
    fetch('/api/members').then(r => r.json()).then(d => setMembers(d.members ?? []))
  }, [])

  // ── SSE 接続（App レベルで一元管理） ───────────────────
  useEffect(() => {
    function connect() {
      const es = new EventSource('/api/reports/stream')
      esRef.current = es

      es.onopen = () => setConnected(true)

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          // ペイロード: { reports: [...], teams: [...] }
          const sorted = [...(data.reports ?? [])].sort(
            (a, b) => (STATUS_ORDER[a.状態] ?? 3) - (STATUS_ORDER[b.状態] ?? 3)
          )
          setReports(sorted)
          setRegisteredTeams(data.teams ?? [])
          setLastUpdate(new Date())
        } catch {
          // ignore parse errors
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        setTimeout(connect, 5000)
      }
    }

    connect()
    return () => esRef.current?.close()
  }, [])

  // ── メンバー API ────────────────────────────────────────
  const addMember = useCallback(async (name, team) => {
    setMembers(prev => [...prev, { name, team }])
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, team }),
      })
      if (!res.ok && res.status !== 409) {
        setMembers(prev => prev.filter(m => !(m.name === name && m.team === team)))
      }
    } catch {
      setMembers(prev => prev.filter(m => !(m.name === name && m.team === team)))
    }
  }, [])

  const removeMember = useCallback(async (name, team) => {
    setMembers(prev => prev.filter(m => !(m.name === name && m.team === team)))
    try {
      await fetch(`/api/members/${encodeURIComponent(name)}?team=${encodeURIComponent(team)}`, { method: 'DELETE' })
    } catch { /* SSE will correct */ }
  }, [])

  // ── 班 API（楽観的更新 + SSE で最終同期） ───────────────
  const addTeam = useCallback(async (name) => {
    // 楽観的更新
    setRegisteredTeams((prev) => (prev.includes(name) ? prev : [...prev, name]))
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok && res.status !== 409) {
        // 409（重複）以外のエラーはロールバック
        setRegisteredTeams((prev) => prev.filter((t) => t !== name))
      }
    } catch {
      setRegisteredTeams((prev) => prev.filter((t) => t !== name))
    }
  }, [])

  const removeTeam = useCallback(async (name) => {
    setRegisteredTeams((prev) => prev.filter((t) => t !== name))
    try {
      await fetch(`/api/teams/${encodeURIComponent(name)}`, { method: 'DELETE' })
    } catch {
      // SSE が次回のポーリングで正しい状態に戻す
    }
  }, [])

  const clearTeams = useCallback(async () => {
    setRegisteredTeams([])
    try {
      await fetch('/api/teams', { method: 'DELETE' })
    } catch {
      // SSE で補正
    }
  }, [])

  const applyPreset = useCallback(async (presetTeams) => {
    const newTeams = presetTeams.filter((name) => !registeredTeams.includes(name))
    // 楽観的更新をまとめて行う
    setRegisteredTeams((prev) => [...new Set([...prev, ...newTeams])])
    for (const name of newTeams) {
      try {
        await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
      } catch {
        // 無視（SSE で補正）
      }
    }
  }, [registeredTeams])

  // ── リセット ────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    await fetch('/api/reset', { method: 'POST' })
    setReports([])
  }, [])

  // ── 編集対象（本部 → 班リーダー画面へのデータ受け渡し） ──
  const [editTarget, setEditTarget] = useState(null)

  const handleEditReport = useCallback((reportData) => {
    setEditTarget(reportData)
    setView('leader')
  }, [])

  const handleEditLoaded = useCallback(() => {
    setEditTarget(null)
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          <span className="header-icon">&#9888;</span>
          {t(lang, 'appTitle')}
        </div>
        <div className="header-right">
          <nav className="header-nav">
            <button
              className={`nav-btn ${view === 'leader' ? 'active' : ''}`}
              onClick={() => setView('leader')}
            >
              {t(lang, 'navLeader')}
            </button>
            <button
              className={`nav-btn ${view === 'hq' ? 'active' : ''}`}
              onClick={() => setView('hq')}
            >
              {t(lang, 'navHQ')}
            </button>
            <button
              className={`nav-btn nav-btn-setup ${view === 'setup' ? 'active' : ''}`}
              onClick={() => setView('setup')}
            >
              {t(lang, 'navSetup')}
              {registeredTeams.length > 0 && (
                <span className="nav-badge">{registeredTeams.length}</span>
              )}
            </button>
          </nav>
          <div className="lang-toggle">
            <button
              className={`lang-btn ${lang === 'ja' ? 'active' : ''}`}
              onClick={() => setLang('ja')}
            >JP</button>
            <button
              className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
            >EN</button>
          </div>
        </div>
      </header>

      <main className="main">
        {view === 'leader' && (
          <LeaderView
            registeredTeams={registeredTeams}
            editTarget={editTarget}
            onEditLoaded={handleEditLoaded}
            members={members}
            lang={lang}
          />
        )}
        {view === 'hq' && (
          <HQView
            reports={reports}
            registeredTeams={registeredTeams}
            connected={connected}
            lastUpdate={lastUpdate}
            onReset={handleReset}
            onEdit={handleEditReport}
            lang={lang}
          />
        )}
        {view === 'setup' && (
          <SetupView
            teams={registeredTeams}
            onAdd={addTeam}
            onRemove={removeTeam}
            onClear={clearTeams}
            onApplyPreset={applyPreset}
            members={members}
            onAddMember={addMember}
            onRemoveMember={removeMember}
            lang={lang}
          />
        )}
      </main>
    </div>
  )
}
