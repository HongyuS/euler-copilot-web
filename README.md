# openEuler Intelligence Web

openEuler Intelligence Web 是 openEuler 社区智能化体验的 Web 与桌面端统一前端，提供模型互动、知识检索与应用中心等能力，并兼容浏览器部署与 Electron 桌面应用形态。

## 功能特性

- 智能对话：通过 [openEuler Intelligence 智能体框架](https://gitee.com/openeuler/euler-copilot-framework) 汇聚多模型能力，支持多轮问答与上下文管理。
- 知识检索：对接 openEuler 文档与知识库，提供搜索与摘要能力。
- 应用中心：提供工作流、工具链和插件入口，便于扩展智能化方案。
- 多端形态：基于 Vite + Vue 3 构建 Web 端界面，并通过 Electron 打包桌面应用。
- 国际化支持：内置中英文语言包，可根据用户语言自动切换。

## 技术栈

- 运行时：Vue 3、Pinia、Vue Router、Element Plus、ECharts
- 开发框架：Vite、TypeScript、Sass
- 构建与脚本：pnpm、TS Node、Rollup、Electron Builder
- 代码质量：ESLint、Prettier、TypeScript 类型检查

## 环境要求

- Node.js >= 22.14.0
- pnpm 10.14.0（安装见 [pnpm 官方说明](https://pnpm.io/installation)）
- macOS、Linux 或 Windows 开发环境

## 快速开始

```bash
# 安装依赖
pnpm install

# 仅运行 Web 渲染进程（默认 http://localhost:5173）
pnpm run dev

# 与 Electron 主进程/预加载/欢迎页协作开发桌面端
pnpm run dev:desktop

# 构建 Web 产物
pnpm run build

# 构建桌面端完整产物（生成于 dist/）
pnpm run build:desktop
```

常用调试脚本：

- `pnpm run dev:main`：Electron 主进程 TS -> JS 热编译。
- `pnpm run dev:preload`：Electron 预加载脚本实时构建。
- `pnpm run dev:welcome`：桌面欢迎页构建与监听。
- `pnpm run preview`：在本地以生产配置预览构建结果。

## 项目结构

```text
├─ src/                 # Web 渲染进程源码（Vue 组件、路由、状态、工具等）
├─ electron/            # Electron 主进程、预加载脚本与桌面欢迎页
├─ build/               # 构建配置、桌面安装器模版与 RPM 规范
├─ scripts/             # TS 构建脚本与通用工具
├─ docs/                # 开发者文档（桌面配置说明等）
├─ public/              # 静态资源与 HTML 模版
└─ release/             # 预构建桌面/Web 安装包与离线依赖
```

## 配置与环境

- `env.d.ts` / `src/conf`：环境变量类型声明与运行时配置说明。
- `deploy/`：部署所需的 Nginx 配置及启动脚本。
- `build/scripts/*.sh`：RPM 打包、离线依赖准备等辅助脚本。

## 质量与校验

- `pnpm run lint`：自动修复大部分 ESLint 规则。
- `pnpm run format`：对 `src/`、`electron/`、`scripts/` 执行 Prettier。
- `pnpm run type-check`：运行 TypeScript 静态类型检查。

## 贡献指南

欢迎通过 Issue 与 Pull Request 为 openEuler Intelligence Web 做出贡献：

1. Fork 仓库并创建特性分支（推荐命名 `feat/<topic>`）。
2. 提交包含必要说明的变更，确保通过 lint 与类型检查。
3. 提交 Pull Request，并补充相关测试或调试步骤说明。
4. 参与代码评审，及时响应维护者反馈。

我们同时欢迎文档改进、体验反馈与 Bug 报告，可在 Issue 中附带重现步骤与环境信息，加速问题定位。

## 开源许可证

本项目遵循 [Mulan PSL v2](LICENSE) 开源许可证。欢迎在遵循协议的前提下使用与二次开发。
