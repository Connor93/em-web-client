# Rendering Recovery — Full Atlas Reset, Scene Reset, WebGL Context Loss

**Date:** 2026-05-11
**Scope:** Client-only (em-web-client). Closes the rendering-freeze gap left by the freeze-recovery PR earlier today. Players reported sessions where characters become invisible and rendering won't recover; the R-key today only does an *incremental* atlas refresh and has no path for WebGL context loss. This PR adds three additive layers so R reliably restores rendering, and adds detection + auto-recovery for GPU context loss.

## Background

The freeze-recovery PR earlier today made `client.refresh()` (R key, visibilitychange, reconnected) do `clearAllInputs()`, `clearStaleVisualState()`, `typing = false`, ticker restart, `atlas.refresh()`, and send `RefreshRequestClientPacket`.

Three rendering-freeze causes are not fully addressed:

1. **Local atlas state corruption / stale textures.** `atlas.refresh()` (`src/atlas.ts:916`) is *incremental* — it only does `atlas.reset()` if `mapId` changed. The full local rebuild only happens when the server reply arrives at `handleRefreshReply` (`src/handlers/refresh.ts:28`), which does `atlas.reset() + atlas.refresh()`. If the server reply is delayed/lost, the local atlas stays corrupted.
2. **Sprite-pool state corruption inside `MapRenderer`.** Pools `_worldSprites` / `_uiSprites` / `_uiGraphics` (`src/map.ts:239-241`) survive across atlas resets. They reference `Texture` objects that may have been destroyed by `atlas.reset()`. There's a private `clearSceneNodes()` (`src/map.ts:324`) that wipes them, but nothing exposes it for an explicit reset.
3. **WebGL context loss.** No `webglcontextlost` / `webglcontextrestored` handlers exist anywhere. When the GPU context is lost (mobile backgrounded too long, GPU driver hiccup, idle session), the canvas goes black/invisible and no amount of R recovers it — the application doesn't know the context is gone.

## Goals

- `client.refresh()` (R key + all other callers) reliably restores rendering after local atlas/scene corruption, without depending on a server reply.
- WebGL context loss is detected, the user sees a "Restoring graphics..." banner, and rendering self-heals when the context restores.

## Non-goals

- No new packet protocol. Pure client work.
- No re-fetch of EMF map data (captured separately as freeze-recovery follow-up).
- No changes to MinimapRenderer state — its sprite pool is much smaller and doesn't drive the reported freezes.

## Implementation

### Layer A — Local atlas full-reset in `client.refresh()`

`src/client.ts:refresh()` already calls `this.atlas.refresh()`. Add `this.atlas.reset()` immediately before, matching the pattern of `handleRefreshReply`:

```ts
refresh() {
  clearAllInputs();
  this.clearStaleVisualState();
  this.typing = false;
  if (!this.app.ticker.started) {
    this.app.ticker.start();
  }

  // Layer A+B: full local atlas + scene reset, not just incremental refresh.
  // Matches what the server's RefreshReply handler does, but runs locally so
  // we recover even if the server reply is delayed or lost.
  this.mapRenderer.resetScene();
  this.atlas.reset();
  this.atlas.refresh();

  if (this.bus) {
    this.bus.send(new RefreshRequestClientPacket());
  }
}
```

**Order matters.** `mapRenderer.resetScene()` first — destroys sprites with `texture: false` (releases references), then `atlas.reset()` destroys the actual `Texture` objects, then `atlas.refresh()` rebuilds atlas data for the current `client.nearby` entries. Next render frame, MapRenderer builds fresh sprites from the rebuilt atlas.

**Cost.** Rebuilds character/NPC/item textures from atlases. ~50-150ms of work for typical nearby sizes. Acceptable for a manual-recovery action; visibilitychange and reconnect paths also run this, but those events are rare and the cost is comparable to the existing reply-driven rebuild.

### Layer B — Expose `MapRenderer.resetScene()`

`src/map.ts` has a private `clearSceneNodes()` (line 324) that destroys all sprites, removes them from containers, and clears the seen-tracking sets. Add a public method that wraps it for external recovery callers:

```ts
/** Resets the scene graph — destroys all sprite pool entries so the next
 *  render frame rebuilds them from current state. Used by client.refresh()
 *  during recovery to drop sprites that reference invalidated textures. */
resetScene() {
  this.clearSceneNodes();
}
```

Place near `buildCaches()` (the existing internal caller of `clearSceneNodes()`).

### Layer C — WebGL context loss handlers

Wire `webglcontextlost` and `webglcontextrestored` events on the PixiJS canvas. On loss: stop the ticker, show the existing reconnect overlay with "Restoring graphics..." text. On restore: hide the overlay (unless the reconnect path is using it), run `client.refresh()` (Layers A+B handle the full atlas+scene rebuild against the restored context), restart the ticker.

In `src/main.ts`, after the existing socket/reconnect logic and the staleness setInterval, add a new section:

```ts
// ── WebGL Context Loss ──────────────────────────────────────────────────
// On most browsers the GPU context can be lost (mobile backgrounded, driver
// hiccup, long idle). The default browser behavior is to NOT restore unless
// we call preventDefault on the lost event. We pause the ticker, show a
// banner, and on restore run a full client.refresh() to rebuild atlases and
// sprite pools against the new context.

const gameCanvas = client.app.renderer.canvas as HTMLCanvasElement;

gameCanvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  console.warn('[recovery] WebGL context lost');
  client.app.ticker.stop();
  const text = reconnectOverlay.querySelector('.reconnect-text');
  if (text) text.textContent = 'Restoring graphics...';
  reconnectOverlay.classList.remove('hidden');
});

gameCanvas.addEventListener('webglcontextrestored', () => {
  console.log('[recovery] WebGL context restored');
  // Only hide the overlay if the network reconnect flow isn't using it.
  if (!client.reconnecting) {
    reconnectOverlay.classList.add('hidden');
  }
  if (!client.app.ticker.started) {
    client.app.ticker.start();
  }
  if (client.state === GameState.InGame) {
    client.refresh();
  }
});
```

**Why the existing overlay (vs. a new one):** The reconnect overlay (`#reconnect-overlay` in index.html) is already a "please wait, recovering" banner with a CSS-styled `.reconnect-text` slot. Reusing it avoids new HTML/CSS work and keeps the visual style consistent. The text changes per-situation.

**Race with network reconnect:** If network is also down, the reconnect-overlay text may briefly flip between "Restoring graphics..." and "Reconnecting...". Acceptable. We never *hide* the overlay during a context-restored event if `client.reconnecting` is true — leaves the network recovery's message visible.

**Order of preventDefault and ticker.stop:** `preventDefault()` first; without it the browser will not restore the context. Then stop the ticker so we don't burn cycles trying to render against a dead context.

**Why call `client.refresh()` on restore (not just ticker.start):** Restored contexts come back with empty GPU state — all textures are gone. `client.refresh()` does the full local atlas reset + scene reset (Layers A and B) so sprites get fresh textures uploaded to the new context.

## Files touched

| File | Change |
|------|--------|
| `src/client.ts` | Add 3 lines to `refresh()` (`mapRenderer.resetScene()` + `atlas.reset()`). |
| `src/map.ts` | Add public `resetScene()` wrapping existing private `clearSceneNodes()`. |
| `src/main.ts` | New `webglcontextlost` / `webglcontextrestored` listeners on `client.app.renderer.canvas`. |

## Testing

No automated tests. Manual reproduction:

### Layer A+B — Local atlas/scene reset
1. Open dev tools. Run: `client.app.ticker.stop(); for (const tex of client.atlas.weaponTextures.values()) tex.destroy(true);` then `client.app.ticker.start();`. Characters should now render with broken/missing weapon textures.
2. Press **R**. Confirm: textures are rebuilt within a fraction of a second, characters look correct. Same recovery without needing the server to reply.
3. Set a breakpoint or temporarily mute the WebSocket so server doesn't reply. Press R. Confirm local atlas state still recovers visibly (sprites destroyed and re-created).

### Layer C — WebGL context loss
4. In dev tools console:
   ```js
   const canvas = document.getElementById('game');
   const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
   const ext = gl.getExtension('WEBGL_lose_context');
   ext.loseContext();
   ```
   Confirm: canvas goes blank, console shows `[recovery] WebGL context lost`, reconnect overlay appears with text "Restoring graphics...", ticker stopped.
5. Restore:
   ```js
   ext.restoreContext();
   ```
   Confirm: console shows `[recovery] WebGL context restored`, overlay disappears, ticker resumes, characters and world re-render correctly within a moment.
6. Repeat the loss/restore cycle several times. Confirm no stuck state, no memory leaks (devtools heap profiling — atlases / textures should be reused, not accumulated).
7. While in the "context lost" state, trigger a network reconnect (e.g., toggle wifi). The reconnect overlay should display "Reconnecting..." text. When network restores, the overlay should stay up if context is still lost; once both recover, overlay hides.

### Regression
8. Press R during normal gameplay (no corruption). Confirm: brief visual hitch (sprites destroyed/rebuilt) is acceptable. Toast still shows. Game continues normally.
9. Return to game tab after backgrounding for a minute. Confirm visibilitychange-triggered `refresh()` does the full reset, world re-renders correctly, no errors in console.
10. Trigger network reconnect. Confirm reconnect → `client.refresh()` does the full reset, world re-renders, no errors.

## Follow-ups (out of scope)

- **MinimapRenderer parallel reset.** If minimap rendering ever exhibits similar issues, expose `MinimapRenderer.resetScene()`. Currently not reported.
- **Context-loss telemetry.** Log to server when context-loss fires so we can correlate with player reports. Currently only `console.warn`.
- **In-context atlas validation.** Periodically check whether key textures are still valid (not destroyed) on the GPU. If not, force a refresh. Belt-and-suspenders; defer until we know whether the active layers are sufficient.
