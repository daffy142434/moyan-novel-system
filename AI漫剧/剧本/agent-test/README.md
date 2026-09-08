# AI视频分镜师团队

## 团队角色

- 总编剧（主Agent）：全局调度与流程控制
- 视觉指导（Sub Agent）：剧本拆解、讲戏、质量审核
- 美术指导（Sub Agent）：人物/场景参考图提示词设计
- 执行场记（Sub Agent）：Seedance 2.0视频提示词编写

## 目录结构

```
.claude/claude.md             主配置文件
skills/visual-director/       视觉指导技能
skills/art-director/          美术指导技能
skills/exec-recorder/         执行场记技能
skills/seedance-spec/         Seedance 2.0平台规范
skills/compliance-review/     合规审核技能
script/                       剧本及配套文件（支持漫剧Skill产出和普通剧本）
assets/                       人物/场景提示词（跨集累积）
outputs/                      每集产出
```

## 安装步骤

1. 在项目根目录创建 .claude 文件夹，放入 claude.md
2. 将 skills/ 文件夹复制到项目根目录
3. 启动 Claude Code（script、assets、outputs 文件夹会自动创建）

## 使用流程

~help    查看说明
~start   视觉指导分析（剧本拆解+讲戏）
~design  美术指导设计（人物/场景参考图提示词）
~prompt  执行场记编写（Seedance 2.0视频提示词）
~status  查看进度
~review  查看审核详情
~redo    重做某阶段

## 产出使用

人物参考图：复制 assets/character-prompts.md 中的角色提示词，在Nanobanana 2中生成三视图（16:9，1K，推理等级高）。

场景参考图：复制 assets/scene-prompts.md 中的九宫格提示词，生成后裁切为单独场景。

视频生成：打开 outputs/epN/seedance-prompts.md，按素材对应表在Seedance 2.0中上传参考图，复制提示词，用@引用素材生成视频。

## 注意事项

- AI初始产出约80分，建议人工参与调整
- 视觉风格选择影响全部后续产出
- 视觉指导的讲戏质量决定流水线上限
- Seedance 2.0单次最多引用9张图片、总12个文件
- 每个镜头提示词控制在30-100词
- 复合运镜必须分步描述
