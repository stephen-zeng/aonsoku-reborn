# 离线缓存架构设计

> 为 Aonsoku(Navidrome/Subsonic 客户端,web + Electron)定义离线、缓存、下载行为的目标形态,并记录从当前实现到目标的演进路径。
>
> 参照:Apple Music 的离线体验 —— 离线不是特殊模式,而是隐形状态。

---

## 目录

**Part I — 目标架构**

1. [设计哲学](#1-设计哲学)
2. [数据模型(三层)](#2-数据模型三层)
3. [数据流与真相层](#3-数据流与真相层)
4. [同步架构](#4-同步架构)
5. [下载模型](#5-下载模型)
6. [智能下载](#6-智能下载)
7. [存储治理](#7-存储治理)
8. [网络敏感性](#8-网络敏感性)
9. [离线 UX](#9-离线-ux)
10. [边界行为](#10-边界行为)
11. [音频质量](#11-音频质量)
12. [歌词](#12-歌词)
13. [多设备](#13-多设备)
14. [组件架构](#14-组件架构)
15. [设置页结构](#15-设置页结构)

**Part II — 迁移路径**

16. [当前实现盘点](#16-当前实现盘点)
17. [差距分析](#17-差距分析)
18. [重构路线图](#18-重构路线图)

---

## Part I · 目标架构

## 1. 设计哲学

离线不是用户必须主动进入的"模式",而是应用在网络波动时**自动退化但仍可用**的状态。核心职责:

1. **元数据永远可浏览** — 完整资源库骨架始终可见,与网络无关
2. **最可能被用到的音频永远在本地** — 通过预测(智能下载)+ 用户明确决定(显式下载)
3. **用户明确下载的内容永不丢失** — 配额、淘汰、服务器变更都不能动它
4. **网络波动无感知** — UI 同构,只有徽章变化,无"切换到离线"的动作

---

## 2. 数据模型(三层)

```
┌─ L1 元数据层 ─────────────────────────────────────┐
│ 内容: 艺人/专辑/歌曲/歌单/收藏/历史/用户偏好        │
│ 存储: IndexedDB                                     │
│ 量级: MB ~ 百 MB (视资源库规模)                     │
│ 策略: 渐进式优先级同步 + 持久化 + 增量更新          │
│ 角色: 任何时候都可离线浏览的全库骨架                │
└─────────────────────────────────────────────────────┘
┌─ L2 资产层 ───────────────────────────────────────┐
│ 内容: 封面图(缩略/大图) / 歌词文本 / 艺人照片      │
│ 存储: Cache API(图片) + IndexedDB(歌词)         │
│ 量级: 几十 ~ 几百 MB,默认配额 500 MB                │
│ 策略: 懒加载 + LRU 淘汰,受配额约束                  │
└─────────────────────────────────────────────────────┘
┌─ L3 音频层 ───────────────────────────────────────┐
│ 内容: 音频文件                                      │
│ 存储: Cache API(Web 和 Electron 统一,不分叉)     │
│ 量级: GB 级                                         │
│ 分三类(独立管理):                                   │
│  ├─ 显式下载: 用户主动触发,永不自动清理,不受配额  │
│  ├─ 智能下载: 规则匹配即留,规则失效立即清,配额独立│
│  └─ LRU / 队列预缓存: 隐式缓存,超额淘汰最旧        │
└─────────────────────────────────────────────────────┘
```

**关键**:L3 的三类在索引层必须**可区分**(source 字段),否则分类配额和生命周期规则无法落实。

---

## 3. 数据流与真相层

### IDB-first 范式

```
Server → Service 层 → IndexedDB (真相) → React Query (视图) → UI
                           ▲
                           │
                     Sync Service (Worker)
```

- **IndexedDB 是唯一真相**:所有读取路径始终读 IDB
- **React Query 降为视图订阅层**:不再作为主缓存,`staleTime: Infinity`,由 SyncService 写 IDB 后主动 invalidate
- **网络请求只用于更新 IDB**:Service 层拉到的数据先写 IDB,再通知 Query

### 为什么必须反转

当前 "在线用网络 / 离线读 IDB" 的二分法意味着:
- "离线完整浏览"绑死在一个 `syncLibrary` 开关上(用户必须主动开)
- 在线时 IDB 实际未被使用
- 无法做渐进式同步(同步中的部分既不在网络也不在"离线态")

反转后:IDB 永远可读,同步服务**仅负责让 IDB 更新**,业务代码与网络完全解耦。

---

## 4. 同步架构

### 首次登录 — 渐进式优先级同步

```
T0 立即       用户可浏览,顶栏出现同步进度
T1 秒级       收藏 / 歌单 / 最近播放 (高优)
T2 分钟级     所有艺人 + 所有专辑骨架 (中优)
T3 数十分钟   所有歌曲详情 (低优,可后台长时间跑)
```

T1 完成后用户开始有"收藏可见"的离线能力;T3 完成后拥有完整离线浏览。

### 增量同步 — 三个触发点

1. 应用启动
2. 窗口重获焦点(从后台切回)
3. 手动"刷新资源库"按钮

用 Subsonic `ifModifiedSince` 和本地 `lastSyncedAt` 时间戳做增量,避免全量重拉。

### 执行环境

- **Web Worker** 跑同步逻辑,不阻塞主线程
- AbortController 支持用户中断(切换服务器、登出)
- 失败可恢复:T1/T2/T3 各自记录 checkpoint,重启后从中断点续

---

## 5. 下载模型

| 类型 | 触发 | 生命周期 | 配额 | 标记 |
|---|---|---|---|---|
| **显式下载** | 用户点下载按钮(单曲/专辑/歌单) | 永不自动清理,只能用户手动删 | 不限 | `source: "explicit"` |
| **智能下载** | 匹配开启的规则(见 §6) | 规则不再匹配时**立即清理** | 独立配额(默认 3 GB) | `source: "smart"` |
| **LRU / 队列预缓存** | 播放触发 + 在线时预缓存队列下 3~5 首 | 超额淘汰最旧 | 独立配额(默认 1 GB) | `source: "lru"` |

### 下载粒度

单曲、专辑、歌单、艺人(全作品)均可显式下载。UI 以专辑/歌单为主入口,单曲下载作为菜单次要项。

---

## 6. 智能下载

### 规则(用户独立开关)

| 规则 | 触发 | 阈值 |
|---|---|---|
| 收藏的歌曲 | 点 ❤️ | 无 |
| 收藏歌单的内容 | 收藏歌单 → 该歌单所有歌 | 无 |
| 高频播放 | 累计播放次数 ≥ N | `N` 可调,默认 5 |
| 最近播放 | 最近 X 天内播放过 | `X` 可调,默认 14 |

**四条规则默认全部关闭**(智能下载总开关默认关)。用户在设置里启用后,独立管理每一条。

### 引擎机制

1. **订阅状态变化**:收藏、歌单、播放历史都是 Zustand store,订阅即可
2. **规则匹配 → 入队**:变化触发时 `SmartDownloadEngine` 重新计算应下载集合,入 DownloadQueue
3. **条件失效 → 立即清理**:取消收藏 / 歌单移除歌曲 / 超出时间窗口 → 从缓存移除该歌的 smart 标记
4. **多规则交叉命中时保留**:取消一条规则的匹配,如果另一条仍匹配,该歌保留(只有一个 smart 缓存条目,标记多个触发源)

### 清理策略

严格一致性:**缓存 = 规则当前匹配集**。不做延迟、不做 LRU 降级。这是目前与用户共识的策略(确定性优先)。

---

## 7. 存储治理

### 分类配额(均可用户调整)

| 层级 | 默认配额 | 说明 |
|---|---|---|
| L2 资产(封面/歌词) | 500 MB | 超额 LRU 淘汰 |
| L3 LRU 音频池 | 1 GB | 超额淘汰最旧 |
| L3 智能下载 | 3 GB | 超额时**不再新增**,已有保留 |
| L3 显式下载 | 不限 | 永不自动清理 |

智能下载配额满时的行为:**优先保持规则一致性**,若加入新匹配歌曲会超额,则暂不下载新的(等待用户手动扩额或腾出空间)。

### 存储设置页

- 饼图显示各层占用
- 分类明细 + 每类一键清理
- 每类配额独立调整
- "优化存储"按钮:清理 N 天未播放的非显式内容

---

## 8. 网络敏感性

通过 [Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API) 自动感知:

- `navigator.connection.saveData === true` 或 `effectiveType` 为 `2g/3g` 或 `type === 'cellular'` → 视为**受限网络**
- 受限时:**暂停**后台同步和智能下载
- **不受影响**:用户主动触发的显式下载(用户自己知道)、流式播放(靠用户判断)

UI:顶栏出现一个细微"受限网络"标识,无模态打扰。

**不提供手动"离线模式"开关** — 完全依赖自动感知。

---

## 9. 离线 UX

### 视觉分层(三档)

| 状态 | 视觉 | 交互 |
|---|---|---|
| 本地可用 | 正常 + ✓ 徽章 | 直接播放 |
| 条件可用 | 正常 + ☁️ 徽章 | 在线流式;离线点击温和提示 |
| 未同步 | 列表不出现 | 联网同步后自然补全 |

**不用灰化/半透明**做"残废"区分 — 徽章 + 极轻的不透明度变化足够辨识,避免视觉残废感。

### 徽章

- `☁️` 仅流式(未在本地)
- `↓` 下载中(带小进度环)
- `✓` 已下载(本地可用)

智能下载的 `✓` 样式与显式下载**略有不同**(颜色或描边),让用户能看出"这是系统自动的"。

### 首次同步 UI

- 顶栏一行细微进度 + 百分比(如 "同步中 45% · 正在拉取专辑")
- 点击展开面板:T1/T2/T3 三档分级明细、当前正在做什么
- 默认折叠,不打扰普通用户

### 无"离线模式"开关

一个重要原则:**不给用户一个全局的 online/offline 切换**。网络状态是客观事实,应用自动适应。有切换按钮意味着用户必须维护一个错误的心智模型("我现在该在哪个模式")。

---

## 10. 边界行为

### 服务器端删除

服务器上的歌被删除 / 移动时:

- 元数据从浏览视图消失(Artists/Albums/Songs 列表不再出现)
- **本地已缓存/下载的音频文件保留**
- "已下载"区域仍可见,带"已从服务器移除"小标签
- **不弹窗询问**,用户信任度优先

已下载的"孤儿歌曲"可以继续播放,直到用户主动删除或该歌重新出现在服务器(自动重新关联)。

### 智能下载条件变化

订阅收藏 / 歌单 / 播放历史的变更 → 实时重算规则匹配集:

- 取消收藏:对应歌的 smart 缓存立即清除(除非另一条规则也命中)
- 歌单被移除:歌单规则失效,不再匹配其中歌曲
- 超过"最近播放 X 天"窗口:移出缓存

### 规则重叠时的优先级

同一首歌可能同时被多条规则命中(例:收藏 + 高频)。缓存项记录所有触发源:

```ts
{ source: "smart", triggers: ["favorite", "frequent"] }
```

任意一条触发源仍成立 → 保留。全部失效 → 清理。

---

## 11. 音频质量

### 两档独立设置

| 设置 | 适用场景 | 默认 |
|---|---|---|
| `streamQuality` | 在线流式播放 | 中(省流量) |
| `downloadQuality` | 显式/智能下载 | 原始(最高) |

### 可选档位(对应 Subsonic 的 transcode)

- 原始(直链下载,无 transcode)
- 高(~320 kbps)
- 中(~192 kbps)
- 低(~128 kbps)

### 不做的事

- 不按网络自动切换质量(用户已有"流式 quality"可自选,且 §8 会在受限网络下暂停下载,重叠过多)
- 不做"按设备自适应"

---

## 12. 歌词

### 缓存时机

- **随音频下载一并拉取**(显式 / 智能):打包存入 IndexedDB 的 lyrics 表
- **其他情况**:打开播放页 / 歌词面板时按需拉取,结果入 IDB

### 不做前台预取

不会在用户滚动专辑列表时提前拉取可见歌曲的歌词(性价比低)。

---

## 13. 多设备

### 决定:各设备独立管理显式下载

- 显式下载的音频不跨设备同步
- 用户在 A 设备下载的歌,B 设备要看到仍需 B 设备自己下载
- 心智模型清晰:**下载是设备相关的**

### 天然跨设备的部分

Subsonic API 原生同步以下状态,意味着智能下载**自动跨设备**:

- 收藏(starred)
- 歌单
- 播放次数
- 用户评分

在设备 A 收藏一首歌 → 设备 B 同步后,若智能下载开启"收藏"规则,B 会自动下载该歌。这是零成本收益。

---

## 14. 组件架构

```
┌── UI Layer (React) ────────────────────────────────┐
│   OfflineBadge  StorageSettings  DownloadButton    │
│   SyncProgress  SmartDownloadRules                 │
└─────────────────────┬──────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────┐
│   React Query (视图订阅,非缓存)                    │
│   staleTime: Infinity,queryFn 读 IDB               │
└─────────────────────┬──────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────┐
│   IndexedDB (真相)                                 │
│   tables: artists, albums, songs, playlists,       │
│   favorites, downloads, cache_meta, sync_state,    │
│   lyrics, play_history                             │
└─────────────────────┬──────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────┐
│   Sync Service (Web Worker)                        │
│   T1/T2/T3 分级同步、增量、冲突处理                 │
└─────────────────────┬──────────────────────────────┘
┌─────────────────────▼──────────────────────────────┐
│   Download Service (Web Worker)                    │
│   显式队列、SmartDownloadEngine、生命周期           │
└─────────────────────┬──────────────────────────────┘
┌─────────────────────▼──────────────────────────────┐
│   Service Worker (Cache API 拦截)                  │
│   音频/封面 HTTP 响应拦截,作为最后 fallback         │
└─────────────────────┬──────────────────────────────┘
                      │
             Subsonic/Navidrome API
```

### 模块职责

| 模块 | 职责 |
|---|---|
| `libraryStore` (IDB schema) | 元数据真相,索引,查询 |
| `SyncService` (Worker) | 分级同步、增量、冲突解决、checkpoint |
| `DownloadService` (Worker) | 下载队列、Cache API 写入、进度上报 |
| `SmartDownloadEngine` | 订阅状态,计算规则匹配,调度下载/清理 |
| `StorageManager` | 配额、LRU、存储统计 |
| `NetworkMonitor` | 在线/离线/受限状态,事件广播 |
| `ServiceWorker` | HTTP 层兜底 |

---

## 15. 设置页结构

```
[资源库]
  同步状态(最后同步时间、T1/T2/T3 进度)
  手动刷新按钮

[下载与离线]
  已下载(按专辑/歌单分组,按设备过滤)
  智能下载
    ├ 总开关
    ├ 规则 1: 收藏的歌曲
    ├ 规则 2: 收藏的歌单内容
    ├ 规则 3: 高频播放  [阈值 N 次]
    └ 规则 4: 最近播放  [窗口 X 天]

[存储]
  饼图 + 分类明细
    L2 资产    [配额 500 MB]  [当前 ...]  [清理]
    L3 LRU     [配额 1 GB]    [当前 ...]  [清理]
    L3 智能    [配额 3 GB]    [当前 ...]  [清理]
    L3 显式    [当前 ...]     [管理]
  优化存储按钮

[音频质量]
  流式质量: [原始/高/中/低]
  下载质量: [原始/高/中/低]

[网络]
  自动网络感知: [开关]  (默认开)
```

---

## Part II · 迁移路径

## 16. 当前实现盘点

`feat/library-cache` 分支上,2bdb3d14 ("overhaul library caching architecture") 留下的基础设施:

### 已有的

| 目标组件 | 现有实现 | 位置 |
|---|---|---|
| L1 元数据层(IDB) | ✅ `offlineLibraryStore` + `metadata-sync.ts` | `src/store/idb.ts`,`src/service/cache/metadata-sync.ts` |
| L2/L3 资产+音频层(Cache API) | ✅ `cacheStorage` + 索引 | `src/service/cache/cache-storage.ts`,`cache-index.store.ts` |
| 显式下载 | ✅ song / album / artist / playlist 四个级别 | `cacheManager.cache*()` + 各菜单组件 |
| LRU 淘汰 | ✅ `lastAccessedAt` + cover 先于 audio | `src/service/cache/eviction.ts` |
| 存储统计 | ✅ audio/cover 分类统计 + 清理按钮 | `src/app/components/settings/pages/storage/index.tsx` |
| Service Worker | ✅ app shell + 静态资源 + API stale-while-revalidate (30min) | `public/sw.js` |
| 在线/离线检测 | ✅ `navigator.onLine` + `OfflineIndicator` | `use-network-status.ts` |
| 离线 query 回退 | ✅ `useOfflineQuery` 双路径 | `src/lib/offlineQueryClient.ts` |
| 同步状态机 | ✅ phase / progress / AbortController | `src/types/cache.ts`,`metadata-sync.ts` |
| 缓存徽章 | ✅ 小图标 | `cached-indicator.tsx` |
| 启动同步 | ✅ MetadataSyncObserver(需 syncLibrary 开) | `src/app/observers/metadata-sync-observer.tsx` |

### 估算可复用比例

- **~60% 可复用**:Cache API 层、索引、LRU、SW、基础同步流程、UI 基建
- **~25% 需要重写**:`offlineQueryClient` 范式、`metadata-sync` 分级化
- **~15% 纯新增**:SmartDownloadEngine、NetworkMonitor、视觉分层徽章、歌词缓存

---

## 17. 差距分析

### 🔴 根本性差距(需要范式级改动)

**G1. IDB 不是真相层**(`src/lib/offlineQueryClient.ts`)

```ts
// 当前:二分法
if (getNetworkStatus().isOfflineMode) return offlineFn();
return onlineFn();
```

问题:
- "离线完整浏览"绑死在 `syncLibrary` 开关上,与"兼顾两类用户"矛盾
- 在线时 IDB 未被使用
- React Query 仍是主缓存(`staleTime: 5min`)

目标:IDB 永远是 query 的读源,网络只负责更新 IDB。

**G2. 同步非渐进式、无增量、主线程跑**(`metadata-sync.ts`)

- 单线程线性:`genres → artists → albums → songs → playlists`
- 无 T1/T2/T3 优先级
- `syncAll` 是**全量替换**,不是增量
- `hasRun.current` 守护仅启动一次,无 focus / manual 触发
- 在主线程 Promise 链中跑

**G3. 下载三态未区分**(`cache-index.store.ts`)

```ts
interface CachedItemMeta {
  type: "audio" | "cover";
  // 缺失: source: "explicit" | "smart" | "lru"
}
```

后果:
- 显式下载的歌**可被 LRU 淘汰**,违反"永不自动清理"
- 无法分类清理、分类配额
- 智能下载无数据锚点

**G4. 智能下载引擎完全缺失**

无规则引擎、无订阅 watch、无清理逻辑。只有显式下载按钮。

### 🟡 重要差距

**G5. 单一配额**(`types/cache.ts::CacheSettings`)

`maxCacheSize` 是一个全局数字,无分类。清理按钮区分 audio/cover 但配额不分。

**G6. 网络感知只有 online/offline**

未使用 Network Information API,无 `metered` / `effectiveType` 检测。

**G7. 音频质量单档**

`DownloadQuality = "stream" | "original"` 一个字段,流式/下载无独立设置。

**G8. 离线 UX 单薄**

只有:
- 全局 `OfflineIndicator` 大徽章(红色)
- 歌曲级 `CachedIndicator`(一个下载小箭头)

缺:
- ☁️ 未下载徽章
- `↓` 下载中进度环
- 智能 vs 显式的视觉区分
- 未同步列表的缺席处理
- 首次同步顶栏进度 + 可展开面板(state 有,UI 没实现)

**G9. 歌词缓存机制缺失**

无 `cacheLyrics`,无"随音频一起拉"流程。

**G10. Electron 有独立下载路径**(`electron/main/core/downloads.ts`)

`electron-dl` → 用户 Downloads 目录,与 `cacheManager` 平行。目标是统一 Cache API,这条路径要么**只保留为"导出原始文件"**(与缓存语义无关),要么下线。

**G11. 服务器删除时保留本地副本:未明示**

`syncAll` 全量替换 IDB 元数据 — 服务器删除的歌会从 IDB 消失;但 Cache API 中的音频独立存在不会自动清。当前**行为恰巧接近目标**,但无"已下载但元数据丢失"的 UI 表达。

### 隐式架构冲突

1. **SW API stale-while-revalidate (30min) vs IDB 真相层**:两层都在缓存 API 响应,语义要厘清。目标:SW 只做"网络不可达的 fallback",IDB 是决策源。

2. **React Query `staleTime: 5min` + SW `30min`**:两层独立 TTL 会导致时序冲突。IDB-first 后 Query 应 `staleTime: Infinity`,由 SyncService 写 IDB 后主动 invalidate。

3. **`syncLibrary` 开关**:当前是"开启后才做任何 IDB 缓存"。目标中应**始终开启**(渐进式同步默认启用),这个开关应删除或重定义(比如改为"允许 T3 阶段的全量歌曲同步"之类的细粒度控制)。

4. **`useCacheStats` 聚合 audioSize + coverSize**:加分类配额后需要拆出 L2 / LRU / smart / explicit 四个独立统计。

---

## 18. 重构路线图

七阶段增量演进。每阶段可独立交付、独立回滚,避免大爆炸式重构。

### 阶段 1 — 范式迁移(IDB-first)

**目标**:把 IDB 做成永远的真相层,`syncLibrary` 开关语义转变。

- 重写 `offlineQueryClient.ts`:`queryFn` 始终读 IDB
- `queryClient.ts`:`staleTime: Infinity`,关闭 `refetchOnWindowFocus` 与 `refetchOnReconnect` 已关(保持)
- SyncService 写 IDB 后主动 `queryClient.invalidateQueries`
- `syncLibrary` 开关语义改为"允许长耗时 T3 同步"(默认开,给用户关掉长库同步的选项)

**风险**:读路径全改,需要回归测试所有列表页。

### 阶段 2 — 下载分类化

**目标**:区分显式 / 智能 / LRU,让 eviction 与配额能分类处置。

- `CachedItemMeta` 加 `source: "explicit" | "smart" | "lru"`
- 可选:加 `triggers: string[]`(记录 smart 的触发规则,为阶段 5 铺路)
- `eviction.ts` 改成按 source 分池:
  - `explicit` 不参与淘汰
  - `smart` 超过自己配额时不新增,已有保留
  - `lru` 按 `lastAccessedAt` 淘汰
- `CacheSettings` 拆:`assetsQuota`,`lruQuota`,`smartQuota`
- 存储 UI:分类饼图和配额调整

### 阶段 3 — 渐进式同步

**目标**:`syncAll` 分三档,支持增量,移到 Worker。

- 拆 `syncAll` 为 `syncT1` / `syncT2` / `syncT3`,各自 checkpoint
- T1 优先级顺序:收藏 → 歌单 → 最近播放
- 增量:每张表带 `lastSyncedAt`,Subsonic 请求用 `ifModifiedSince`
- 执行迁到 Web Worker(或 `requestIdleCallback` 作为降级)
- UI:顶栏进度 + 可展开面板(用现有 syncState 填充)

### 阶段 4 — 同步触发补全

**目标**:focus + manual 触发完整。

- `MetadataSyncObserver` 加 `window.addEventListener("focus", ...)`(节流,避免频繁切换触发)
- 设置页"资源库"区加"刷新资源库"按钮
- 每个触发点跑"增量同步"(短路径),非全量

### 阶段 5 — 智能下载引擎

**目标**:规则驱动的自动下载 + 条件失效清理。

- 新建 `src/service/cache/smart-download-engine.ts`
- 订阅:收藏 store、歌单 store、播放历史 store
- 每次状态变化 → 计算新的匹配集合 → 与 `cache_index.items.filter(source='smart')` 对比 → 增量下载 / 清理
- 设置 UI:总开关 + 四个规则开关 + 阈值(N 次 / X 天)
- 边界:配额满时的行为(暂停新增,不挤占显式)

### 阶段 6 — 网络感知 + 音频质量

**目标**:Network Information API 接入,音频质量两档。

- 新建 `src/app/observers/network-monitor.tsx`
- 使用 `navigator.connection` 检测 `saveData` / `effectiveType` / `type`
- 受限网络时 SyncService 与 SmartDownloadEngine 暂停
- 顶栏加小的受限提示图标
- `DownloadQuality` 拆成 `streamQuality` + `downloadQuality`
- 设置 UI:两个独立的 select

### 阶段 7 — 离线 UX 打磨

**目标**:视觉分层徽章 + 服务器删除保留 + 歌词。

- 扩展 `CachedIndicator`:根据本地可用 / 条件可用区分三档
- 新增 `DownloadingIndicator`:下载中进度环
- 智能下载的 ✓ 样式区别(描边 / 颜色)
- 首次同步顶栏进度条 + 展开面板 UI 实现
- "已下载"列表里展示"已从服务器移除"的孤儿歌曲
- 歌词缓存:`cacheLyrics` + 随显式/智能音频下载时一并拉

### 阶段交付建议

- 1 → 2 → 3:核心重构链,必须按序
- 4:独立小改动,可以穿插在任一阶段之后
- 5:依赖阶段 2 的 source 字段
- 6:独立,可并行
- 7:UI 打磨,最后做

---

## 附录 A · 关键决策记录(ADR-style)

| 决策 | 选择 | 备选 | 理由 |
|---|---|---|---|
| 离线边界 | 渐进式懒加载 + 全库可见 | 全量同步 / 只同步用户关心的 | 兼顾技术玩家与普通用户 |
| 用户画像 | 兼顾两类 | 只技术 / 只普通 | 产品多用户场景 |
| 下载粒度 | 单曲/专辑/歌单均可 | 仅专辑级 | 用户要求灵活 |
| 智能下载规则 | 四条并列,独立开关 | 一条总规则 | 不同用户偏好不同组合 |
| 隐式缓存 | LRU + 队列预缓存 | 完全不缓存 / 仅 LRU | 流畅性与资源占用的平衡 |
| 视觉分层 | 可用状态三档 | 未同步一律隐藏 | 透明度优于"消失" |
| 存储治理 | 分类配额 | 单一上限 / 强制用户设置 | 每类资源生命周期不同 |
| 网络感知 | 自动 | 手动切换 | 避免维护两个心智模型 |
| 智能下载清理 | 规则失效立即清 | LRU 降级 / 询问用户 | 确定性优先 |
| 服务器删除 | 保留本地副本 | 跟随删除 | 用户数据信任 |
| 同步触发 | 启动 + 焦点 + 手动 | 仅启动 / 仅手动 | 多层保障新鲜度 |
| 音频质量 | 流式/下载分开 | 单一质量 | 流量 vs 音质的分别控制 |
| 首次同步 UI | 顶栏 + 可展开 | 阻塞启动页 / 全静默 | 不打扰但可查 |
| 歌词策略 | 随音频下载一并拉 | 前台预取 | 性价比 |
| Electron 存储 | 统一 Cache API | 原生 FS 分叉 | 砍实现复杂度 |
| 多设备 | 各设备独立 | 显式下载清单同步 | 简单且符合用户直觉 |
| 性能基准时机 | 延迟到 P1.2 实际使用验证 | 合成基准(vitest + fake-indexeddb)/ 一次性手动压测 | fake-indexeddb 是纯 JS 实现,比真 IDB 慢 10–100 倍,合成基准证不了真浏览器能达标;Dexie + 真 IDB 索引性能已是业界验证;真实渲染场景比合成更贴近用户体验。若 P1.2 切 readers 后出现可感卡顿,现场诊断是索引缺失还是查询不当更精准。 |
