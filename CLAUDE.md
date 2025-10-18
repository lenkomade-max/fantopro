# CLAUDE.md

This file provides **technical documentation** for FantaProjekt.

For **Claude Code behavior rules** see: `.claude/custom-instructions.md`
For **Cursor Chat rules** see: `/root/.cursor/.cursorrules`

---

## Project Overview

**FantaProjekt** is an automated short-form video creation system for TikTok, Instagram Reels, and YouTube Shorts. It extends [short-video-maker](https://github.com/gyoridavid/short-video-maker) with additional features while maintaining 100% backward compatibility.

**Core capabilities**:
- Multiple content sources (Pexels API, URLs, direct file uploads)
- Visual overlay effects with blend modes (VHS, glitches, light leaks)
- Text overlays (static and animated)
- AI voice synthesis (Kokoro TTS, 72+ voices)
- Automatic subtitle generation (Whisper)
- Background music with auto-ducking
- REST API and MCP protocol support

**Technology stack**: Node.js 18+, TypeScript 5+, Remotion 4.0.286, Express, FFmpeg, Vite

## Essential Commands

### Development
```bash
npm install              # Install dependencies
npm run build           # Build TypeScript + Vite (required before running)
npm run dev             # Development mode with hot reload
npm start               # Start production server (port 3123)
npm test                # Run Vitest test suite
```

### API Testing
```bash
# Create video
curl -X POST http://localhost:3123/api/short-video \
  -H "Content-Type: application/json" \
  -d @test-simple.json

# Check status
curl http://localhost:3123/api/short-video/<videoId>/status

# Download video
curl http://localhost:3123/api/short-video/<videoId> > output.mp4
```

### Environment Setup
Create `.env` file with:
```
PEXELS_API_KEY=your_key_here
PORT=3123
LOG_LEVEL=debug
DEV=true
```

## Architecture Overview

### Core Principle: Non-Breaking Extensions
The original short-video-maker code remains **untouched**. All new features are implemented as extensions in separate modules. This ensures backward compatibility and allows the project to sync with upstream updates.

### Main Pipeline Flow
```
Input JSON → ShortCreator → Content Acquisition → TTS Generation →
Subtitle Generation → Remotion Rendering (NO effects) →
FFmpeg Post-Processing (Blend + Chromakey) → Final MP4 Output
```

### Key Components

**ShortCreator** (`src/short-creator/ShortCreator.ts`):
- Main orchestration class managing the video creation pipeline
- Queue-based processing system (one video at a time)
- Integrates all libraries: Remotion, Kokoro, Whisper, FFmpeg, Pexels
- Uses ContentSourceFactory for flexible media sourcing
- Uses EffectManager for overlay effects

**Content Sources** (`src/short-creator/libraries/ContentSource/`):
- `Factory.ts`: Determines source type from input
- `PexelsSource.ts`: Searches Pexels API (original behavior)
- `UrlSource.ts`: Downloads from HTTP/HTTPS URLs
- `FileSource.ts`: Handles direct file uploads (base64 or binary)

**Effect System** (`src/short-creator/effects/`):
- `EffectManager.ts`: FFmpeg post-processing engine
  - `applyBlendOverlay()`: RGB color space blend (12+ modes: addition, overlay, multiply, screen, etc.)
  - `applyBannerChromakey()`: Green screen chromakey with similarity/blend control
- `OverlayCache.ts`: Caches effect files in `static/effects/`
- All effects applied AFTER Remotion render via FFmpeg

**Remotion Integration** (`src/short-creator/libraries/`):
- `Remotion.ts`: Standard video rendering (NO effects)
- Effects are applied via FFmpeg post-processing AFTER Remotion render

**Remotion Compositions** (`src/remotion/compositions/`):
- `KenBurnsImage.tsx`: Photo zoom effect for image slides
- `TextOverlay.tsx`: Animated text overlays

**Video Components** (`src/components/videos/`):
- `PortraitVideo.tsx`: 9:16 aspect ratio (1080×1920)
- `LandscapeVideo.tsx`: 16:9 aspect ratio (1920×1080)

**Type Definitions** (`src/types/shorts.ts`):
- Zod schemas for validation
- `SceneInput`: Scene configuration with media, effects, text overlays
- `RenderConfig`: Voice, music, orientation, captions
- `MediaSource`: Union type for Pexels/URL/File sources

### Directory Structure
```
src/
├── short-creator/          # Core video creation logic
│   ├── ShortCreator.ts     # Main orchestrator
│   ├── libraries/          # External integrations
│   │   ├── Remotion.ts     # Standard renderer
│   │   ├── OverlayRemotion.ts  # Enhanced renderer
│   │   ├── Kokoro.ts       # TTS synthesis
│   │   ├── Whisper.ts      # Subtitle generation
│   │   ├── FFmpeg.ts       # Audio/video processing
│   │   ├── Pexels.ts       # Pexels API client
│   │   └── ContentSource/  # Media source factory
│   ├── effects/            # Effect processing
│   │   ├── EffectManager.ts
│   │   └── OverlayCache.ts
│   └── music.ts            # Music management
├── components/             # Remotion video components
│   └── videos/             # Portrait/Landscape templates
├── remotion/               # Remotion-specific code
│   └── compositions/       # KenBurnsImage + TextOverlay only
├── server/                 # API servers
│   └── routers/
│       ├── rest.ts         # REST API endpoints
│       └── mcp.ts          # MCP protocol
├── types/                  # TypeScript definitions
│   └── shorts.ts           # Main types & schemas
├── config/                 # Configuration
└── ui/                     # Vite-based UI (optional)

static/
├── music/                  # Background music (12 moods)
└── effects/                # Cached overlay effects
```

## Data Schemas

### Input Format (SceneInput)
```typescript
{
  text: string;              // Required: Text to be spoken

  // Legacy (backward compatible)
  searchTerms?: string[];    // Pexels search

  // New flexible media source
  media?: {
    type: "pexels" | "url" | "files";
    // Pexels
    searchTerms?: string[];
    // URL
    urls?: string[];
    // Files
    files?: Array<{
      filename: string;
      data: string | Buffer;  // base64 or binary
      mimeType: string;
    }>;
  };

  // Visual effects
  effects?: Array<{
    type: "blend";
    overlayUrl?: string;
    staticEffectPath?: string;
    blendMode: "normal" | "overlay" | "multiply" | "screen" | ...;
    opacity: number;  // 0.0-1.0
    duration?: "full" | { start: number; end: number };
  }>;

  // Text overlays
  textOverlays?: Array<{
    text: string;
    position: { x: "left"|"center"|"right"|number; y: "top"|"center"|"bottom"|number };
    style?: { fontSize, fontFamily, color, backgroundColor, padding, opacity };
    animation?: "fadeIn" | "slideIn" | "typewriter" | "bounce" | "pulse";
    timing?: { start: number; end: number };
  }>;
}
```

### Configuration (RenderConfig)
```typescript
{
  voice?: VoiceEnum;              // 72+ voices (default: af_heart)
  music?: MusicMoodEnum;          // 12 moods (sad, dark, chill, etc.)
  musicVolume?: "muted"|"low"|"medium"|"high";
  orientation?: "portrait"|"landscape";
  captionPosition?: "top"|"center"|"bottom";
  captionBackgroundColor?: string;
  paddingBack?: number;           // Extra time after speech (ms)
}
```

## Common Development Tasks

### Testing Video Generation
Use example JSON files in the root directory as templates:
- `test-simple.json` - Minimal example with Pexels
- `comprehensive_test_video.json` - Full-featured example with overlays

### Adding New Visual Effects
1. Place effect video/image in `static/effects/`
2. Reference in JSON:
   ```json
   {
     "effects": [{
       "type": "blend",
       "staticEffectPath": "effects/my-effect.mp4",
       "blendMode": "overlay",
       "opacity": 0.6
     }]
   }
   ```
3. Effect is auto-cached by OverlayCache on first use

### Working with FFmpeg Overlays
**Production System**: FFmpeg Post-Processing (after Remotion render)

**Blend Overlays**:
- Applied via `EffectManager.applyBlendOverlay()`
- RGB color space (format=gbrp) for accurate blending
- 12+ blend modes: addition, overlay, multiply, screen, dodge, burn, etc.
- Configurable opacity (0.0 - 1.0)
- Example:
  ```json
  {
    "type": "blend",
    "staticEffectPath": "effects/VHS_01_small.mp4",
    "blendMode": "addition",
    "opacity": 0.5
  }
  ```

**Chromakey Banners**:
- Applied via `EffectManager.applyBannerChromakey()`
- Green screen removal (color: 0x00FF00)
- Similarity (0.0 - 1.0): how similar colors to remove
- Blend (0.0 - 1.0): edge softness
- Example:
  ```json
  {
    "type": "banner_overlay",
    "staticBannerPath": "banner/greenscreenBanner.mp4",
    "chromakey": {
      "color": "0x00FF00",
      "similarity": 0.4,
      "blend": 0.1
    },
    "position": { "x": 0, "y": 0 }
  }
  ```

### Debugging Render Issues
1. Check logs: Enable `LOG_LEVEL=debug` in `.env`
2. Increase timeout: Default is 120s in `remotion.config.ts`
3. Test simpler JSON first to isolate issues
4. Verify FFmpeg commands in logs (commandLine field)

### Running Tests
```bash
npm test                    # All tests
npm test ShortCreator       # Specific test file
npm test -- --watch         # Watch mode
```

## API Endpoints

### REST API
- `POST /api/short-video` - Create video, returns `{ videoId, status }`
- `GET /api/short-video/:id/status` - Check processing status
- `GET /api/short-video/:id` - Download rendered video (MP4)
- `DELETE /api/short-video/:id` - Delete video
- `GET /api/voices` - List available TTS voices
- `GET /api/music-tags` - List music moods
- `GET /api/tmp/:filename` - Serve temporary files (for Remotion)

### MCP Protocol
Compatible with Model Context Protocol for AI agent integration.

## Build System

### TypeScript Compilation
- Main config: `tsconfig.json`
- Build config: `tsconfig.build.json` (excludes UI and tests)
- Output: `dist/` directory
- Entry point: `src/index.ts` → `dist/index.js`

### Vite Build (UI)
- Config: `vite.config.ts`
- Root: `src/ui/`
- Output: `dist/ui/`
- Dev server: Port 3000 with proxy to API (port 3123)

### Remotion Configuration
- Config: `remotion.config.ts`
- Public directory: `static/` (includes music and effects)
- Entry point: `src/components/root/index.ts`
- Chrome renderer: `egl` for better performance
- Concurrency: 1 (for stability with overlays)
- Webpack polyfills for Node.js modules (path, crypto, stream, etc.)

## Development Guidelines

See `/root/.cursor/.cursorrules` for complete project rules (validation, testing, порядок работы).

**Key technical constraints:**
- Preserve backward compatibility with original short-video-maker
- Use absolute paths and validate file existence
- Clean up temp files after rendering
- Queue-based processing (one video at a time)

## Known Limitations

- FFmpeg blend processing takes ~15-30s per effect (sequential processing)
- Multiple blend effects are applied sequentially (not in parallel)
- Rendering with 3+ effects may take 1-2 minutes total
- Chromakey works best with pure green (#00FF00) backgrounds
- Ken Burns zoom effect for photos centers on image (no panning)

## Documentation References

- `README.md` - Project overview and quick start
- `Документы/МАНИФЕСТ_ПРОЕКТА.md` - Complete feature manifest (Russian)
- `Документы/АРХИТЕКТУРА.md` - Detailed architecture (Russian)
- `FFMPEG_OVERLAY_GUIDE.md` - FFmpeg blend and chromakey overlay guide
- `Документы/Журнал/FFMPEG_INTEGRATION_JOURNAL_18OCT2025.md` - FFmpeg integration journal
- `FANTA_PROJECT_CONTEXT.md` - Integration context for Fanta Site editor
- `FANTA_TECHNICAL_SPEC.md` - Technical integration specification
- `UPDATE_LOG.md` - Recent changes and updates

