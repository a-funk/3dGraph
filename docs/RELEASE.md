# Release

3dGraph is pre-npm until the first public package publish. During pre-release,
recommend exact GitHub SHA installs:

```bash
npm install github:a-funk/3dGraph#<commit-sha>
```

## Local Gate

Run the full gate from a clean worktree before tagging or announcing:

```bash
npm ci
npm run release:gate
```

The visual smoke writes desktop and mobile screenshots to the temp directory it
prints. Inspect them when changing renderer, controls, layout, or example code.

## Versioning

- Patch: bug fixes, docs corrections, and test-only hardening.
- Minor: new public helpers, examples, or interaction/controller API.
- Major: graph data contract breaks or controller method semantics change.

Update `package.json`, `package-lock.json`, and `CHANGELOG.md` together.

## Publish Checklist

- GitHub Actions is green on `main`.
- `npm pack --dry-run` contains only source, docs, examples, README, changelog,
  and license material intended for consumers.
- The package installs into a clean Vite app through `npm run smoke:consumer`.
- TypeScript consumers import root and subpath exports without casts.
- Browser smoke verifies nonblank desktop/mobile WebGL rendering.
- No product API, auth, storage, frame messaging, telemetry, or private URL
  coupling appears in `src/`.
- README install instructions match the release channel: exact SHA for
  pre-release, package install after npm publication.

## First npm Publish

Authenticate as an npm user that can publish the `@a-funk` scope:

```bash
npm login
npm whoami
```

Then publish the scoped package publicly:

```bash
npm publish --access public
npm view @a-funk/3d-graph version dist-tags --json
```

After the registry confirms the version, update README install guidance to make
`npm install @a-funk/3d-graph` the primary path and keep GitHub SHA pinning as a
pre-release/debug fallback.

## What Not To Ship

- Built artifacts from `build/`, `dist/`, screenshots, or `.tgz` files.
- Product-specific adapters, tokens, data exports, or local vault paths.
- New URL parameter, storage, or frame messaging behavior without a security
  review and explicit opt-in design.
