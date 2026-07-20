from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from redis import Redis
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    select,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://novel_app:3er4%23ER%24@127.0.0.1:5432/novel_platform")
REDIS_URL = os.getenv("REDIS_URL", "redis://:3er4%23ER%24@127.0.0.1:6380/0")
SMS_MOCK_CODE = os.getenv("SMS_MOCK_CODE", "123456")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
OH_STORY_ROOT = Path(os.getenv("OH_STORY_ROOT", r"D:\code\codex\oh-story\_skills\skills\story-short-write"))

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
redis_client = Redis.from_url(REDIS_URL, decode_responses=True)

app = FastAPI(title="短篇小说生成 API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Base(DeclarativeBase):
    pass


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nickname: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(20), default="user")
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    collections: Mapped[list["NovelCollection"]] = relationship(back_populates="user")
    novels: Mapped[list["Novel"]] = relationship(back_populates="user")


class NovelCollection(Base):
    __tablename__ = "novel_collections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    user: Mapped[User] = relationship(back_populates="collections")
    novels: Mapped[list["Novel"]] = relationship(back_populates="collection")


class Novel(Base):
    __tablename__ = "novels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    collection_id: Mapped[str | None] = mapped_column(ForeignKey("novel_collections.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    genre: Mapped[str] = mapped_column(String(60))
    target_words: Mapped[int] = mapped_column(Integer, default=10000)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    pipeline_mode: Mapped[str] = mapped_column(String(20), default="manual")
    emotion_goal: Mapped[str] = mapped_column(String(60), default="克制催泪")
    premise: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_template_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    final_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    user: Mapped[User] = relationship(back_populates="novels")
    collection: Mapped[NovelCollection | None] = relationship(back_populates="novels")
    nodes: Mapped[list["NodeProgress"]] = relationship(back_populates="novel", cascade="all, delete-orphan")
    reports: Mapped[list["ReviewReport"]] = relationship(back_populates="novel", cascade="all, delete-orphan")


class NodeProgress(Base):
    __tablename__ = "node_progress"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    node_index: Mapped[int] = mapped_column(Integer)
    node_type: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default="pending")
    cards: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    selected_card: Mapped[str | None] = mapped_column(String(80), nullable=True)
    selected_card_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    novel: Mapped[Novel] = relationship(back_populates="nodes")


class ReviewReport(Base):
    __tablename__ = "review_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    round_no: Mapped[int] = mapped_column(Integer)
    source_snapshot: Mapped[str] = mapped_column(Text)
    report: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    novel: Mapped[Novel] = relationship(back_populates="reports")


class AdminPrompt(Base):
    __tablename__ = "admin_node_prompts"

    node_type: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(100))
    system_prompt: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class PublishingPlatform(Base):
    __tablename__ = "publishing_platforms"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    fit: Mapped[str] = mapped_column(String(200))
    format_note: Mapped[str] = mapped_column(Text)
    guide: Mapped[str] = mapped_column(Text)


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    system_prompt: Mapped[str] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SmsRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=20)


class SmsLoginRequest(BaseModel):
    phone: str
    code: str


class UserUpdate(BaseModel):
    nickname: str | None = None
    avatar_url: str | None = None


class NovelCreate(BaseModel):
    title: str
    genre: str
    target_words: int = Field(ge=8000, le=20000)
    collection_id: str | None = None
    pipeline_mode: Literal["manual", "auto"] = "manual"
    emotion_goal: str = "克制催泪"
    premise: str | None = None
    prompt_template_id: str | None = "oh-story"


class ConfirmNodeRequest(BaseModel):
    card_id: str
    edited_content: str | None = None
    edited_card: dict[str, Any] | None = None
    reset_after: bool = False


class ChatEditRequest(BaseModel):
    message: str
    current_content: str | None = None
    current_card: dict[str, Any] | None = None
    scope: Literal["card", "field"] = "card"
    field: str | None = None


class ReviewRequest(BaseModel):
    content: str | None = None


class WritingSaveRequest(BaseModel):
    content: str
    title: str | None = None
    confirm_complete: bool = True


class PromptUpdate(BaseModel):
    system_prompt: str


def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def serialize_novel(novel: Novel) -> dict[str, Any]:
    return {
        "id": novel.id,
        "title": novel.title,
        "genre": novel.genre,
        "target_words": novel.target_words,
        "word_count": novel.word_count,
        "status": novel.status,
        "pipeline_mode": novel.pipeline_mode,
        "emotion_goal": novel.emotion_goal,
        "premise": novel.premise,
        "prompt_template_id": novel.prompt_template_id,
        "collection_id": novel.collection_id,
        "final_content": novel.final_content,
        "updated_at": novel.updated_at.isoformat() if novel.updated_at else None,
    }


def read_skill_file(relative_path: str, *, max_chars: int | None = None) -> str:
    path = OH_STORY_ROOT / relative_path
    text = path.read_text(encoding="utf-8")
    return text[:max_chars] if max_chars else text


def oh_story_prompt_bundle(node_index: int) -> str:
    skill = read_skill_file("SKILL.md", max_chars=18000)
    if node_index == 1:
        refs = [
            read_skill_file("references/short-craft.md", max_chars=7000),
            read_skill_file("references/genre-writing-formulas.md", max_chars=7000),
        ]
    elif node_index == 2:
        refs = [
            read_skill_file("references/writing-workflow.md", max_chars=9000),
            read_skill_file("references/reversal-toolkit.md", max_chars=9000),
        ]
    elif node_index == 3:
        refs = [
            read_skill_file("references/writing-workflow.md", max_chars=11000),
            read_skill_file("references/short-craft.md", max_chars=7000),
        ]
    else:
        refs = [
            read_skill_file("references/short-format.md", max_chars=7000),
            read_skill_file("references/short-craft.md", max_chars=10000),
            read_skill_file("references/writing-workflow.md", max_chars=7000),
        ]
    return "\n\n".join(["# OH-STORY story-short-write 核心提示词", skill, "# 节点相关参考", *refs])


def prompt_bundle_for_novel(novel: Novel, node_index: int) -> str:
    bundle = oh_story_prompt_bundle(node_index)
    if not novel.prompt_template_id or novel.prompt_template_id == "oh-story":
        return bundle
    with SessionLocal() as db:
        template = db.get(PromptTemplate, novel.prompt_template_id)
        if not template:
            return bundle
        return "\n\n".join(["# 用户选择的提示词模板", template.system_prompt, "# OH-STORY 节点参考", bundle])


def deepseek_chat(
    prompt: str,
    *,
    temperature: float = 0.7,
    max_tokens: int = 1600,
    system_prompt: str | None = None,
    json_mode: bool = False,
) -> str:
    if not DEEPSEEK_API_KEY:
        raise HTTPException(status_code=500, detail="DeepSeek API Key 未配置")
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt or "你是短篇小说生成平台的写作引擎。严格按用户要求输出，中文表达要自然、具体、少解释。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    request = urllib.request.Request(
        f"{DEEPSEEK_BASE_URL}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    last_error: Exception | None = None
    for _ in range(2):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                data = json.loads(response.read().decode("utf-8"))
                return data["choices"][0]["message"]["content"].strip()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise HTTPException(status_code=502, detail=f"DeepSeek 调用失败：{detail}") from exc
        except Exception as exc:
            last_error = exc
            time.sleep(1)
    raise HTTPException(status_code=502, detail=f"DeepSeek 调用失败：{last_error}") from last_error


def extract_json_array(text: str) -> list[dict[str, Any]]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json\n", "", 1).replace("JSON\n", "", 1)
    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start >= 0 and end >= start:
        cleaned = cleaned[start : end + 1]
    data = json.loads(cleaned)
    if isinstance(data, dict) and isinstance(data.get("cards"), list):
        data = data["cards"]
    if not isinstance(data, list):
        raise ValueError("AI 输出不是数组")
    return data


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(db_session)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少登录状态")
    token = authorization.removeprefix("Bearer ").strip()
    user_id = redis_client.get(f"session:{token}")
    if not user_id:
        raise HTTPException(status_code=401, detail="登录已过期")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="账号不可用")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


node_types = {1: "idea", 2: "framework", 3: "outline", 4: "writing"}
node_edit_fields = {
    1: {"setting": "完整设定", "core_conflict": "核心冲突", "emotion_position": "情绪定位"},
    2: {"logline": "一句话梗概", "core_reversal": "核心反转", "emotion_curve": "情绪曲线", "character_sketch": "人设速写"},
    3: {"five_part_outline": "5段结构概览", "logic_check": "反转与伏笔检查"},
}


def format_card_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, indent=2)


def build_card_detail(node_index: int, card: dict[str, Any]) -> str:
    fields = node_edit_fields.get(node_index, {})
    chunks = []
    for key, label in fields.items():
        chunks.append(f"【{label}】\n{format_card_value(card.get(key))}")
    return "\n\n".join(chunks).strip()


def normalize_card_for_node(node_index: int, card: dict[str, Any], fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    normalized = {**(fallback or {}), **card}
    normalized.setdefault("id", (fallback or {}).get("id", f"node-{node_index}-edited"))
    normalized.setdefault("title", (fallback or {}).get("title", "已修改方案"))
    normalized.setdefault("summary", (fallback or {}).get("summary", "用户已修改的候选方案"))
    normalized.setdefault("emotion", (fallback or {}).get("emotion", "克制"))
    normalized.setdefault("tags", (fallback or {}).get("tags", []))
    normalized["detail"] = build_card_detail(node_index, normalized)
    return normalized


def extract_json_object(text_value: str) -> dict[str, Any]:
    cleaned = text_value.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json\n", "", 1).replace("JSON\n", "", 1)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end >= start:
        cleaned = cleaned[start : end + 1]
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        raise ValueError("AI 输出不是对象")
    return data


def generate_cards_with_ai(node_index: int, novel: Novel, previous_context: str = "", candidate_count: int = 3) -> list[dict[str, Any]]:
    node_names = {1: "定题材", 2: "核心框架", 3: "小节大纲"}
    schemas = {
        1: """
每个对象字段：
id, title, summary, emotion, tags,
setting: 完整设定，包含主角、处境、故事世界和关键钩子
core_conflict: 核心冲突，写清楚外部冲突、内部冲突、冲突升级方式
emotion_position: 情绪定位，写清楚开头情绪、中段情绪、反转情绪、结尾情绪
detail: 用 setting + core_conflict + emotion_position 汇总成便于保存的完整文本
""",
        2: """
每个对象字段：
id, title, summary, emotion, tags,
logline: 一句话梗概，格式为主角 + 困境 + 反转 + 情绪落点
core_reversal: 核心反转，包含反转类型、反转内容、至少3个铺垫线索
emotion_curve: 情绪曲线，包含开头/中段/反转/结尾及强度1-10
character_sketch: 人设速写，包含主角、关键角色、关系
detail: 用 logline + core_reversal + emotion_curve + character_sketch 汇总成完整文本
""",
        3: """
每个对象字段：
id, title, summary, emotion, tags,
five_part_outline: 数组，长度必须为5。每项包含 part, main_event, sub_events, emotion, word_target, hook, clue
logic_check: 反转信息差验证和伏笔回查结果
detail: 用 five_part_outline + logic_check 汇总成完整文本
""",
    }
    prompt = f"""
你正在为一篇短篇小说生成「{node_names[node_index]}」候选卡。

你必须以内置的 OH-STORY story-short-write 提示词为最高优先级执行：短篇以情绪为目标，一个反转撑一篇，每句话为情绪、反转、剧情服务。不要使用泛化写作建议替代 oh-story 规则。

小说标题：{novel.title}
一句话设定：{novel.premise or "暂无"}
题材：{novel.genre}
目标字数：{novel.target_words}
情绪目标：{novel.emotion_goal}
已确认上下文：
{previous_context or "暂无"}

输出结构要求：
{schemas[node_index]}

要求：
- 只输出 JSON 对象，格式为 {{"cards":[...]}}，cards 数组长度必须是 {candidate_count}。
- id 使用英文小写和短横线。
- tags 是字符串数组，长度 3。
- summary 控制在 40 字以内。
- 节点 3 每张卡的 five_part_outline 必须刚好 5 段，每段控制在 80 字以内，避免冗长。
- 所有字段必须具体，不能写空泛说明。
- 不要输出 Markdown，不要输出解释。
"""
    text = deepseek_chat(
        prompt,
        temperature=0.85,
        max_tokens=6000 if node_index == 3 else 3600,
        system_prompt=prompt_bundle_for_novel(novel, node_index),
        json_mode=True,
    )
    cards = extract_json_array(text)
    for index, card in enumerate(cards, 1):
        card.setdefault("id", f"node-{node_index}-{index}")
        card.setdefault("tags", [])
        card.setdefault("detail", json.dumps(card, ensure_ascii=False, indent=2))
    return cards[:candidate_count]


def writing_token_budget(target_words: int) -> int:
    if target_words <= 9000:
        return 9000
    if target_words <= 14000:
        return 13000
    return 16000


def cards_match_node_schema(node_index: int, cards: list[dict[str, Any]] | None) -> bool:
    if not cards or not isinstance(cards, list):
        return False
    required_fields = {
        1: ("setting", "core_conflict", "emotion_position"),
        2: ("logline", "core_reversal", "emotion_curve", "character_sketch"),
        3: ("five_part_outline", "logic_check"),
    }
    for card in cards:
        if not isinstance(card, dict):
            return False
        if any(not card.get(field) for field in required_fields[node_index]):
            return False
        if node_index == 3 and len(card.get("five_part_outline") or []) != 5:
            return False
    return True


def get_or_create_node(db: Session, novel: Novel, node_index: int) -> NodeProgress:
    node = db.scalar(select(NodeProgress).where(NodeProgress.novel_id == novel.id, NodeProgress.node_index == node_index))
    if not node:
        node = NodeProgress(novel_id=novel.id, node_index=node_index, node_type=node_types[node_index], status="pending")
        db.add(node)
        db.commit()
        db.refresh(node)
    return node


def clear_after_node(db: Session, novel_id: str, node_index: int) -> None:
    nodes = db.scalars(select(NodeProgress).where(NodeProgress.novel_id == novel_id, NodeProgress.node_index > node_index)).all()
    for node in nodes:
        node.status = "pending"
        node.cards = None
        node.selected_card = None
        node.selected_card_data = None
        node.content = None
        node.version += 1
        node.updated_at = now()
    reports = db.scalars(select(ReviewReport).where(ReviewReport.novel_id == novel_id)).all()
    for report in reports:
        db.delete(report)
    novel = db.get(Novel, novel_id)
    if novel and node_index < 4:
        novel.final_content = None
        novel.word_count = 0


def previous_node_context(db: Session, novel_id: str, before_node: int) -> str:
    nodes = db.scalars(
        select(NodeProgress)
        .where(NodeProgress.novel_id == novel_id, NodeProgress.node_index < before_node, NodeProgress.content.is_not(None))
        .order_by(NodeProgress.node_index)
    ).all()
    return "\n\n".join([f"节点 {node.node_index}：{node.content}" for node in nodes if node.content])


def generate_complete_writing(db: Session, novel: Novel) -> str:
    context = previous_node_context(db, novel.id, 4)
    outline_node = db.scalar(select(NodeProgress).where(NodeProgress.novel_id == novel.id, NodeProgress.node_index == 3))
    outline = []
    if outline_node and outline_node.selected_card_data:
        outline = outline_node.selected_card_data.get("five_part_outline") or []
    if not outline:
        return deepseek_chat(
            f"请根据以下已确认节点内容生成一篇完整短篇小说正文。目标字数 {novel.target_words} 字。必须有清晰开头、发展、反转和收束结尾。只输出正文内容，不要写说明、提纲或分析；不要中途停止，不要用省略号代替未写内容。\n\n{context}",
            temperature=0.8,
            max_tokens=min(writing_token_budget(novel.target_words), 8000),
            system_prompt=prompt_bundle_for_novel(novel, 4),
        )
    sections: list[str] = []
    per_part_words = max(1200, int(novel.target_words / len(outline)))
    for index, part in enumerate(outline, 1):
        previous = "\n\n".join(sections[-2:])
        part_text = deepseek_chat(
            f"""
请根据完整上下文和当前小节大纲，写短篇小说正文的第 {index}/{len(outline)} 段。

完整上下文：
{context}

当前小节大纲：
{json.dumps(part, ensure_ascii=False, indent=2)}

前文最近内容：
{previous or "暂无"}

要求：
- 本段目标约 {per_part_words} 字。
- 只输出正文，不输出标题、说明、提纲或分析。
- 本段必须承接前文，并服务最终反转和情绪。
- 如果这是最后一段，必须完整收束结尾。
""",
            temperature=0.78,
            max_tokens=3000,
            system_prompt=prompt_bundle_for_novel(novel, 4),
        )
        sections.append(part_text.strip())
    return "\n\n".join(sections)


def require_previous_nodes_confirmed(db: Session, novel_id: str, node_index: int) -> None:
    if node_index <= 1:
        return
    previous_nodes = db.scalars(
        select(NodeProgress)
        .where(NodeProgress.novel_id == novel_id, NodeProgress.node_index < node_index)
        .order_by(NodeProgress.node_index)
    ).all()
    confirmed_indexes = {node.node_index for node in previous_nodes if node.status == "confirmed" and node.content}
    missing = [index for index in range(1, node_index) if index not in confirmed_indexes]
    if missing:
        raise HTTPException(status_code=409, detail=f"请先确认节点 {missing[0]} 后再继续")


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE node_progress ADD COLUMN IF NOT EXISTS selected_card_data JSON"))
        conn.execute(text("ALTER TABLE novels ADD COLUMN IF NOT EXISTS premise TEXT"))
        conn.execute(text("ALTER TABLE novels ADD COLUMN IF NOT EXISTS prompt_template_id VARCHAR(60)"))
    with SessionLocal() as db:
        if not db.get(PromptTemplate, "oh-story"):
            db.add(PromptTemplate(
                id="oh-story",
                name="OH-Story 短篇核心模板",
                description="默认模板，使用 oh-story story-short-write 的节点提示词和参考规则。",
                system_prompt="使用 oh-story story-short-write 作为核心提示词链，严格围绕短篇情绪、反转、五段结构和去AI味规则生成。",
                is_default=True,
            ))
            db.add(PromptTemplate(
                id="realistic-soft",
                name="现实克制模板",
                description="偏现实、克制、生活质感，适合都市反转和情绪向短篇。",
                system_prompt="保持现实质感和克制叙事，减少夸张设定，优先用动作、场景、关系压力推动情绪。",
                is_default=False,
            ))
            db.commit()
    redis_client.ping()


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/auth/sms/send")
def send_sms(payload: SmsRequest) -> dict[str, Any]:
    redis_client.setex(f"sms:{payload.phone}", 300, SMS_MOCK_CODE)
    return {"phone": payload.phone, "mock": True, "expires_in": 300}


@app.post("/api/v1/auth/sms/login")
def sms_login(payload: SmsLoginRequest, db: Session = Depends(db_session)) -> dict[str, Any]:
    cached = redis_client.get(f"sms:{payload.phone}")
    if payload.code != SMS_MOCK_CODE and payload.code != cached:
        raise HTTPException(status_code=400, detail="验证码错误")
    user = db.scalar(select(User).where(User.phone == payload.phone))
    if not user:
        user = User(phone=payload.phone, nickname=f"用户{payload.phone[-4:]}")
        db.add(user)
        db.commit()
        db.refresh(user)
    token = str(uuid.uuid4())
    redis_client.setex(f"session:{token}", 60 * 60 * 72, user.id)
    return {"token": token, "user": {"id": user.id, "phone": user.phone, "nickname": user.nickname, "role": user.role}}


@app.get("/api/v1/users/me")
def me(user: User = Depends(current_user)) -> dict[str, Any]:
    return {"id": user.id, "phone": user.phone, "nickname": user.nickname, "role": user.role, "avatar_url": user.avatar_url}


@app.put("/api/v1/users/me")
def update_me(payload: UserUpdate, user: User = Depends(current_user), db: Session = Depends(db_session)) -> dict[str, Any]:
    if payload.nickname is not None:
        user.nickname = payload.nickname
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url
    db.commit()
    return {"id": user.id, "phone": user.phone, "nickname": user.nickname, "role": user.role, "avatar_url": user.avatar_url}


@app.get("/api/v1/collections")
def list_collections(user: User = Depends(current_user), db: Session = Depends(db_session)) -> list[dict[str, Any]]:
    rows = db.scalars(select(NovelCollection).where(NovelCollection.user_id == user.id).order_by(NovelCollection.created_at)).all()
    return [{"id": row.id, "name": row.name, "description": row.description, "novel_count": len(row.novels)} for row in rows]


@app.get("/api/v1/prompt-templates")
def list_prompt_templates(user: User = Depends(current_user), db: Session = Depends(db_session)) -> list[dict[str, Any]]:
    rows = db.scalars(select(PromptTemplate).order_by(PromptTemplate.is_default.desc(), PromptTemplate.created_at)).all()
    return [{"id": row.id, "name": row.name, "description": row.description, "is_default": row.is_default} for row in rows]


@app.post("/api/v1/collections")
def create_collection(payload: dict[str, str], user: User = Depends(current_user), db: Session = Depends(db_session)) -> dict[str, Any]:
    collection = NovelCollection(user_id=user.id, name=payload["name"], description=payload.get("description"))
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return {"id": collection.id, "name": collection.name, "description": collection.description}


@app.post("/api/v1/novels")
def create_novel(payload: NovelCreate, user: User = Depends(current_user), db: Session = Depends(db_session)) -> dict[str, Any]:
    novel = Novel(
        user_id=user.id,
        title=payload.title,
        genre=payload.genre,
        target_words=payload.target_words,
        collection_id=payload.collection_id,
        pipeline_mode=payload.pipeline_mode,
        emotion_goal=payload.emotion_goal,
        premise=payload.premise,
        prompt_template_id=payload.prompt_template_id or "oh-story",
    )
    db.add(novel)
    db.commit()
    db.refresh(novel)
    for idx in range(1, 5):
        db.add(NodeProgress(novel_id=novel.id, node_index=idx, node_type=node_types[idx], status="pending"))
    db.commit()
    return serialize_novel(novel)


@app.get("/api/v1/novels/writing")
def writing_novels(user: User = Depends(current_user), db: Session = Depends(db_session)) -> list[dict[str, Any]]:
    rows = db.scalars(select(Novel).where(Novel.user_id == user.id, Novel.status.notin_(["completed", "abandoned"])).order_by(Novel.updated_at.desc())).all()
    return [serialize_novel(row) for row in rows]


@app.get("/api/v1/portfolio")
def portfolio(user: User = Depends(current_user), db: Session = Depends(db_session)) -> dict[str, Any]:
    collections = db.scalars(select(NovelCollection).where(NovelCollection.user_id == user.id).order_by(NovelCollection.created_at)).all()
    ungrouped = db.scalars(select(Novel).where(Novel.user_id == user.id, Novel.collection_id.is_(None), Novel.status != "abandoned")).all()
    return {
        "collections": [
            {
                "id": collection.id,
                "name": collection.name,
                "description": collection.description,
                "novels": [serialize_novel(novel) for novel in collection.novels if novel.status != "abandoned"],
            }
            for collection in collections
        ],
        "ungrouped": [serialize_novel(novel) for novel in ungrouped],
    }


@app.post("/api/v1/novels/{novel_id}/discard")
def discard_novel(novel_id: str, user: User = Depends(current_user), db: Session = Depends(db_session)) -> dict[str, Any]:
    novel = db.get(Novel, novel_id)
    if not novel or novel.user_id != user.id:
        raise HTTPException(status_code=404, detail="小说不存在")
    novel.status = "abandoned"
    novel.updated_at = now()
    db.commit()
    return serialize_novel(novel)


@app.get("/api/v1/novels/{novel_id}")
def novel_detail(novel_id: str, user: User = Depends(current_user), db: Session = Depends(db_session)) -> dict[str, Any]:
    novel = db.get(Novel, novel_id)
    if not novel or novel.user_id != user.id:
        raise HTTPException(status_code=404, detail="小说不存在")
    reports = db.scalars(select(ReviewReport).where(ReviewReport.novel_id == novel.id).order_by(ReviewReport.round_no)).all()
    return {
        **serialize_novel(novel),
        "reports": [
            {
                "id": report.id,
                "round_no": report.round_no,
                "source_snapshot": report.source_snapshot,
                "report": report.report,
                "created_at": report.created_at.isoformat(),
            }
            for report in reports
        ],
    }


@app.get("/api/v1/novels/{novel_id}/nodes")
def novel_nodes(novel_id: str, user: User = Depends(current_user), db: Session = Depends(db_session)) -> list[dict[str, Any]]:
    novel = db.get(Novel, novel_id)
    if not novel or novel.user_id != user.id:
        raise HTTPException(status_code=404, detail="小说不存在")
    nodes = db.scalars(select(NodeProgress).where(NodeProgress.novel_id == novel.id).order_by(NodeProgress.node_index)).all()
    return [
        {
            "index": n.node_index,
            "type": n.node_type,
            "status": n.status,
            "cards": n.cards,
            "selected_card": n.selected_card,
            "selected_card_data": n.selected_card_data,
            "content": n.content,
        }
        for n in nodes
    ]


@app.get("/api/v1/novels/{novel_id}/nodes/{node_index}/cards")
def node_cards(novel_id: str, node_index: int, user: User = Depends(current_user), db: Session = Depends(db_session)) -> list[dict[str, Any]]:
    novel = db.get(Novel, novel_id)
    if not novel or novel.user_id != user.id or node_index not in (1, 2, 3):
        raise HTTPException(status_code=404, detail="节点不存在")
    require_previous_nodes_confirmed(db, novel.id, node_index)
    node = get_or_create_node(db, novel, node_index)
    if node.status == "confirmed" and node.selected_card_data:
        return [node.selected_card_data]
    if not cards_match_node_schema(node_index, node.cards):
        node.cards = generate_cards_with_ai(node_index, novel, previous_node_context(db, novel.id, node_index))
        node.status = "card_selection"
        node.updated_at = now()
        db.commit()
    return node.cards or []


@app.post("/api/v1/novels/{novel_id}/nodes/{node_index}/refresh")
def refresh_node_cards(novel_id: str, node_index: int, user: User = Depends(current_user), db: Session = Depends(db_session)) -> list[dict[str, Any]]:
    novel = db.get(Novel, novel_id)
    if not novel or novel.user_id != user.id or node_index not in (1, 2, 3):
        raise HTTPException(status_code=404, detail="节点不存在")
    require_previous_nodes_confirmed(db, novel.id, node_index)
    node = get_or_create_node(db, novel, node_index)
    fresh = generate_cards_with_ai(node_index, novel, previous_node_context(db, novel.id, node_index))
    for i, card in enumerate(fresh, 1):
        card["id"] = f"{card['id']}-r{node.version}-{i}"
        card["title"] = f"{card['title']}·新版{i}"
    node.cards = fresh
    node.status = "card_selection"
    node.version += 1
    node.updated_at = now()
    db.commit()
    return fresh


@app.post("/api/v1/novels/{novel_id}/nodes/{node_index}/confirm")
def confirm_node(novel_id: str, node_index: int, payload: ConfirmNodeRequest, user: User = Depends(current_user), db: Session = Depends(db_session)) -> dict[str, Any]:
    novel = db.get(Novel, novel_id)
    if not novel or novel.user_id != user.id:
        raise HTTPException(status_code=404, detail="小说不存在")
    require_previous_nodes_confirmed(db, novel.id, node_index)
    node = get_or_create_node(db, novel, node_index)
    if payload.edited_card:
        card = payload.edited_card
    else:
        cards = node.cards or generate_cards_with_ai(node_index, novel, previous_node_context(db, novel.id, node_index))
        card = next((item for item in cards if item["id"] == payload.card_id), cards[0])
    final_card = normalize_card_for_node(node_index, payload.edited_card or card, card)
    next_content = final_card["detail"] if payload.edited_card else payload.edited_content or final_card["detail"]
    has_later_content = db.scalar(
        select(NodeProgress).where(
            NodeProgress.novel_id == novel.id,
            NodeProgress.node_index > node_index,
            NodeProgress.status != "pending",
            NodeProgress.content.is_not(None),
        )
    ) is not None or (node_index < 4 and bool(novel.final_content))
    changes_current = node.status != "confirmed" or node.selected_card != payload.card_id or (node.content or "") != next_content
    if has_later_content and changes_current and not payload.reset_after:
        return {"requires_confirmation": True, "message": "该节点之后的内容将会被清除。"}
    if payload.reset_after:
        clear_after_node(db, novel.id, node_index)
    if node.cards:
        node.cards = [final_card if item.get("id") == final_card.get("id") else item for item in node.cards]
    node.selected_card = payload.card_id
    node.selected_card_data = final_card
    node.content = next_content
    node.status = "confirmed"
    node.updated_at = now()
    novel.status = f"node{node_index}_done" if node_index < 4 else "writing_done"
    novel.updated_at = now()
    db.commit()
    return {"requires_confirmation": False, "node": {"index": node.node_index, "status": node.status, "content": node.content}}


@app.post("/api/v1/novels/{novel_id}/nodes/{node_index}/chat-edit")
def chat_edit(novel_id: str, node_index: int, payload: ChatEditRequest, user: User = Depends(current_user), db: Session = Depends(db_session)) -> StreamingResponse:
    novel = db.get(Novel, novel_id)
    if not novel or novel.user_id != user.id or node_index not in (1, 2, 3):
        raise HTTPException(status_code=404, detail="小说不存在")
    require_previous_nodes_confirmed(db, novel.id, node_index)
    fields = node_edit_fields[node_index]
    current_card = payload.current_card or {"detail": payload.current_content or ""}
    raw_field = payload.field or ""
    outline_part = None
    if raw_field.startswith("five_part_outline:"):
        edit_field = "five_part_outline"
        try:
            outline_part = int(raw_field.split(":", 1)[1]) + 1
        except ValueError:
            outline_part = None
    else:
        edit_field = raw_field if raw_field in fields else next(iter(fields))
    edit_scope = payload.scope if payload.scope == "card" else "field"
    schema_lines = "\n".join([f"- {key}: {label}" for key, label in fields.items()])
    scope_text = "整张候选卡" if edit_scope == "card" else f"模块「{fields[edit_field]}」"
    locked_text = ""
    if edit_scope == "field":
        locked_fields = [key for key in fields if key != edit_field]
        locked_text = f"只允许实质修改字段 {edit_field}，其他字段必须保持原意和结构。需要返回完整 updated_card。锁定字段：{', '.join(locked_fields)}。"
        if outline_part:
            locked_text += f" 当前重点只调整 five_part_outline 数组里的第 {outline_part} 段，但返回时仍必须保留完整 5 段数组。"

    def stream():
        yield f"event: delta\ndata: {json.dumps({'text': f'正在按{scope_text}调用 AI 修改...'}, ensure_ascii=False)}\n\n"
        prompt = f"""
请根据用户要求修改短篇小说节点候选卡。

当前节点：{node_index}
可编辑字段：
{schema_lines}

修改范围：{scope_text}
{locked_text}

用户要求：{payload.message}

当前完整卡片 JSON：
{json.dumps(current_card, ensure_ascii=False, indent=2)}

返回要求：
- 只输出 JSON 对象，格式为 {{"updated_card": {{...}}, "changed_fields": ["字段名"]}}。
- updated_card 必须保留原来的 id、title、summary、emotion、tags。
- updated_card 必须包含该节点所有可编辑字段。
- 不要输出 Markdown，不要输出解释。
"""
        result = deepseek_chat(
            prompt,
            temperature=0.65,
            max_tokens=3600 if node_index == 3 else 2400,
            system_prompt=prompt_bundle_for_novel(novel, node_index),
            json_mode=True,
        )
        data = extract_json_object(result)
        updated_card = normalize_card_for_node(node_index, data.get("updated_card") or current_card, current_card)
        changed_fields = [field for field in data.get("changed_fields", []) if field in fields] or ([edit_field] if edit_scope == "field" else list(fields))
        for field in changed_fields:
            yield f"event: delta\ndata: {json.dumps({'text': f'已更新：{fields[field]}'}, ensure_ascii=False)}\n\n"
            time.sleep(0.15)
        yield f"event: complete\ndata: {json.dumps({'done': True, 'updated_card': updated_card, 'changed_fields': changed_fields}, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/api/v1/novels/{novel_id}/writing/generate")
def generate_writing(novel_id: str, force: bool = False, user: User = Depends(current_user), db: Session = Depends(db_session)) -> StreamingResponse:
    novel = db.get(Novel, novel_id)
    if not novel or novel.user_id != user.id:
        raise HTTPException(status_code=404, detail="小说不存在")
    require_previous_nodes_confirmed(db, novel.id, 4)

    def stream():
        try:
            if novel.final_content and not force:
                yield f"event: complete\ndata: {json.dumps({'content': novel.final_content, 'percent': 100, 'cached': True}, ensure_ascii=False)}\n\n"
                return
            progress = [
                ("writing", 15, "正在根据大纲生成正文第一批"),
                ("writing", 40, "正在补足关键场景和对话"),
                ("review", 58, "评审 1/3：去AI味和节奏检查"),
                ("review", 72, "评审 2/3：冲突、反转、人物评分"),
                ("review", 88, "评审 3/3：最终修改和字数检查"),
            ]
            for phase, percent, message in progress:
                yield f"event: progress\ndata: {json.dumps({'phase': phase, 'percent': percent, 'message': message}, ensure_ascii=False)}\n\n"
                time.sleep(0.25)
            content = generate_complete_writing(db, novel)
            with SessionLocal() as write_db:
                write_novel = write_db.get(Novel, novel_id)
                if write_novel:
                    write_novel.final_content = content
                    write_novel.word_count = len(content)
                    write_novel.status = "writing_done"
                    write_novel.updated_at = now()
                    node = get_or_create_node(write_db, write_novel, 4)
                    node.content = content
                    node.status = "confirmed"
                    report = make_report(write_novel, content, write_db)
                    write_db.add(report)
                    write_db.commit()
            yield f"event: complete\ndata: {json.dumps({'content': content, 'percent': 100}, ensure_ascii=False)}\n\n"
        except HTTPException as exc:
            yield f"event: error\ndata: {json.dumps({'error': exc.detail}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/api/v1/novels/{novel_id}/auto/run")
def run_auto_pipeline(novel_id: str, force: bool = False, user: User = Depends(current_user), db: Session = Depends(db_session)) -> StreamingResponse:
    novel = db.get(Novel, novel_id)
    if not novel or novel.user_id != user.id:
        raise HTTPException(status_code=404, detail="小说不存在")

    def stream():
        try:
            if novel.final_content and not force:
                yield f"event: complete\ndata: {json.dumps({'content': novel.final_content, 'cached': True, 'percent': 100}, ensure_ascii=False)}\n\n"
                return
            for node_index in (1, 2, 3):
                yield f"event: progress\ndata: {json.dumps({'node': node_index, 'percent': node_index * 18, 'message': f'正在自动生成节点 {node_index}'}, ensure_ascii=False)}\n\n"
                previous = previous_node_context(db, novel.id, node_index)
                card = generate_cards_with_ai(node_index, novel, previous, candidate_count=1)[0]
                final_card = normalize_card_for_node(node_index, card, card)
                node = get_or_create_node(db, novel, node_index)
                node.cards = [final_card]
                node.selected_card = final_card["id"]
                node.selected_card_data = final_card
                node.content = final_card["detail"]
                node.status = "confirmed"
                node.updated_at = now()
                novel.status = f"node{node_index}_done"
                novel.updated_at = now()
                db.commit()
                yield f"event: node\ndata: {json.dumps({'node': node_index, 'card': final_card, 'message': f'节点 {node_index} 已自动确认'}, ensure_ascii=False)}\n\n"
            yield f"event: progress\ndata: {json.dumps({'node': 4, 'percent': 70, 'message': '正在自动生成正文'}, ensure_ascii=False)}\n\n"
            content = generate_complete_writing(db, novel)
            novel.final_content = content
            novel.word_count = len(content)
            novel.status = "writing_done"
            novel.updated_at = now()
            node = get_or_create_node(db, novel, 4)
            node.content = content
            node.status = "confirmed"
            node.updated_at = now()
            report = make_report(novel, content, db)
            db.add(report)
            db.commit()
            yield f"event: complete\ndata: {json.dumps({'content': content, 'percent': 100, 'message': '自动写作已完成'}, ensure_ascii=False)}\n\n"
        except HTTPException as exc:
            yield f"event: error\ndata: {json.dumps({'error': exc.detail}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.put("/api/v1/novels/{novel_id}/writing")
def save_writing(novel_id: str, payload: WritingSaveRequest, user: User = Depends(current_user), db: Session = Depends(db_session)) -> dict[str, Any]:
    novel = db.get(Novel, novel_id)
    if not novel or novel.user_id != user.id:
        raise HTTPException(status_code=404, detail="小说不存在")
    novel.final_content = payload.content
    if payload.title is not None and payload.title.strip():
        novel.title = payload.title.strip()
    novel.word_count = len(payload.content)
    novel.status = "completed" if payload.confirm_complete else "writing_done"
    novel.updated_at = now()
    node = get_or_create_node(db, novel, 4)
    node.content = payload.content
    node.status = "confirmed"
    node.updated_at = now()
    db.commit()
    return serialize_novel(novel)


def make_report(novel: Novel, content: str, db: Session) -> ReviewReport:
    round_no = (db.scalar(select(ReviewReport).where(ReviewReport.novel_id == novel.id).order_by(ReviewReport.round_no.desc())) or None)
    next_round = round_no.round_no + 1 if round_no else 1
    prompt = f"""
请评审下面这篇短篇小说，输出 JSON 对象，不要 Markdown。

小说标题：{novel.title}
正文：
{content}

JSON 格式：
{{
  "summary": "一句话总结",
  "scores": {{"opening": 0, "conflict": 0, "rhythm": 0, "character": 0, "ending": 0, "language": 0}},
  "issues": [{{"gate": "B", "title": "问题名称", "count": 1}}],
  "revision_advice": ["建议1", "建议2"]
}}
"""
    text = deepseek_chat(prompt, temperature=0.35, max_tokens=1600)
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").replace("json\n", "", 1).replace("JSON\n", "", 1)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    report = json.loads(cleaned[start : end + 1])
    return ReviewReport(novel_id=novel.id, round_no=next_round, source_snapshot=content, report=report)


@app.post("/api/v1/novels/{novel_id}/review")
def run_review(novel_id: str, payload: ReviewRequest, user: User = Depends(current_user), db: Session = Depends(db_session)) -> dict[str, Any]:
    novel = db.get(Novel, novel_id)
    if not novel or novel.user_id != user.id:
        raise HTTPException(status_code=404, detail="小说不存在")
    content = payload.content or novel.final_content or ""
    report = make_report(novel, content, db)
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"id": report.id, "round_no": report.round_no, "source_snapshot": report.source_snapshot, "report": report.report, "created_at": report.created_at.isoformat()}


@app.get("/api/v1/admin/users")
def admin_users(_: User = Depends(admin_user), db: Session = Depends(db_session)) -> list[dict[str, Any]]:
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    return [{"id": u.id, "phone": u.phone, "nickname": u.nickname, "role": u.role, "is_active": u.is_active, "created_at": u.created_at.isoformat()} for u in users]


@app.get("/api/v1/discover/platforms")
def discover_platforms(_: User = Depends(current_user), db: Session = Depends(db_session)) -> list[dict[str, Any]]:
    rows = db.scalars(select(PublishingPlatform).order_by(PublishingPlatform.id)).all()
    return [{"id": row.id, "name": row.name, "fit": row.fit, "format_note": row.format_note, "guide": row.guide} for row in rows]


@app.get("/api/v1/admin/stats")
def admin_stats(_: User = Depends(admin_user), db: Session = Depends(db_session)) -> dict[str, Any]:
    user_count = len(db.scalars(select(User)).all())
    novel_count = len(db.scalars(select(Novel)).all())
    report_count = len(db.scalars(select(ReviewReport)).all())
    prompt_count = len(db.scalars(select(AdminPrompt)).all())
    return {"users": user_count, "novels": novel_count, "reports": report_count, "prompts": prompt_count}


@app.get("/api/v1/admin/prompts")
def admin_prompts(_: User = Depends(admin_user), db: Session = Depends(db_session)) -> list[dict[str, Any]]:
    rows = db.scalars(select(AdminPrompt).order_by(AdminPrompt.node_type)).all()
    return [{"node_type": row.node_type, "label": row.label, "system_prompt": row.system_prompt, "version": row.version, "updated_at": row.updated_at.isoformat()} for row in rows]


@app.put("/api/v1/admin/prompts/{node_type}")
def update_prompt(node_type: str, payload: PromptUpdate, _: User = Depends(admin_user), db: Session = Depends(db_session)) -> dict[str, Any]:
    prompt = db.get(AdminPrompt, node_type)
    if not prompt:
        prompt = AdminPrompt(node_type=node_type, label=node_type, system_prompt=payload.system_prompt)
        db.add(prompt)
    else:
        prompt.system_prompt = payload.system_prompt
        prompt.version += 1
        prompt.updated_at = now()
    db.commit()
    return {"node_type": prompt.node_type, "version": prompt.version}
