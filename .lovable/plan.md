

## Auto-Correction Shape Suggestion System

When you finish drawing a stroke, the system will automatically detect if it resembles a known geometric shape (circle, semi-circle, straight line, slant line, arc, etc.). If a match is found, a corrected version is shown as a glowing overlay on top of your original stroke. You can then **Accept** to replace your stroke with the perfected version, or **Reject** to keep your original.

---

### How It Works

1. **Draw a stroke** on the canvas as usual
2. When you lift your pen, the system analyzes the stroke in real-time
3. If a shape is detected (e.g., a wobbly circle), a **green ghost overlay** of the perfected shape appears on top
4. A small floating toolbar appears with **Accept** and **Reject** buttons
5. **Accept** replaces your stroke with the mathematically perfect version
6. **Reject** keeps your original handwriting

### Supported Shape Detections

- **Circle** -- closed loop with roughly equal radius
- **Ellipse** -- closed loop with varying radii
- **Semi-circle / Arc** -- open curved segment
- **Straight line** -- low curvature stroke (horizontal, vertical, or diagonal)
- **Slant line** -- angled straight line with angle snapping

### Detection Logic

Each shape detector works by measuring geometric properties of the completed stroke:

- **Circularity**: ratio of start-end distance to stroke length, plus radius variance from centroid
- **Linearity**: maximum perpendicular deviation from the start-to-end line
- **Arc detection**: consistent curvature without closure

---

### Technical Details

#### 1. New file: `src/hooks/useShapeDetector.ts`

A hook that takes a completed stroke and returns a shape suggestion (if any). Core logic:

- `detectShape(points)` runs all detectors in priority order
- Returns a `ShapeSuggestion` with the detected type, confidence score, and corrected points
- Shape generation functions: `generateCirclePoints()`, `generateLinePoints()`, `generateArcPoints()`, `generateEllipsePoints()`
- Minimum confidence threshold (0.7) to avoid false positives
- Minimum point count (8) to avoid triggering on dots/taps

#### 2. New file: `src/components/handwriting/ShapeCorrectionOverlay.tsx`

A visual overlay component that:

- Renders the suggested corrected shape as a green dashed SVG path on the canvas
- Shows the original stroke slightly dimmed for comparison
- Displays a floating "Accept / Reject" button pair near the shape
- Animates in smoothly when a suggestion appears

#### 3. Edit: `src/hooks/useStrokeCapture.ts`

- Add a `replaceLastStroke(newPoints)` function that swaps the most recently added stroke's points with the corrected shape points
- This is called when the user clicks "Accept"

#### 4. Edit: `src/components/handwriting/FourLineCanvas.tsx`

- After `onEndStroke` fires, run the shape detector on the just-completed stroke
- If a suggestion is returned, show the `ShapeCorrectionOverlay`
- Wire Accept to call `replaceLastStroke` and Reject to dismiss the overlay

#### 5. Edit: `src/pages/FontCompiler.tsx`

- Pass the new `replaceLastStroke` callback down to `FourLineCanvas`
- No other changes needed since the overlay is self-contained inside the canvas

#### 6. New types in `src/types/handwriting.ts`

```typescript
export interface ShapeSuggestion {
  type: 'circle' | 'ellipse' | 'semi_circle' | 'arc' | 'straight_line' | 'slant_line';
  confidence: number;         // 0-1
  correctedPoints: StrokePoint[];
  originalStrokeId: string;
  label: string;              // e.g. "Circle detected (92%)"
}
```

