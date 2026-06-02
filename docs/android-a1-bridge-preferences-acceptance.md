# Android A1 Bridge 与 Preferences 验收记录

日期：2026-06-03

范围：A1 Bridge 与 Preferences。未开始 A2 Media3 播放最小闭环。

## 自动化检查

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| `pnpm run test:unit -- src/native/bridge/facade.test.ts src/native/preferences/facade.test.ts src/api/queryServerInfo.test.ts` | 通过 | Vitest 实际运行 62 个测试文件，795 个测试通过。 |
| `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew :aonsoku-capacitor-native:testDebugUnitTest` | 通过 | 使用 Android Studio JBR 21。系统默认 JDK 26 会导致 Gradle/Groovy `Unsupported class file major version 70`。 |
| `pnpm run lint` | 通过 | Biome lint 无错误。 |
| `pnpm run build` | 通过 | TypeScript 与 Vite build 通过；保留既有 Vite chunk/env-script warning。 |
| `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew :app:assembleDebug` | 通过 | Debug APK 构建通过；保留 `libdatastore_shared_counter.so` strip warning。 |
| `xcodebuild -project "ios/App/App.xcodeproj" -scheme App -configuration Debug -sdk iphonesimulator -derivedDataPath "/var/folders/v9/x8svdqsj135g48hn_063rv100000gn/T/opencode/aonsoku-ios-derived" build` | 通过 | iOS simulator Debug build 通过。 |

## Android 真机验收清单

- [ ] API 24：全新安装 Debug APK，登录成功后杀进程并重启，仍恢复已登录会话。
- [ ] API 24：主地址不可达且备用地址可达时，登录按合同切换到备用地址。
- [ ] API 24：退出登录后重启，Keystore 凭据与登录会话已清理。
- [ ] API 24：抓取 logcat，确认不输出密码、token 或可复用认证材料。
- [ ] API 33+：重复登录、重启恢复、备用地址切换和退出清理流程。
- [ ] API 33+：确认 A1 不请求通知权限，不出现播放通知或 MediaSession 行为。
- [ ] API 33+：抓取 logcat，确认未完成的 Data/Audio 能力仍返回明确 unavailable。

## iOS 真机回归项

- [ ] iOS 真机：登录、重启恢复、退出清理保持既有 Keychain 行为。
- [ ] iOS 真机：原生请求代理仍可加载资料库列表数据。
- [ ] iOS 真机：Preferences 迁移与队列/播放历史恢复保持既有行为。

## 范围检查

- 只实现 Android `AonsokuNativeBridge` 与 `AonsokuNativePreferences`。
- TypeScript 仅将 Bridge/Preferences 能力判断扩展到 Android，并接线登录、重启恢复、退出清理、服务端信息查询和 API 请求代理。
- 未修改 Android `AudioPlugin`、`DataPlugin`、`PlaybackService`、Media3、通知、MediaSession 或原生队列。
- 未引入播客模型、路由或 API 变更。
- A2 仍未开始；未完成能力继续由 A0 skeleton 返回 unavailable。
