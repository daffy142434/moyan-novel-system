from __future__ import annotations

from app.main import AdminPrompt, Base, NodeProgress, Novel, NovelCollection, PublishingPlatform, SessionLocal, User, engine, make_report


def seed() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = db.query(User).filter(User.phone == "13800000000").first()
        if not admin:
            admin = User(phone="13800000000", nickname="系统管理员", role="admin")
            db.add(admin)

        prompt_defs = [
            ("idea", "节点 1 - 定题材", "生成三个差异化故事方向。"),
            ("framework", "节点 2 - 核心框架", "生成一句话梗概、核心反转、情绪曲线和人设速写。"),
            ("outline", "节点 3 - 小节大纲", "生成五段结构、字数分配、线索回收。"),
            ("writing", "节点 4 - 正文写作", "按大纲生成正文，并执行三轮评审。"),
            ("deslop", "评审 - 去AI味", "执行 7 Gate 检查。"),
        ]
        for node_type, label, text in prompt_defs:
            if not db.get(AdminPrompt, node_type):
                db.add(AdminPrompt(node_type=node_type, label=label, system_prompt=text))

        platforms = [
            ("zhihu", "知乎盐言故事", "8000-20000字，强反转", "标题钩子 + 分段密集 + 结尾翻面", "适合悬疑、情感反转、现实向短篇。"),
            ("daily", "每天读点故事", "1万字左右，女性向", "人物关系清晰，情绪递进稳定", "适合情感、成长、关系反转。"),
            ("flash", "Flash Fiction Online", "500-1000词英文", "单场景、高密度、留白结尾", "适合英文闪小说。"),
        ]
        for platform_id, name, fit, format_note, guide in platforms:
            if not db.get(PublishingPlatform, platform_id):
                db.add(PublishingPlatform(id=platform_id, name=name, fit=fit, format_note=format_note, guide=guide))

        for i in range(1, 11):
            phone = f"139000000{i:02d}"
            user = db.query(User).filter(User.phone == phone).first()
            if not user:
                user = User(phone=phone, nickname=f"测试用户{i:02d}")
                db.add(user)
                db.flush()
            collection = db.query(NovelCollection).filter(NovelCollection.user_id == user.id, NovelCollection.name == "反转短篇").first()
            if not collection:
                collection = NovelCollection(user_id=user.id, name="反转短篇", description="用于测试的短篇合集")
                db.add(collection)
                db.flush()
            existing = db.query(Novel).filter(Novel.user_id == user.id).count()
            for j in range(existing + 1, 4):
                completed = j != 3
                novel = Novel(
                    user_id=user.id,
                    collection_id=collection.id if j != 2 else None,
                    title=f"测试短篇{i:02d}-{j}",
                    genre="现实反转" if j == 1 else "悬疑",
                    target_words=10000,
                    word_count=168 if completed else 0,
                    status="completed" if completed else "node2_done",
                    final_content="雨落在旧城的铁皮棚上。\n\n主角终于明白，那张借条从来不是债，而是一封迟到的证词。" if completed else None,
                )
                db.add(novel)
                db.flush()
                for idx, node_type in [(1, "idea"), (2, "framework"), (3, "outline"), (4, "writing")]:
                    db.add(NodeProgress(novel_id=novel.id, node_index=idx, node_type=node_type, status="confirmed" if completed or idx < 3 else "pending"))
                if completed:
                    db.add(make_report(novel, novel.final_content or "", db))
        db.commit()


if __name__ == "__main__":
    seed()
    print("seed complete")
