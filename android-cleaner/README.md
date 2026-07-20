# Android Cleaner

轻量、开源、注重隐私的安卓存储空间清理工具。

## 特性

- 🧹 **智能扫描** — 缓存、临时文件、空文件夹、残留目录、APK 安装包、日志文件
- 🔍 **大文件查找** — 按自定义阈值查找大文件
- 📁 **文件浏览器** — 内置文件管理器，支持批量操作
- ♻️ **回收站机制** — 误删可恢复，7 天自动清理
- 🚫 **零广告** — 纯粹的工具，无任何广告和推广
- 🔒 **完全离线** — 所有扫描在设备端完成，不上传任何数据
- 🌙 **暗黑模式** — 支持 Material You 动态主题

## 开始使用

### 下载

从 [Releases](https://github.com/user/android-cleaner/releases) 页面下载最新 APK。

### 构建

```bash
git clone https://github.com/user/android-cleaner.git
cd android-cleaner
./gradlew assembleRelease
```

## 技术栈

- Kotlin + Jetpack Compose
- Material Design 3
- Room Database
- Hilt DI
- Coroutines + Flow

## 许可证

[GPL v3](LICENSE)
