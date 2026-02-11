

# TTF Font Upload with Cursive Tracing, Animation Recording, and Audio

## Overview
Add a new mode to the Font Compiler page where users can upload a `.ttf` font file, name it, and render its glyphs as translucent guide overlays on the canvas. The user then traces/overwrites the characters on the canvas, and the system records both the stroke animation and audio narration. This operates as a separate workflow from the existing manual font-building tools.

---

## Feature Breakdown

### 1. TTF Font Upload and Management
- Add an **"Import Font"** panel (collapsible card) in the Font Compiler page's left column, below or above the existing CharacterGrid.
- The panel includes:
  - A file input accepting `.ttf` files (stored in Lovable Cloud file storage, NOT the database).
  - A text input for the font name.
  - A dropdown to select from previously uploaded fonts.
- When a font is uploaded, store the file in a **storage bucket** (`uploaded-fonts`) and save a reference row in a new `uploaded_fonts` table (id, font_name, file_url, created_at).
- Load the TTF into the browser using `@font-face` injection (same pattern as `LiveTypeTester`).

### 2. Cursive Guide Overlay on Canvas
- When an uploaded font is active and a character (or word/sentence) is selected, render the target text using the uploaded font as a **semi-transparent overlay** behind the drawing layer on `FourLineCanvas`.
- For cursive/connected writing, add a **"Word Mode"** toggle that lets users type a full word or sentence instead of selecting single characters. The overlay renders the entire word in the uploaded cursive font, maintaining natural ligatures and connections.
- The overlay is drawn on a separate canvas layer (or as an underlay image) so it doesn't interfere with stroke capture.

### 3. Overwrite and Save
- Users draw on top of the overlay, tracing or correcting the cursive shapes.
- Saving works the same as the existing flow: strokes are normalized and stored in `font_library`.
- In word mode, individual characters can be segmented or the entire word saved as a ligature entry.

### 4. Animation Recording
- Integrate the existing `StrokeReplayCanvas` component to replay the user's tracing session.
- Add a **"Record Session"** button that captures all strokes drawn during a tracing session with timing data (already captured in stroke points' timestamps).
- Save recordings to the existing `stroke_recordings` table, linked to the font_library entry.

### 5. Audio Narration
- Integrate the existing `VoiceNarrationControls` and `useAudioRecorder` hook into the tracing workflow.
- Audio is recorded during replay (existing pattern) or optionally during live drawing.
- Audio files stored in a **storage bucket** (`narration-audio`), with the URL saved in `stroke_recordings` or a new column.

---

## Technical Details

### Database Changes

**New table: `uploaded_fonts`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| font_name | varchar | NOT NULL |
| file_url | text | NOT NULL, storage path |
| created_at | timestamptz | default now() |

**New storage bucket: `uploaded-fonts`** (public read)

**New storage bucket: `narration-audio`** (public read)

**New column on `stroke_recordings`:**
- `narration_url` (text, nullable) -- URL to audio file in storage

### New Components

1. **`FontUploadPanel.tsx`** -- File upload UI, font name input, font selector dropdown. Handles uploading to storage, injecting `@font-face`, and managing uploaded font state.

2. **`CursiveOverlay.tsx`** -- Renders the uploaded font text as a canvas underlay. Uses an offscreen canvas or SVG text element with the uploaded font family, drawn semi-transparently beneath the main drawing surface.

3. **`TracingSessionRecorder.tsx`** -- Wraps StrokeReplayCanvas + VoiceNarrationControls + session save logic. Appears after a tracing is completed, allowing replay, narration recording, and saving the full session.

### Modified Components

- **`FourLineCanvas.tsx`** -- Add an optional `overlayImage` or `overlayText` prop to render a font guide layer beneath strokes. Add a "word mode" text input for cursive sentences.

- **`FontCompiler.tsx`** -- Add the FontUploadPanel to the layout. Wire up overlay rendering and session recording. Add a toggle between "Build Font" mode (existing) and "Trace Font" mode (new).

- **`CanvasToolbar.tsx`** -- Add a mode toggle button (Build vs Trace).

### File Storage Pattern
```text
Upload TTF --> Storage bucket "uploaded-fonts"
                  |
                  v
            uploaded_fonts table (font_name, file_url)
                  |
                  v
            @font-face injection in browser
                  |
                  v
            Render as overlay on canvas
```

### Cursive Word Rendering Flow
```text
User types word --> Render with uploaded @font-face
                        |
                        v
                  Canvas underlay (low opacity)
                        |
                        v
                  User traces over it
                        |
                        v
                  Save strokes + timing data
                        |
                        v
                  Replay + Audio recording
```

### Key Implementation Notes

- The uploaded font and the hand-built font are kept completely separate. The uploaded font is only used as a visual reference/guide overlay.
- Cursive connectivity is handled by the uploaded TTF itself (its ligature tables and glyph design). We simply render text with it -- no custom cursive logic needed.
- The existing stroke capture, replay, and audio systems are reused with minimal changes.
- Word mode saves the entire traced word as a single entry (useful for ligature training), while individual character mode works as before.

