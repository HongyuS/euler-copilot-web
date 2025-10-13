# Changelog

## [0.10.0] - 2025-09-30

### Added

- Choice-branch workflow builder now renders condition paths visually, includes parameter completion prompts, and introduces a full-featured YAML editor with inline validation and formatting.
- Agent debugging dialog embeds the dialogue panel with session history, file previews, and Markdown rendering for richer troubleshooting.
- Dialogue responses surface reference documents with summaries plus download icons across multiple formats.
- MCP service management adds categorized listings, activation toggles, and automatic persistence when selecting services.
- Activation-key entry dialog compatible with legacy localization keys, alongside a pre-publish risk confirmation flow for agents.
- Auto-execution toggle and parameter-supplement modal streamline agent testing workflows.

### Changed

- Refreshed localization strings for English and workflow terminology, adding YAML-focused vocabulary and dialogue messaging updates.
- Conversation store refactor improves session synchronization, default titles, and metadata propagation throughout the UI.
- API layer carries expanded payloads for MCP queries, workflow operations, and stop-generation controls.
- UI refinements throughout agent creation, dialogue, and shared footer components with updated styling tokens and layout adjustments.
- Build tooling updates across Dockerfile, RPM specs, and Vite configuration to support 0.10.0 packaging and worker domain settings.

### Fixed

- Resolved nginx and CSP configuration issues to allow cross-origin communication and image loading.
- Corrected workflow connector behaviour, addressing line rendering, edit errors, and choice-path highlighting bugs.
- Patched MCP config display issues and application status interaction regressions in the service management views.
- Ensured knowledge-base removals refresh immediately and agent metadata fields display correctly.
- Fixed production runtime errors and dialogue height regressions observed in the previous release.
