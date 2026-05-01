import os
import re
import json
import time
import threading

import requests
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=[
    # ローカル開発（HTTP / HTTPS どちらも許可）
    r"http://localhost:3000",
    r"https://localhost:3000",
    # LAN 内スマホからの HTTPS アクセス（任意の IP アドレスを許可）
    r"https://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$",
], supports_credentials=False)

# ── データ永続化 ───────────────────────────────────────────────────────────────
# teams はサーバー再起動後も保持（設定データ）
# reports はリセットボタンで消去（訓練単位）

_BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
_TEAMS_FILE  = os.path.join(_BASE_DIR, "teams.json")
_REPORTS_FILE = os.path.join(_BASE_DIR, "reports.json")
_MEMBERS_FILE = os.path.join(_BASE_DIR, "members.json")


def _load_teams() -> list:
    try:
        with open(_TEAMS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_teams() -> None:
    """ロック内で呼ぶこと。"""
    with open(_TEAMS_FILE, "w", encoding="utf-8") as f:
        json.dump(teams, f, ensure_ascii=False, indent=2)


def _load_members() -> list:
    try:
        with open(_MEMBERS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_members() -> None:
    """ロック内で呼ぶこと。"""
    with open(_MEMBERS_FILE, "w", encoding="utf-8") as f:
        json.dump(members, f, ensure_ascii=False, indent=2)


def _load_reports() -> dict:
    try:
        with open(_REPORTS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_reports() -> None:
    """ロック内で呼ぶこと。"""
    with open(_REPORTS_FILE, "w", encoding="utf-8") as f:
        json.dump(reports, f, ensure_ascii=False, indent=2)


reports: dict = _load_reports()  # key: 正規化済み班名, value: report dict
teams:   list = _load_teams()    # 登録済み班名リスト（ファイルから復元）
members: list = _load_members()  # 登録済みメンバーリスト
lock = threading.Lock()

# ── 班名正規化 ──────────────────────────────────────────────────────────────

# 全角数字 → 半角変換テーブル
_FULLWIDTH = str.maketrans("０１２３４５６７８９", "0123456789")

# 音声認識誤変換: 「般」「版」「販」→「班」
_MISREAD = str.maketrans("般版販", "班班班")

# 漢数字 1桁 → 整数値
_KANJI_DIGIT: dict[str, int] = {
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
    "六": 6, "七": 7, "八": 8, "九": 9,
}


def _kanji_to_arabic(s: str) -> str:
    """文字列中の漢数字（十の位まで）をアラビア数字に変換する。

    対応パターン例:
        三     → 3
        十     → 10
        十二   → 12
        二十   → 20
        三十五 → 35
    """
    def _replace(m: re.Match) -> str:
        t = m.group()
        if "十" in t:
            left, right = t.split("十", 1)
            tens = _KANJI_DIGIT.get(left, 1) * 10 if left else 10
            ones = _KANJI_DIGIT.get(right, 0) if right else 0
            return str(tens + ones)
        return str(_KANJI_DIGIT.get(t, t))

    # 「N十M」「十M」「N十」「N」の順にマッチ
    pattern = r"[一二三四五六七八九]?十[一二三四五六七八九]?|[一二三四五六七八九]"
    return re.sub(pattern, _replace, s)


def normalize_team_name(name: str) -> str:
    """班名の表記ゆれを正規化する。

    Examples:
        "第三班"   → "第3班"
        "第3班"    → "第3班"
        "3班"      → "第3班"
        "三班"     → "第3班"
        "第十二班" → "第12班"
        "A班"      → "A班"   （非数字班名はそのまま）
    """
    s = name.strip()
    s = s.translate(_MISREAD)     # 誤変換文字 → 班
    s = s.translate(_FULLWIDTH)   # 全角数字 → 半角
    s = _kanji_to_arabic(s)       # 漢数字 → アラビア数字
    # "N班" → "第N班"（先頭が数字で始まる場合のみ）
    s = re.sub(r"^(\d+)(班)", r"第\1\2", s)
    return s

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "gemma4:e2b"

# 班一覧が登録されているときのみプロンプトに差し込むヒント
_TEAMS_HINT = """
登録済みの班名一覧：{teams_list}
報告テキストの班名は必ず上記一覧から最も近いものを選んでください。
一覧にない場合のみそのままの班名を使用してください。"""


def _build_teams_hint(registered_teams: list[str]) -> str:
    """登録済み班がある場合のみヒント文字列を返す。なければ空文字。"""
    if not registered_teams:
        return ""
    return _TEAMS_HINT.format(teams_list="、".join(registered_teams))


# ── Ollama 構造化出力スキーマ ─────────────────────────────────────────────
# format フィールドに文字列 "json" の代わりにスキーマ dict を渡すことで
# Ollama がフィールド型・enum を強制するモードになる（Ollama 0.4.x 以降）
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "班":         {"type": "string"},
        "人数":       {"type": "integer"},
        "安全確認人数": {"type": "integer"},
        "未確認人数":  {"type": "integer"},
        "負傷者":     {"type": "integer"},
        "負傷者名":   {"type": "array", "items": {"type": "string"}},
        "状態":       {"type": "string", "enum": ["安全", "要注意", "危険"]},
        "場所":       {"type": "string"},
        "備考":       {"type": "string"},
    },
    "required": [
        "班", "人数", "安全確認人数", "未確認人数",
        "負傷者", "負傷者名", "状態", "場所", "備考",
    ],
}

PROMPT_TEMPLATE = """あなたは災害時の人員点呼システムです。
入力されたテキストを解析し、指定のJSONフォーマットで出力してください。他の文章は不要です。

【出力フィールドの説明】
- 班: 班名（文字列）
- 人数: 総員数（整数）
- 安全確認人数: 安全が確認された人数（整数）
- 未確認人数: 安否未確認の人数（整数）
- 負傷者: 負傷者の人数（整数）
- 負傷者名: 負傷者の氏名リスト（配列、なければ []）。氏名には「さん」「くん」等の敬称を含めないこと
- 状態: 必ず「安全」「要注意」「危険」のいずれか一つ（他の値は禁止）
- 場所: 集合・報告場所（文字列、不明なら ""）

【状態の判定ルール】（必ずこのルールに従うこと）
- 「安全」  ：負傷者が 0 名 かつ 安否未確認が 0 名
- 「要注意」：負傷者が 1 名以上、または 安否未確認が 1 名以上
- 「危険」  ：重傷者がいる、または 行方不明者がいる
- 優先度: 危険 > 要注意 > 安全

【その他の制約】
- 安全確認人数 + 未確認人数 + 負傷者 = 人数 になるよう調整すること
- 不明な数値項目は 0、不明な文字列項目は "" とする
{teams_hint}
【入力テキスト】
{text}"""

PROMPT_TEMPLATE_UPDATE = """あなたは災害時の人員点呼システムです。
「既存の報告」と「新しい報告テキスト」を統合し、最新状態を指定のJSONフォーマットで出力してください。他の文章は不要です。

【既存の報告（JSON）】
{previous_json}

【新しい報告テキスト】
{text}

【統合ルール】
- 新しいテキストで明示された項目は新しい値を優先する
- 新しいテキストで言及がない項目は既存の値をそのまま引き継ぐ
- 負傷者名は既存と新しい報告の両方から収集し、重複を除いて統合する。氏名に敬称（さん・くん等）を含めないこと
- 負傷者数は統合後の負傷者名リストの人数に合わせる
- 安全確認人数 + 未確認人数 + 負傷者 = 人数 になるよう調整すること

【状態の判定ルール】（必ずこのルールに従うこと）
- 「安全」  ：負傷者が 0 名 かつ 安否未確認が 0 名
- 「要注意」：負傷者が 1 名以上、または 安否未確認が 1 名以上
- 「危険」  ：重傷者がいる、または 行方不明者がいる
- 優先度: 危険 > 要注意 > 安全
{teams_hint}"""


def _find_outermost_brace_block(text: str) -> tuple[str | None, bool]:
    """括弧の深さを追跡し、最初の {...} ブロックを返す。
    戻り値: (抽出文字列 | None, 完全に閉じているか)
    - 完全ブロック: depth が 0 に戻った時点で確定
    - 不完全ブロック: テキスト末尾まで到達しても depth > 0 なら途中切れと判断して返す
    """
    depth = 0
    start = None
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                return text[start : i + 1], True  # 完全ブロック
    # テキスト終端まで読んでも閉じなかった → 途中切れ
    if start is not None:
        return text[start:], False  # 不完全ブロック
    return None, False


def _repair_truncated_json(fragment: str) -> str:
    """トークン上限による途中切れを補修する。
    末尾の不完全な文字列・カンマを除去し、不足する ] } を閉じる。"""
    # 末尾の余分なカンマ・空白を除去
    s = fragment.rstrip().rstrip(",")
    # 開きっぱなしの文字列リテラルを閉じる（奇数個の " がある場合）
    if s.count('"') % 2 == 1:
        s += '"'
    # 不足する ] と } を補完
    open_brackets = s.count("[") - s.count("]")
    open_braces = s.count("{") - s.count("}")
    s += "]" * max(0, open_brackets)
    s += "}" * max(0, open_braces)
    return s


def extract_json(raw: str) -> dict:
    # Step 1: markdownコードフェンスを除去
    text = re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()

    # Step 2: レスポンス全体を直接パース（format="json" 指定時の正常系）
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Step 3: 括弧深度トラッキングで {...} ブロックを抽出
    candidate, is_complete = _find_outermost_brace_block(text)
    if candidate is None:
        raise ValueError(
            f"レスポンスに JSON ブロックが見つかりません。\n"
            f"生レスポンス（先頭 300 文字）: {raw[:300]}"
        )

    # 完全ブロックであればそのままパース
    if is_complete:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass  # 完全に閉じていても内容が不正な場合は修復へ

    # Step 4: 途中切れ（または内容不正）→ 修復を試みる
    repaired = _repair_truncated_json(candidate)
    try:
        result = json.loads(repaired)
        if not is_complete:
            print(f"[INFO] 途中切れ JSON を修復してパースしました。修復前末尾: ...{candidate[-80:]}")
        return result
    except json.JSONDecodeError as e:
        raise ValueError(
            f"JSON の抽出・修復に失敗しました。\n"
            f"抽出候補: {candidate[:300]}\n"
            f"修復後  : {repaired[:300]}\n"
            f"エラー  : {e}"
        )


def call_ollama(
    text: str,
    previous: dict | None = None,
    registered_teams: list[str] | None = None,
) -> dict:
    """Ollama を呼び出して報告テキストを JSON に変換する。

    Args:
        text:             班リーダーの報告テキスト
        previous:         同一班の既存報告 dict（ある場合は統合プロンプトを使用）
        registered_teams: 登録済み班名一覧（班名マッチングヒントとして使用）
    """
    teams_hint = _build_teams_hint(registered_teams or [])

    if previous is not None:
        # 統合プロンプト：timestamp / raw_text は LLM に渡さない
        prev_json = json.dumps(
            {k: v for k, v in previous.items() if k not in ("timestamp", "raw_text")},
            ensure_ascii=False,
        )
        prompt = PROMPT_TEMPLATE_UPDATE.format(
            previous_json=prev_json, text=text, teams_hint=teams_hint
        )
    else:
        prompt = PROMPT_TEMPLATE.format(text=text, teams_hint=teams_hint)

    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        # スキーマ dict を渡すことでフィールド型・enum を Ollama が強制する
        # （Ollama 0.4.x 以降対応。旧バージョンでは "json" と同等にフォールバック）
        "format": OUTPUT_SCHEMA,
        "options": {
            "temperature": 0.1,
            # JSON が途中で打ち切られないよう十分なトークン数を確保
            "num_predict": 512,
        },
    }
    resp = requests.post(OLLAMA_URL, json=payload, timeout=120)
    resp.raise_for_status()

    body = resp.json()
    raw_response = body.get("response", "")

    # トークン上限による打ち切りを検出して警告
    if body.get("done_reason") == "length":
        print(
            "[WARNING] Ollama のレスポンスがトークン上限 (num_predict=512) で打ち切られました。"
            " JSON 修復を試みます。"
        )

    return extract_json(raw_response)


# 氏名末尾から除去する敬称パターン
_HONORIFIC_RE = re.compile(
    r'(さん|くん|ちゃん|様|殿|氏|先生|君|さま|どの)$'
)


def _strip_honorifics(name: str) -> str:
    """氏名末尾の敬称を除去する。

    Examples:
        "田中さん"   → "田中"
        "鈴木くん"   → "鈴木"
        "佐藤先生"   → "佐藤"
        "山田"       → "山田"  （変化なし）
    """
    return _HONORIFIC_RE.sub("", name.strip()).strip()


def _normalize_parsed(parsed: dict) -> dict:
    """Ollama の出力 dict を正規化・型変換・整合性補正して返す（破壊的変更）。"""
    # ── デフォルト値 ──────────────────────────────────────────────────────
    parsed.setdefault("班", "不明")
    parsed.setdefault("人数", 0)
    parsed.setdefault("安全確認人数", 0)
    parsed.setdefault("未確認人数", 0)
    parsed.setdefault("状態", "要注意")
    parsed.setdefault("負傷者", 0)
    parsed.setdefault("負傷者名", [])
    parsed.setdefault("場所", "")
    parsed.setdefault("備考", "")

    # ── 班名正規化（"第三班" → "第3班" など） ────────────────────────────
    parsed["班"] = normalize_team_name(parsed["班"] or "不明")

    # ── 数値フィールドの型変換 ────────────────────────────────────────────
    for key in ("人数", "安全確認人数", "未確認人数", "負傷者"):
        try:
            parsed[key] = int(parsed[key])
        except (TypeError, ValueError):
            parsed[key] = 0

    # ── 負傷者名の正規化（list 型補正 + 敬称除去 + 空文字除去） ────────────
    if not isinstance(parsed.get("負傷者名"), list):
        parsed["負傷者名"] = []
    cleaned_names = [_strip_honorifics(n) for n in parsed["負傷者名"] if isinstance(n, str)]
    parsed["負傷者名"] = [n for n in cleaned_names if n]  # 空文字を除外

    # ── 状態の厳密化（3択以外はデフォルトへ） ────────────────────────────
    if parsed["状態"] not in ("安全", "要注意", "危険"):
        print(f"[WARNING] 不正な状態値 {parsed['状態']!r} → '要注意' に補正")
        parsed["状態"] = "要注意"

    # ── 人数の整合性チェック: 安全確認 + 未確認 + 負傷者 = 人数 ───────────
    total    = parsed["人数"]
    safe     = parsed["安全確認人数"]
    unknown  = parsed["未確認人数"]
    injured  = parsed["負傷者"]
    calc_sum = safe + unknown + injured

    if total == 0 and calc_sum > 0:
        # 総員数が 0 だが内訳がある → 合計を総員数として採用
        parsed["人数"] = calc_sum
    elif total > 0 and calc_sum != total:
        # 差分を未確認人数で吸収（安全確認・負傷者は報告値を優先）
        adjusted_unknown = max(0, total - safe - injured)
        if adjusted_unknown != unknown:
            print(
                f"[INFO] 人数整合性補正: "
                f"安全{safe}+未確認{unknown}+負傷{injured}={calc_sum} ≠ 総員{total} "
                f"→ 未確認を {adjusted_unknown} に補正"
            )
        parsed["未確認人数"] = adjusted_unknown

    # ── 状態と数値の矛盾を後処理で補正 ──────────────────────────────────
    # 「危険」はテキスト判断（重傷・行方不明）なので LLM の判定を尊重し変更しない。
    # 「安全」と数値が矛盾する場合のみ自動補正する。
    final_injured  = parsed["負傷者"]
    final_unknown  = parsed["未確認人数"]
    if parsed["状態"] == "安全" and (final_injured > 0 or final_unknown > 0):
        print(
            f"[INFO] 状態補正: '安全' だが 負傷{final_injured}名・未確認{final_unknown}名 "
            f"→ '要注意' に変更"
        )
        parsed["状態"] = "要注意"

    return parsed


@app.route("/api/report/structured", methods=["POST"])
def submit_report_structured():
    """フォーム入力による構造化データを直接受け取り、Ollama を使わずに保存する。"""
    data = request.get_json(force=True)

    # 負傷者名: カンマ / 読点区切りの文字列 → リスト
    names_raw = data.get("負傷者名") or ""
    if isinstance(names_raw, str):
        names_list = [n.strip() for n in re.split(r'[,、，]', names_raw) if n.strip()]
    else:
        names_list = [str(n) for n in names_raw if n]

    parsed = {
        "班":           data.get("班", "不明"),
        "人数":         data.get("人数", 0),
        "安全確認人数": data.get("安全確認人数", 0),
        "未確認人数":   data.get("未確認人数", 0),
        "負傷者":       data.get("負傷者", 0),
        "負傷者名":     names_list,
        "状態":         data.get("状態", "安全"),
        "場所":         data.get("場所", ""),
        "備考":         (data.get("備考") or "").strip(),
    }

    parsed = _normalize_parsed(parsed)
    now = time.time()

    # 既存報告があれば元の timestamp を引き継ぎ、updated_at を記録
    with lock:
        existing = reports.get(parsed["班"])

    if existing:
        prev_snapshot = {k: v for k, v in existing.items() if k != "history"}
        parsed["history"]    = existing.get("history", []) + [prev_snapshot]
        parsed["timestamp"]  = existing.get("timestamp", now)
        parsed["updated_at"] = now
    else:
        parsed["history"]    = []
        parsed["timestamp"]  = now
        parsed["updated_at"] = None

    parsed["raw_text"] = (data.get("raw_text") or "").strip()

    with lock:
        reports[parsed["班"]] = parsed
        _save_reports()

    return jsonify({"success": True, "data": parsed})


@app.route("/api/report", methods=["POST"])
def submit_report():
    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "テキストが空です"}), 400

    # 登録済み班一覧を Ollama 呼び出し前に取得（ロック外で使用するためコピー）
    with lock:
        registered = list(teams)

    try:
        # ── Step 1: 新規テキストを解析して班名を特定 ──────────────────
        parsed = _normalize_parsed(call_ollama(text, registered_teams=registered))
        team_name = parsed["班"]

        # ── Step 2: 既存報告があれば統合プロンプトで再解析 ────────────
        with lock:
            existing = reports.get(team_name)

        if existing is not None:
            print(f"[INFO] 既存報告あり（{team_name}）→ 統合プロンプトで再解析します。")
            parsed = _normalize_parsed(
                call_ollama(text, previous=existing, registered_teams=registered)
            )
            parsed["班"] = team_name  # 正規化済みの班名を保持

    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Ollamaに接続できません。localhost:11434 が起動しているか確認してください"}), 503
    except Exception as e:
        return jsonify({"error": f"AI解析エラー: {e}"}), 500

    parsed["timestamp"] = time.time()
    parsed["raw_text"] = text

    with lock:
        reports[parsed["班"]] = parsed

    return jsonify({"success": True, "data": parsed})


@app.route("/api/teams", methods=["GET"])
def get_teams():
    with lock:
        return jsonify({"teams": list(teams)})


@app.route("/api/teams", methods=["POST"])
def add_team():
    data = request.get_json(force=True)
    raw_name = (data.get("name") or "").strip()
    if not raw_name:
        return jsonify({"error": "班名が空です"}), 400
    name = normalize_team_name(raw_name)  # 正規化して統一
    with lock:
        if name in teams:
            return jsonify({"error": "すでに登録されています"}), 409
        teams.append(name)
        _save_teams()
        return jsonify({"success": True, "teams": list(teams)})


@app.route("/api/teams/<name>", methods=["DELETE"])
def remove_team(name):
    with lock:
        if name not in teams:
            return jsonify({"error": "班が見つかりません"}), 404
        teams.remove(name)
        _save_teams()
        return jsonify({"success": True, "teams": list(teams)})


@app.route("/api/teams", methods=["DELETE"])
def clear_teams():
    with lock:
        teams.clear()
        _save_teams()
    return jsonify({"success": True, "teams": []})


@app.route("/api/members", methods=["GET"])
def get_members():
    with lock:
        return jsonify({"members": list(members)})


@app.route("/api/members", methods=["POST"])
def add_member():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    team = (data.get("team") or "").strip()
    if not name:
        return jsonify({"error": "名前が空です"}), 400
    with lock:
        if any(m["name"] == name and m["team"] == team for m in members):
            return jsonify({"error": "すでに登録されています"}), 409
        members.append({"name": name, "team": team})
        _save_members()
        return jsonify({"success": True, "members": list(members)})


@app.route("/api/members/<name>", methods=["DELETE"])
def remove_member(name):
    team = request.args.get("team", "")
    with lock:
        before = len(members)
        members[:] = [m for m in members if not (m["name"] == name and m["team"] == team)]
        if len(members) == before:
            return jsonify({"error": "メンバーが見つかりません"}), 404
        _save_members()
        return jsonify({"success": True, "members": list(members)})


@app.route("/api/reports", methods=["GET"])
def get_reports():
    with lock:
        return jsonify(list(reports.values()))


@app.route("/api/reports/stream")
def stream_reports():
    def generate():
        last_hash = None
        while True:
            try:
                with lock:
                    snapshot = {
                        "reports": list(reports.values()),
                        "teams": list(teams),
                    }
                payload = json.dumps(snapshot, ensure_ascii=False)
                h = hash(payload)
                if h != last_hash:
                    last_hash = h
                    yield f"data: {payload}\n\n"
                time.sleep(1)
            except GeneratorExit:
                # クライアントが接続を切断した（ECONNRESET 含む）
                return
            except Exception as e:
                print(f"[WARNING] SSE ストリーム中にエラーが発生しました: {e}")
                return

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/reset", methods=["POST"])
def reset_reports():
    with lock:
        reports.clear()
        _save_reports()
    return jsonify({"success": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)
