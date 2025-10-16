## Overlay Effects Subsystem — Short Spec (External Developer)
Date: 15 Oct 2025 · Version: 1.0

### Goal
- Standalone TS module for video overlays: 5–10 concurrent overlays per scene, timed windows, blend modes, opacity; image/video sources; plug‑and‑play for Node.js + TypeScript.

### Deliverables
- TS package with public API; no dependency on our private code. Buildable with README.

### Suggested structure
- `src/core/OverlayEngine.ts` (entry), `OverlayTrack.ts`, `OverlayEffect.ts`
- `src/io/AssetFetcher.ts`, `Transcoder.ts`, `CacheStore.ts`
- `src/remotion/BlendOverlay.tsx`, `MultiOverlayRenderer.tsx`
- `src/types/index.ts`, `src/utils/*`, plus README, package.json, tsconfig.json

### Public API (TypeScript)
```ts
export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
export type OverlayTiming = { kind: 'full' } | { kind: 'window'; startSec: number; endSec: number };
export type OverlaySource = { kind: 'image'; src: string } | { kind: 'video'; src: string };

export interface OverlayInput { id: string; source: OverlaySource; blendMode: BlendMode; opacity: number; zIndex: number; timing: OverlayTiming; }
export interface SceneInput { width: number; height: number; fps: number; durationSec: number; overlays: OverlayInput[]; }
export interface PreparedAsset { id: string; kind: 'image'|'video'; staticPath: string; }
export interface PrepareResult { assets: PreparedAsset[]; }
export interface OverlayEngine { prepare(scene: SceneInput): Promise<PrepareResult>; }
```

### Behaviour
- Compute frame windows from `fps` + `timing`; render only within window.
- Deterministic cached paths for assets (e.g., `effects/<hash>.<ext>`).
- Video compatibility: mp4 H.264, yuv420p, faststart; transcode if needed.
- `BlendOverlay.tsx` must use a static path (staticFile‑style), not direct HTTP.
- Sort by `zIndex` for layer order.

### Constraints
- Autonomous; no OS temp paths; no hangs on load/metadata errors.

### Acceptance
- Demo: ≥2 scenes, 5–10 overlays with different windows; no failures/hangs.
- ≥2 video overlays render correctly; images render correctly.
- Builds via `npm run build`; README with run examples.

### Test assets (within package)
- `fixtures/` with png/jpg; mp4 (plus one non‑compatible); JSON example for `SceneInput`.

### Delivery & Timeline
- Repo/archive with TS sources, build, README, license; no secrets.
- Prototype 2–3 days; full 5–7 days.

Uncovered questions resolve toward autonomy and predictability (stable paths, no hangs, correct types).


