# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

災害時にオフライン LAN 環境で動作する人員点呼 Web アプリ。班リーダーが日本語テキストで報告を入力すると、Ollama 上の LLM が JSON に構造化し、本部画面でリアルタイムに集計表示する。

## 開発コマンド

### バックエンド（Flask）
```bash
# 依存パッケージのインストール
pip install -r requirements.txt

# 開発サーバー起動（ポート 5000）
python app.py
```

### フロントエンド（React + Vite）
```bash
cd frontend

# 依存パッケージのインストール
npm install

# 開発サーバー起動（ポート 3000、Flask へのプロキシ付き）
npm run dev

# プロダクションビルド
npm run build
```

## アーキテクチャ

```
[スマホ/PC ブラウザ :3000]
        │  /api/* プロキシ
        ▼
[Vite 開発サーバー]  ─── 静的ファイル配信
        │
        ▼
[Flask :5000]  ──── POST /api/report ──▶ [Ollama :11434]
                                              (gemma4:e2b)
```

**データフロー（班リーダー報告）**

1. LeaderView がテキストを `POST /api/report` へ送信
2. `call_ollama()` が Ollama の `/api/generate` を呼び出し、`format: "json"` で構造化
3. `extract_json()` がレスポンスを正規化（マークダウン除去 → 括弧深度トラッキング → 途中切れ修復）
4. `reports` dict（インメモリ、キー=班名）に上書き保存
5. SSE ストリーム (`/api/reports/stream`) が 1 秒ポーリングで差分を HQView へ配信

**同一班名で再報告すると上書き**（履歴は保持しない）。サーバー再起動でデータは消える。

## 主要ファイルの役割

| ファイル | 役割 |
|---|---|
| `app.py` | Flask API・Ollama 呼び出し・SSE ストリーム |
| `frontend/src/LeaderView.jsx` | 班リーダー報告入力フォーム |
| `frontend/src/HQView.jsx` | 本部集計画面（SSE 受信・テーブル/カード表示） |
| `frontend/vite.config.js` | `/api` を `127.0.0.1:5000` へプロキシ、`host: 0.0.0.0` で外部公開 |

## JSON スキーマ

```json
{"班": "", "人数": 0, "状態": "安全|要注意|危険", "負傷者": 0, "負傷者名": [], "場所": ""}
```

## Ollama の設定

- エンドポイント: `http://localhost:11434/api/generate`
- モデル: `gemma4:e2b`（`app.py` の `MODEL` 定数で変更可）
- `num_predict: 512` でトークン打ち切りを防止
- モデル変更時は `ollama pull <model>` が必要

## extract_json の処理順序

Gemma のレスポンスが不安定なため、4 段階でフォールバックする：

1. レスポンス全体を `json.loads`（`format: "json"` の正常系）
2. マークダウンコードフェンス除去後に再試行
3. 括弧深度トラッキングで最初の `{...}` ブロックを抽出
4. 途中切れの場合は `_repair_truncated_json` で `]` `}` を補完して再試行

## ハッカソン情報
Gemma 4 Good Hackathon 2026
締め切り：2026年5月18日
トラック：Global Resilience