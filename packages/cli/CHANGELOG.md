# Changelog

## [0.4.0](https://github.com/stemdev-hub/cli/compare/cli-v0.3.1...cli-v0.4.0) (2026-11-01)


### ⚠ BREAKING CHANGES

* retire Tag schemas and reject unknown config fields

### Features

* **cli:** add private output bookkeeping foundation ([7f06f08](https://github.com/stemdev-hub/cli/commit/7f06f0833d8efb4197526cd61d3aaf2294fe3927))
* **cli:** implement private publication and selective cleanup ([df5c156](https://github.com/stemdev-hub/cli/commit/df5c156b5c3f0e14a32eec737b9a667c3ec73fc0))
* establish durable project identity lifecycle ([225fdc8](https://github.com/stemdev-hub/cli/commit/225fdc8dc6f28963c49c6a4f19925d9e3b95f8ce))
* integrate public Pure Block workflows ([48aa4b1](https://github.com/stemdev-hub/cli/commit/48aa4b17a3ba5904c2dfc4196b01dc1dcc0ab5da))


### Bug Fixes

* **cli:** prevent file writer races and temporary-file collisions ([cdd1389](https://github.com/stemdev-hub/cli/commit/cdd13892438c7787b42e3c80b56aa4e740e27fab))


### Code Refactoring

* retire Tag schemas and reject unknown config fields ([d775326](https://github.com/stemdev-hub/cli/commit/d775326b678da76184e9c9cf2c0faa280b59c22b))

## [0.3.1](https://github.com/stemdev-hub/cli/compare/cli-v0.3.0...cli-v0.3.1) (2026-10-11)


### Bug Fixes

* **cli:** correct runtime dependency ownership and prune unused packages ([0af64f1](https://github.com/stemdev-hub/cli/commit/0af64f1ab933012134bfdaa376601d307e41980c))

## [0.3.0](https://github.com/stemdev-hub/cli/compare/cli-v0.2.1...cli-v0.3.0) (2026-10-08)


### Features

* extract @stemdev/core and render VS Code previews in-process ([#14](https://github.com/stemdev-hub/cli/issues/14)) ([f9fa16f](https://github.com/stemdev-hub/cli/commit/f9fa16ffee917cc204263e963b05d86e7811bda3))

## [0.2.1](https://github.com/stemdev-hub/cli/compare/cli-v0.2.0...cli-v0.2.1) (2026-08-24)


### Bug Fixes

* **cli:** update dependencies and fix NPM publish command ([3972369](https://github.com/stemdev-hub/cli/commit/397236963618ea30dd484c7f78ee63d4acf0171a))

## [0.2.0](https://github.com/stemdev-hub/cli/compare/cli-v0.1.0...cli-v0.2.0) (2026-08-24)


### Features

* **cli:** add 'stem mcp setup' command for AI assistant auto-configuration ([ee606a7](https://github.com/stemdev-hub/cli/commit/ee606a7b6240274a8d940daa79432d2efd2b5442))
* **cli:** add Stem MCP server implementation and stdio transport ([841b2eb](https://github.com/stemdev-hub/cli/commit/841b2eb3c020e5324184d600c6d8f06b329f9194))
* **mcp:** Rewrite mcp setup interactive flow ([882774e](https://github.com/stemdev-hub/cli/commit/882774e8516cb04dbcaa6517ad26803cb95ae0fb))
