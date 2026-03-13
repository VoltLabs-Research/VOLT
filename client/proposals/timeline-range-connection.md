# Feature: Connect Timeline Frame Range Selects to Ruler, Playback, and Transport Controls

**Priority:** P1-high

## Problem

The frame start / frame end selects in the canvas timeline header are purely cosmetic. Changing their values updates the `<select>` display but has zero effect on:

1. **Ruler visual** — ticks always show ALL available timesteps regardless of selected range.
2. **Playback loop** — the RAF-based `tick()` in `playback-slice.ts` cycles through the full `timestepData.timesteps` array.
3. **Transport controls** — jump-to-start goes to `timesteps[0]`, jump-to-end goes to `timesteps[last]`, prev/next navigate the full array.

The root cause is that `rangeStart` / `rangeEnd` are `useState` local to `Timeline/index.tsx` and never propagated to the Zustand store where playback and transport logic live.

## Implementation Plan

### Phase 1: Store Contract & Slice (Foundation)

**Files:** `scene-types.ts`, `playback-slice.ts`

- Extend `PlaybackState` with `rangeStart?: number`, `rangeEnd?: number`
- Extend `PlaybackActions` with `setRangeStart`, `setRangeEnd`, `getRangedTimesteps`
- Implement setters with validation (start <= end, clamp currentTimestep)
- Implement `getRangedTimesteps()` filter
- Update `resetPlayback()` to clear range

### Phase 2: Migrate Timeline Component

**Files:** `Timeline/index.tsx`

- Replace `useState` with store read/write
- Filter `ticks` by range
- Update playhead positioning relative to ranged ticks
- Auto-initialize range on timesteps change

### Phase 3: Playback Loop Constraint

**Files:** `playback-slice.ts`

- `tick()` uses `getRangedTimesteps()` instead of full array
- `playNextFrame()` navigates within range
- Mid-playback range change takes effect immediately

### Phase 4: Transport Controls

**Files:** `TransportControls/index.tsx`

- Jump to Start/End respects range
- Prev/Next navigate within range only
- Remove `timestepData` selector, use `getRangedTimesteps`
