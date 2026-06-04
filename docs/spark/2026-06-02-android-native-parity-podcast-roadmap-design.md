# Android 原生能力对齐与跨平台播客路线图

日期：2026-06-02

状态：已批准设计

## 1. 目标

Aonsoku 需要在 Android 平台上完整实现与当前 iOS 平台行为一致的原生能力，并在 Android 原生能力稳定后扩展跨平台完整播客体验。

本路线图只定义总体架构、子项目顺序、session 切片和验收门槛。每个 session 开始实现前，仍需单独编写实施计划。

路线图包含两个按顺序实施、分别验收的子项目：

1. Android 原生能力完整对齐。
2. 跨平台完整播客体验。

## 2. 当前基线

仓库已经具备以下基础：

- Web、Electron 和 Capacitor iOS 共用 React、Zustand 和 TypeScript 播放层。
- `src/player/playback/` 已定义 `PlaybackBackend`，包含 Web 和原生后端。
- `src/player/queue-controller/` 已定义 Web 和原生队列控制器。
- `@aonsoku/capacitor-native` 已提供四个 TypeScript 插件合同：
  - `AonsokuNativeBridge`
  - `AonsokuNativePreferences`
  - `AonsokuNativeData`
  - `AonsokuNativeAudio`
- iOS 原生插件已覆盖凭据桥接、原生 HTTP、数据库同步、图片缓存、音频缓存、原生播放、原生队列、恢复、scrobble、睡眠定时器和摇一摇调试页。
- Android Capacitor 容器已加入仓库，但仍是基础 WebView 容器：
  - `@aonsoku/capacitor-native` 的 package manifest 只声明 iOS。
  - Android 尚未注册四个原生插件。
  - Android 尚未实现播放服务、原生数据库、缓存和调试页。
  - TypeScript 层仍散落多处 `capacitor-ios` 专用分支。
- Android 工程当前声明：
  - `minSdkVersion = 24`
  - `compileSdkVersion = 36`
  - `targetSdkVersion = 36`

## 3. 已批准约束

### 3.1 平台一致性的定义

Android 与 iOS 必须保持用户行为和状态流一致，但不要求原生内部实现、系统 UI 或框架选择相同。

例如：

- iOS 使用 AVFoundation 和系统媒体命令。
- Android 使用 Media3 `ExoPlayer`、`MediaSession` 和 `MediaSessionService`。
- Android 音量控制遵循 Android 系统音量范式。
- 调试页遵循各平台原生 UI 范式。

### 3.2 Android 支持范围

- 最低支持 Android 7.0，API 24。
- 保持现有 `targetSdkVersion = 36`。
- 应覆盖 API 24、26、33 和 36 的差异验证。
- 从最近任务中划掉应用后，如果仍在播放，播放服务必须继续运行。
- Android 原生能力启用后从干净状态开始，不迁移现有 Android WebView 测试安装数据。

### 3.3 Session 交付约束

- 每个 session 必须形成可独立构建、测试和真机验收的纵向切片。
- 未完成能力必须显式返回 unavailable 或受控降级，不能静默伪装成功。
- 每个 session 完成后必须创建独立 commit，提交信息遵循仓库格式：

```text
<type>(<scope>): <subject>
```

- 一个 session 内可以存在必要的修复提交，但 session 结束时工作区不能混入下一阶段代码。
- Android 完整对齐完成前，不引入播客模型变更。

## 4. 总体实施策略

采用能力合同驱动的纵向切片路线。

现有 TypeScript 插件接口和前端状态流是跨平台合同。Android 在同一个 `@aonsoku/capacitor-native` 包中增加 Kotlin 实现，并按 session 逐步启用能力。Kotlin 内部使用 Android 原生组件，不机械翻译 Swift 文件。

每个 session 同时完成：

1. Android 原生实现。
2. TypeScript 平台启用或显式 unavailable。
3. 自动化测试。
4. 真机验收清单。
5. 独立 commit。

## 5. Android 原生架构

### 5.1 插件边界

Android 延续现有四个插件名和 TypeScript 合同：

| 插件域 | Android 实现 | 职责 |
| --- | --- | --- |
| `AonsokuNativeBridge` | `BridgePlugin` | Android Keystore 保护的凭据、登录、探活、原生 Subsonic HTTP |
| `AonsokuNativePreferences` | `PreferencesPlugin` | DataStore 持久化设置、播放历史和兼容队列快照 |
| `AonsokuNativeData` | `DataPlugin` | Room 数据库、分层同步、查询、歌词和封面缓存 |
| `AonsokuNativeAudio` | `AudioPlugin` | 将 JS 命令转交给独立播放服务，并向 JS 转发事件 |

插件实现应保持现有 TypeScript 方法和事件合同稳定。平台内部不支持或尚未完成的方法必须返回结构化 unavailable 错误。

Android 对 iOS 特有系统能力的合同映射：

| 共享合同 | Android 行为 |
| --- | --- |
| `setSystemVolume` / `getSystemVolume` | 映射 Android 媒体音量，并通过能力矩阵明确是否允许应用主动修改 |
| `systemVolumeChanged` | 监听媒体音量变化并同步事件 |
| `setVolumeHUDEnabled` | Android 没有等价的 iOS 音量 HUD 开关；保留方法并返回明确的平台不支持结果，不伪装已生效 |
| `setLikeActive` | 映射为系统媒体会话中的喜欢状态和可用动作 |

### 5.2 播放服务

播放核心放入独立 `PlaybackService`：

- 使用 Media3 `ExoPlayer` 和 `MediaSessionService`。
- 服务持有权威播放状态、上下文队列、用户队列、shuffle、repeat、进度和恢复状态。
- App WebView 是命令客户端和状态订阅者，不是后台播放生命周期的所有者。
- 通知栏、锁屏和耳机按键直接进入 `MediaSession`，再向前端同步事件。
- 从最近任务中划掉应用后，正在播放的服务继续运行。
- 服务重建时从持久状态恢复队列、曲目、进度、repeat 和 shuffle。
- 服务重建不自动开始播放，除非服务本身仍在连续播放。

### 5.3 播放源解析

缓存命中、在线歌曲流、本地音频文件和电台统一由 Android `NativeSourceResolver` 解析：

```text
Playback request
  -> NativeSourceResolver
  -> valid local cache hit
     or online stream
     or radio stream
  -> ExoPlayer MediaItem
```

规则：

- 缓存文件与索引一致时优先使用本地文件。
- 索引存在但文件缺失或损坏时删除陈旧索引，并允许在线回退。
- 在线回退必须留下可诊断日志。
- 电台不写入歌曲缓存，不参与歌曲 scrobble。

### 5.4 数据与缓存

Android 使用：

- Android Keystore：保护凭据加密密钥。
- DataStore：保存小型偏好、历史和兼容快照。
- Room：保存可查询的元数据、同步状态、歌词和缓存索引。
- App 私有文件目录：保存封面和音频文件。

数据流：

```text
Login credentials
  -> Android Keystore protected storage
  -> native HTTP client
  -> tiered metadata sync
  -> Room
  -> file cache index
  -> NativeSourceResolver
```

Room schema 应覆盖当前 iOS 原生数据层已有的实体和离线查询能力，并使用显式 schema version 与 migration。

### 5.5 TypeScript 平台接线

共享 Web 层不继续扩散 `getRuntime() === "capacitor-ios"` 判断。

后续实施应引入面向能力的判断，例如：

- 原生播放是否可用。
- 原生队列是否可用。
- 原生偏好是否可用。
- 原生数据同步是否可用。
- 原生音频缓存是否可用。
- 原生图片缓存是否可用。

Android 能力按 session 显式启用。尚未启用时必须返回可诊断 unavailable 状态，不得静默落回行为不一致的 Web 路径。

### 5.6 Android 调试页

Android 提供 Kotlin 原生调试页，仅通过摇一摇打开。

调试页至少展示：

- 当前播放元数据、状态、进度和缓冲。
- 上下文队列、用户队列、当前索引、repeat 和 shuffle。
- 播放服务生命周期与连接状态。
- 当前播放源类型和缓存命中情况。
- 网络连接与认证概要，不显示敏感凭据。
- 音频焦点、输出路由和恢复状态。
- 原生日志过滤、搜索、选择和复制。
- 缓存统计。

## 6. Android Session 路线图

### A0：Android 插件骨架与能力矩阵

交付内容：

- 为 `@aonsoku/capacitor-native` 增加 Android Gradle 模块与 package manifest 声明。
- 注册四个 Android 插件域。
- 建立 Kotlin 包结构、基础错误模型和插件可用性检查。
- 将 TypeScript 平台判断收口为能力判断的第一版。
- 增加 Android CI，至少构建 Debug APK。
- 未实现的方法返回明确 unavailable。

真机验收：

- Debug APK 可安装和启动。
- Web、Electron 和 iOS 路径保持原有行为。
- Android 未完成能力的错误可在日志中定位。

### A1：Bridge 与 Preferences

交付内容：

- Android Keystore 保护的凭据存储。
- 原生登录、探活、服务端信息查询、主备地址处理和 API 请求代理。
- DataStore 偏好、播放历史和兼容队列快照。
- 登录、重启恢复和退出清理接线。

真机验收：

- 登录成功后重启仍可恢复会话。
- 主地址失败时按现有合同切换备用地址。
- 退出后凭据与会话清理完成。
- 日志不输出密码、token 或可复用认证材料。

### A2：Media3 播放最小闭环

交付内容：

- `PlaybackService`、`ExoPlayer` 和 `MediaSessionService`。
- 前台播放通知和系统媒体控制。
- 在线歌曲、调用方提供的本地文件 URI 和电台播放。
- 播放、暂停、停止、seek、上一首和下一首。
- 播放状态、进度、duration、buffering、ended 和 error 事件。
- Android API 33+ 通知行为验证。

真机验收：

- 前台、后台、熄屏和从最近任务划掉应用后继续播放。
- 通知栏、锁屏和耳机按键可控制播放。
- Android API 33+ 验证通知授权与拒绝路径，并记录媒体会话通知的系统行为。
- 电台和歌曲切换不串状态。

### A3：原生队列与恢复

交付内容：

- 上下文队列、用户队列、repeat、shuffle、队列编辑和重排。
- 原生命令和 JS 命令共享同一权威队列。
- 队列、曲目、进度、repeat 和 shuffle 持久化。
- 进程重建后的恢复。
- 对齐当前 iOS `getFullState` 和队列事件语义。

真机验收：

- 通知栏切歌后 WebView 状态正确同步。
- 进程重建后队列和进度正确恢复。
- shuffle 开关、取消 shuffle、用户队列消费和队列编辑行为正确。
- 恢复后不会未经用户动作自动播放。

### A4：音频缓存

交付内容：

- 音频下载、取消、完成、失败和进度事件。
- 缓存文件写入、解析、大小查询、删除、清空和索引维护。
- `NativeSourceResolver` 本地优先策略。
- 缓存损坏和陈旧索引清理。
- 缓存统计。

真机验收：

- 已下载歌曲在飞行模式下可播放。
- 下载中断、取消和重试行为正确。
- 重启后缓存仍可解析。
- 文件缺失时索引清理，并在联网时回退在线流。

### A5：播放稳定性、scrobble 与睡眠定时器

交付内容：

- 缓冲事件、网络恢复、错误映射和分层恢复策略。
- 音频焦点、其他音频打断、耳机拔出和输出路由变化。
- scrobble buffer、提交和清理。
- 睡眠定时器：按时长和当前曲目结束两种模式。
- 结构化日志和恢复事件。

真机验收：

- 断网、恢复、弱网和损坏缓存场景可诊断且行为合理。
- 音频焦点变化和耳机拔出按 Android 范式处理。
- scrobble 不重复、不丢失已缓冲记录。
- 睡眠定时器在后台和熄屏场景可靠触发。

### A6：Room 元数据层与图片缓存

交付内容：

- Room schema、migration、DAO 和 repository。
- 分层全量同步、增量同步、取消和同步状态事件。
- 艺术家、专辑、歌曲、歌单、类型、收藏、搜索和歌词查询。
- 图片下载、写入、解析、删除、清空和统计。
- 离线浏览。

真机验收：

- 全量与增量同步正确。
- 离线状态可浏览已同步数据。
- 封面缓存命中、删除和离线加载正确。
- migration 测试覆盖 schema 升级。

### A7：Android 原生调试页

交付内容：

- 摇一摇监听和原生调试页。
- 播放、队列、缓冲、网络、缓存、服务生命周期和日志视图。
- 日志级别与来源过滤、搜索、选择和复制。

真机验收：

- 应用界面在前台时可通过摇一摇打开调试页。
- 无论播放服务当前在前台还是后台运行，调试页都能读取服务快照。
- 日志可复制并支持定位播放与缓存故障。
- 页面不泄露敏感认证材料。

### A8：全面接线与 Android 发布回归

交付内容：

- 移除 Android 临时 unavailable 开关。
- 完成权限、manifest、release 构建、文档和回归矩阵。
- 检查所有 TypeScript `capacitor-ios` 专用分支，保留真正的平台差异，收口共享原生能力分支。
- 增加 Release APK 或等价发布产物 CI。

真机验收：

- API 24、26、33 和 36 回归通过。
- 在线歌曲、本地缓存、电台、后台播放、恢复、同步、离线浏览和调试链路通过。
- Web、Electron 和 iOS 原有歌曲与电台行为不回退。

## 7. Android 错误处理原则

- 每个原生方法返回结构化错误码。
- JS 层将原生错误映射到现有播放错误分类。
- 插件、权限或服务未就绪时明确报错，不伪装成功。
- 网络错误、解码错误、缓存损坏和认证失效分别记录来源与恢复动作。
- 缓存索引与文件不一致时清理陈旧索引，并允许在线回退。
- 电台使用独立恢复策略。
- 日志必须可诊断，但不能记录敏感凭据。

播放命令流：

```text
React/Zustand
  -> TypeScript NativeAudio facade
  -> Capacitor AudioPlugin
  -> PlaybackService
  -> Media3 ExoPlayer + MediaSession
  -> Kotlin event emitter
  -> Capacitor listener
  -> NativeQueueController / PlaybackBackend
  -> Zustand
```

## 8. 跨平台播客子项目

播客在 Android 原生能力完整对齐后单独实施。

当前产品播放模型只有 `song` 和 `radio`。播客需要扩展共享媒体模型，并明确区分节目与单集。单集不能伪装成歌曲。

完整播客体验包含：

- 服务端能力探测。
- 订阅列表。
- 节目详情。
- 单集列表与详情。
- 单集播放。
- 单集队列。
- 后台控制。
- 断点续播。
- 已播放状态。
- 下载缓存。
- 离线播放。
- 空间统计。
- iOS 与 Android 原生能力对齐。

### P0：服务端能力探测与共享合同

交付内容：

- 确认目标 Navidrome/Subsonic 服务端实际暴露的播客能力。
- 定义播客 API、共享类型、查询合同和能力探测。
- 增加播客路由和入口可见性规则。
- 明确无播客权限或服务端不支持时的降级行为。

验收：

- 无能力时隐藏入口并保持现有歌曲、电台路径正常。
- API 合同有自动化测试。

### P1：播客浏览体验

交付内容：

- 订阅列表。
- 节目详情。
- 单集列表与基础单集信息。
- 移动端和桌面端基础 UI。
- 刷新、空状态和错误状态。

验收：

- Web、Electron、iOS 和 Android 可浏览支持的播客数据。
- 无订阅、网络失败和权限不足状态正确。

### P2：播客播放与单集队列

交付内容：

- 新增播客播放源和单集队列。
- 扩展共享播放器状态，不复用歌曲专属语义。
- iOS 与 Android 原生后台控制。
- 单集播放状态、进度和错误事件。

验收：

- 歌曲、电台和播客相互切换时不串状态。
- 前台、后台、熄屏和系统媒体控制行为正确。

### P3：断点续播与已播放状态

交付内容：

- 本地断点持久化。
- 服务端可用时同步进度和已播放状态。
- 明确完成阈值。
- 网络失败时保留本地恢复数据并延迟同步。

验收：

- 中途退出后可从正确位置续播。
- 完播后状态正确。
- 离线产生的进度可在恢复网络后同步。

### P4：播客下载缓存

交付内容：

- 单集下载、取消、进度、完成和失败。
- 独立缓存命名空间和清理策略。
- 缓存命中、删除、离线播放和空间统计。
- 缓存损坏检测与在线回退。

验收：

- 飞行模式下可播放已下载单集。
- 下载中断、重试、删除和缓存损坏回退正确。

### P5：双平台补齐与完整回归

交付内容：

- 补齐 iOS 与 Android 原生播客能力。
- 扩展双平台调试页。
- 完成完整跨平台回归。

验收：

- iOS 与 Android 的后台播放、系统媒体控制、断点续播和缓存行为一致。
- Web、Electron、iOS 和 Android 原有歌曲与电台行为不回退。

## 9. 测试与验收

### 9.1 每个 Session 的完成定义

每个 session 必须满足：

1. 只实现该 session 的范围，不提前混入下一阶段能力。
2. TypeScript 检查、Biome lint、相关 Vitest 和对应原生构建通过。
3. 为新增 Kotlin 逻辑添加 JVM 单元测试。
4. 涉及服务、Room 或插件注册时补 Android instrumentation 测试。
5. 提供该 session 的 Android 真机检查清单。
6. 至少覆盖 API 24 和 API 33+ 的相关差异。
7. 涉及跨平台共享合同时，运行 Web 和 iOS 相关回归并记录 iOS 真机检查项。
8. 未完成能力保持显式 unavailable 或受控降级，日志可定位原因。
9. 更新 session 验收记录。
10. 使用仓库规定格式创建独立 commit。
11. commit 完成后才开始下一个 session。

### 9.2 阶段性回归矩阵

| 维度 | 覆盖项 |
| --- | --- |
| Android 版本 | API 24、26、33、36 |
| 生命周期 | 前台、后台、熄屏、划掉任务、系统回收后重建 |
| 播放源 | 在线歌曲、本地缓存、电台；播客阶段增加在线与离线单集 |
| 控制入口 | WebView、通知栏、锁屏、耳机按键 |
| 网络 | 正常、断网、恢复、主备地址切换、缓存损坏 |
| 持久化 | 登录恢复、队列恢复、进度恢复、退出清理 |
| 跨平台 | Web、Electron、iOS 原有歌曲和电台行为不回退 |

## 10. 实施交接规则

- 本文档是总路线图，不替代 session 实施计划。
- 实施从 A0 开始，严格按 A0 到 A8 的顺序推进。
- Android 子项目验收完成后，再按 P0 到 P5 的顺序推进播客。
- 每个 session 开始前应明确改动文件、测试命令、真机清单和预期 commit。
- 如果 session 中发现会扩大范围的问题，先更新对应实施计划，不静默引入额外功能。

## 11. 官方参考资料

- [Background playback with a MediaSessionService](https://developer.android.com/media/media3/session/background-playback)
- [Control and advertise playback using a MediaSession](https://developer.android.com/media/media3/session/control-playback)
- [Android Keystore system](https://developer.android.com/privacy-and-security/keystore)
- [DataStore](https://developer.android.com/topic/libraries/architecture/datastore)
- [Save data in a local database using Room](https://developer.android.com/training/data-storage/room)
- [Notification runtime permission](https://developer.android.com/develop/ui/views/notifications/notification-permission)
