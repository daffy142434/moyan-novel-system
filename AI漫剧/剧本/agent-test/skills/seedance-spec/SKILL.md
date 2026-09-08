---
name: seedance-spec
description: Seedance 2.0平台官方规范与最佳实践。包含提示词结构公式、@引用系统、素材上限、运镜写法、长度规范、常见问题对策等。执行场记编写前必读，视觉指导讲戏时也应参考平台能力边界。当涉及Seedance 2.0提示词编写规范、平台限制、最佳实践时触发。
---

# Seedance 2.0 平台规范

## 平台概述

Seedance 2.0是字节跳动的多模态AI视频生成模型，支持文生视频、图生视频、音频驱动等多种输入模式。原生2K分辨率（2048x1080），支持多镜头叙事，具备音视频同步生成能力。可通过即梦AI（Dreamina）、剪映（CapCut）等平台使用。

## 一、提示词结构公式

### 核心公式（SCELA六层结构）

提示词 = [主体Subject] + [镜头Camera] + [效果Effect] + [光影Light] + [音频Audio] + [风格Style]

说明：Seedance 2.0原生支持音视频同步生成，提示词应包含音频层描述（环境音、音效、对白、配乐节奏），这是区别于普通视频提示词的关键维度。

### 图生视频公式

提示词 = 主体+动作, 背景+动作, 镜头+运动

### 推荐结构

- [Subject]：谁或什么（建议单一主体）
- [Camera]：景别 + 运镜方式 + 镜头感
- [Effect]：动作、特效、转场效果（用具体动词，标明速度）
- [Light]：光源方向、色温、光影变化
- [Audio]：环境音、音效、对白、配乐节奏提示
- [Style]：视觉美学、渲染风格

## 二、@引用系统（多模态输入）

### 引用标记

- @Image1 到 @Image9：图片引用（最多9张）
- @Video1 到 @Video3：视频引用（最多3个，总长不超15秒）
- @Audio1 到 @Audio3：音频引用（MP3格式，不超15秒）
- 单次生成总文件数上限：12个

### 引用用途

- @Image：角色面部参考、风格/美学参考、场景参考
- @Video：运镜/动作参考、动作提取
- @Audio：音乐节奏同步、音效参考

### 引用语法示例

```
Reference @Image1 for character style.
Apply camera movement from @Video1.
Match the pacing to @Audio1.
```

### 帧到帧过渡

```
Reference @Image1 as first frame
Reference @Image2 as last frame
Transition: Organic morph maintaining subject identity
```

## 三、提示词最佳实践

### 长度规范

| 状态 | 词数 | 效果 |
|------|------|------|
| 过短 | 少于20词 | 缺乏细节，模型自由发挥过多 |
| 最佳 | 30-100词 | 足够的细节和控制力 |
| 过长 | 超过150词 | 模型容易混乱，指令冲突 |

### 重要：短提示词模式（强烈推荐）

实战发现（2026年2月）：Seedance V2 目前用中文短提示词效果显著优于长提示词。关键规则：

- 总字符数控制在 2000 字符以内（含中英文混合）
- 优先用中文描述动作和情绪，Camera/Style 行保留英文
- 砍掉一切空洞修饰词，只留有画面感的实词
- 品质锚定开头比泛词更有效，例如用"UnrealEngine5渲染，工业光魔级VFX"代替"电影感、高质量"
- 宁可删掉一个形容词，也不要超过字符预算

### 该做的

- 使用具体的动作词："sprinting quickly"而非"moving dynamically"
- 每个场景聚焦单一主体
- 提供明确的镜头指令
- 复合运镜分步写成节拍："Start: dolly-in. Then: pan right."
- 动作要标明速度："walked slowly"而非"walked"

### 不该做的

- 模糊的描述："moving dynamically"
- 同一场景多个冲突主体
- 抽象的情绪词当镜头指令
- 所有运镜塞进一句话

## 四、运镜技术规范

### 核心原则：单镜头单运动（防漂移）

每个镜头只使用一种主要运镜方式。如果需要复合运镜，必须按时间节拍分步描述，让模型依次执行而非同时执行。违反此原则是运镜漂移的首要原因。

### 推镜头（Dolly-in）
```
Slow dolly-in on character's face, start medium shot, end close-up over 4 seconds.
Camera: Slow dolly-in, 50mm natural perspective
```

### 复合运镜（必须分步）
```
Start: Slow dolly-in establishing the scene
Then: Gentle pan right for the final 2 seconds
```
注意：Seedance按节拍顺序执行复合运镜，比一句话混写效果好得多。

### 跟踪镜头
```
Camera follows runner through urban environment.
Camera: Side tracking shot, gimbal-smooth movement
Speed: Match subject's running pace
```

### 升降镜头
```
Start low near ground level, crane up revealing cityscape.
Camera: Crane up from ground to aerial view
Duration: 6 seconds
```

### 手持风格
```
Authentic documentary feel following subject.
Camera: Handheld, organic movement, slight shake
Style: Verite documentary
```

## 五、对白与唇形同步

Seedance 2.0支持8种以上语言的音素级唇形同步。

### 对白格式

```
[Dialogue: "台词内容"]
```

### 多语言对白

```
Character 1: [Dialogue English: "Let me present our results."]
Character 2: [Dialogue Mandarin: "数据看起来很不错。"]
```

## 五点五、音频设计规范

Seedance 2.0原生支持音视频同步生成，提示词中加入音频描述可大幅提升沉浸感。

### 音频描述结构

在每个镜头提示词末尾加入 Audio 行：

```
Audio: [环境音] + [动作音效] + [情绪氛围音乐]
```

### 音频描述示例

```
Audio: 清晨鸟鸣、远处公鸡叫声、木门吱呀声，背景配乐舒缓空灵
Audio: 脚步踩在碎石上的沙沙声、风声渐强、紧张悬疑弦乐
Audio: 剑鸣声、衣袂破风声、鼓点渐密
```

### 音频引用

通过 @Audio1-3 引用外部音频文件实现精确节奏同步：

```
Match visual cuts to the beat of @Audio1.
Sync character movements to @Audio1 rhythm.
```

## 六、常见问题与对策

| 问题 | 解决方案 |
|------|----------|
| 角色面容漂移 | 减少场景种类，一次生成只用一个环境 |
| 画面混乱 | 把"fast-paced"换成"smooth pacing" |
| 动作不清晰 | 指定精确速度，如"walked at 0.5x speed" |
| 唇形不同步 | 使用[Dialogue: "exact text"]格式 |
| 镜头太抖 | 指定"gimbal-smooth"或"stabilized" |
| 风格不一致 | 每次生成使用相同的Style标签 |

## 七、负面提示（应避免的画面问题）

生成时应避免以下问题：模糊、面部扭曲、服装不一致、动作不自然、画面闪烁、多种冲突的艺术风格。

可在提示词末尾加入：
```
Avoid: Blurry, distorted faces, inconsistent clothing, unnatural movements, flickering elements
```

## 八、适用场景与风格参考

Seedance 2.0在以下场景表现优秀：
- 电影级写实镜头（人物特写、光影氛围）
- 角色一致性保持（跨镜头面部/服装一致）
- 产品展示与广告
- 短剧/微电影多镜头叙事
- 风格迁移（赛博朋克、动漫、复古胶片等）
- 武打/动作序列
- 音乐视频节奏同步

## 九、技术参数备忘

- 原生分辨率：2K（2048x1080）
- 最大时长：15秒/次
- 最多镜头数：6镜头/次
- 图片输入上限：9张
- 视频输入上限：3个（总长15秒以内）
- 音频输入上限：3个（MP3，15秒以内）
- 总文件上限：12个/次
- 生成成功率：约99.5%
