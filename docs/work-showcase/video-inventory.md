# Work 页面视频素材清单（2026-11-01）

来源文件夹：`/Users/trevion/Downloads/Oeuvre/Work`（只读）。试编码的网页版 loop 在 `docs/work-showcase/video-trials/`（H.264、静音、未提交）。

## Bei`Care（只放 App）
| 素材 | 路径 | 时长 / 分辨率 | 状态 |
|---|---|---|---|
| 资料包 | `BeiCare/screens/00–06*.png` | 7 张 iPad 截图 2064×2752，演示模式 "Lumen Botanics" | 可用（静态） |
| 新录屏 | 本机模拟器 "BeiCare QA making"（演示模式，无真实数据），`xcrun simctl io recordVideo` 两次 | 64 s + 75 s，2064×2752 | 原始件在 scratchpad；点按延迟大，只有 Today → Products → New recipe 一段干净 |
| 试编码 | `video-trials/beicare-today.mp4` | 0:10，1032×1376，173 KB | 可用 |
| 试编码 | `video-trials/beicare-products.mp4`（Products + New recipe 弹层） | 0:08，1032×1376，183 KB | 可用 |
| 缺 | 五个 Tab 依次切换的干净 loop（0:15）、Materials / Make / More 各一段 | — | 需重录：模拟器里人手操作 15 秒即可，或我再用脚本录一次（每次点按后等 3 秒） |

## Folio
| 素材 | 路径 | 时长 / 分辨率 | 状态 |
|---|---|---|---|
| 资料包 | `Folio/video/today-scroll-and-open-story.mp4` | 0:14，1206×2622，0.9.118 | 可用 → `video-trials/folio-today.mp4` 0:14，604×1314，450 KB |
| 项目输出 | `…/outputs/editorial-design-system/real-article-lookup.mp4` | 0:12，1320×2868 | 可用 → `video-trials/folio-lookup.mp4` 251 KB |
| 项目输出 | `…/outputs/shelf-0.9.31/shelf-demo.mp4` | 0:35 | 剪 0:14 → `video-trials/folio-shelf.mp4` 223 KB |
| 项目输出 | `…/outputs/archive-0.9.37/archive-zoom.mp4`、`archive-r2-0.9.38/r2-flow.mp4`、`lookup-content-refinement/real-article-morph.mp4` | 0:37 / 0:18 / 0:12 | 备选（Archive 是开发版功能，需标注） |
| 旧 | `Folio/video/archive-add-to-shelf-0.9.93-OLD.mp4` | 0:10，402×874 | 太小，不用 |

## ACE Music
| 素材 | 路径 | 状态 |
|---|---|---|
| 截图 | `ACE Music — Latest Portfolio Kit/01 Screenshots/ACE-Music-current.png` 2360×1764 | 可用（静态） |
| 音频 | `02 Audio/*.wav` 2 × 10 s | 不上网页（版权 / 发布权未核） |
| 无头抓帧 | 本机 http://127.0.0.1:7865/ 用 shoot.mjs 抓 80 帧 | 卷盘不转（无头环境播放未触发），只能当静态 |
| 缺 | 真实录屏 45 s：载入曲库 → 播放（卷盘转、倒计时）→ 拖动卷盘 → 松开；再 描述 → 选风格 → 调参数 → 生成 → 查看 | 需要在这台 Mac 上用 QuickTime / `screencapture -v` 录运行中的 App（我需要屏幕录制权限，或你录 45 秒发我） |

## Stillora（提案）
| 素材 | 路径 | 时长 / 分辨率 | 状态 |
|---|---|---|---|
| 电影 16:9 | `Stillora/film/still-film-desktop-16x9.mp4` | 0:35，1600×900，5.6 MB | → `video-trials/stillora-film.mp4` 1280×720 CRF 29 ≈ 2.3 MB |
| 电影 9:16 | `Stillora/film/still-film-mobile-9x16.mp4` | 0:35，720×1280，2.9 MB | → `video-trials/stillora-film-9x16.mp4` 2.0 MB |
| 3D 转动 | 无视频；`3d/models/*.glb` + 在线查看器 | — | 可从 stillora.co.nz 的查看器截 36 帧（10° 一帧）做成拖动序列，或录 10 秒转动 |

## 网页规格
H.264 (libx264 CRF 27–29, yuv420p, faststart)，静音，≤ 3 MB / 段，≤ 1440 px 宽，`<video muted playsinline loop preload="metadata" poster>`；只在视口内播放；没有任何私人客户数据（Bei`Care 全部演示模式）。
