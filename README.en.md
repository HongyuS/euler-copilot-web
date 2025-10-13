# openEuler Intelligence Web

openEuler Intelligence Web provides the unified front-end experience for openEuler's intelligence platform across web browsers and Electron desktop apps, featuring model interaction, knowledge retrieval, and an application center for extended tooling.

## Features

- Intelligent chat: orchestrates multiple models via the [openEuler Intelligence agent framework](https://gitee.com/openeuler/euler-copilot-framework) to support multi-turn conversations and context management.
- Knowledge retrieval: connects to the openEuler documentation corpus to deliver search and summarization.
- Application center: exposes workflows, toolchains, and plugin entry points to extend intelligence scenarios.
- Multi-surface delivery: ships a Vite + Vue 3 web UI and packages it as an Electron desktop application.
- Internationalization: ships with Chinese and English locales and switches automatically based on user language.

## Tech Stack

- Runtime: Vue 3, Pinia, Vue Router, Element Plus, ECharts
- Development tooling: Vite, TypeScript, Sass
- Build & scripts: pnpm, TS Node, Rollup, Electron Builder
- Code quality: ESLint, Prettier, TypeScript type checking

## Prerequisites

- Node.js >= 22.14.0
- pnpm 10.14.0 (see the [pnpm installation guide](https://pnpm.io/installation))
- macOS, Linux, or Windows development environment

## Getting Started

```bash
# Install dependencies
pnpm install

# Run only the web renderer (defaults to http://localhost:5173)
pnpm run dev

# Collaboratively develop the desktop app (main/preload/welcome)
pnpm run dev:desktop

# Build the production web bundle
pnpm run build

# Build the full desktop artifacts (output in dist/)
pnpm run build:desktop
```

Common debugging scripts:

- `pnpm run dev:main`: transpile the Electron main process with watch mode.
- `pnpm run dev:preload`: rebuild Electron preload scripts on file changes.
- `pnpm run dev:welcome`: watch and rebuild the desktop welcome screen.
- `pnpm run preview`: preview the production build locally.

## Project Structure

```text
├─ src/                 # Web renderer code (Vue components, router, store, utilities)
├─ electron/            # Electron main process, preload scripts, welcome screens
├─ build/               # Build configuration, installer templates, RPM specs
├─ scripts/             # TypeScript build utilities and helpers
├─ docs/                # Developer documentation (desktop configuration, etc.)
├─ public/              # Static assets and HTML templates
└─ release/             # Pre-built desktop/web packages and offline dependencies
```

## Configuration

- `env.d.ts` / `src/conf`: environment variable typings and runtime configuration references.
- `deploy/`: Nginx templates and startup scripts for deployment.
- `build/scripts/*.sh`: helper scripts for RPM packaging and offline dependency preparation.

## Quality Gates

- `pnpm run lint`: auto-fix most ESLint rules.
- `pnpm run format`: run Prettier on `src/`, `electron/`, and `scripts/`.
- `pnpm run type-check`: execute TypeScript static checks.

## Contributing

We welcome issues and pull requests to improve openEuler Intelligence Web:

1. Fork the repository and create a feature branch (recommended naming `feat/<topic>`).
2. Make changes with clear descriptions and ensure linting and type checks pass.
3. Open a pull request and include relevant testing or verification notes.
4. Join the code review and respond to feedback promptly.

Documentation enhancements, UX feedback, and bug reports are also appreciated—please include reproduction steps and environment details in issues to speed up triage.

## License

This project is licensed under [Mulan PSL v2](LICENSE). You are welcome to use and extend it under the terms of the license.
