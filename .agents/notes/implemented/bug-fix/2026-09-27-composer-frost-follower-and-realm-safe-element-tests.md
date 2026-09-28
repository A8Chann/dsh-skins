# Agent Note: The composer frost rides a follower, and skins stop relying on the ambient realm

Status: implemented

## Problem

Two defects with one shared cause: a CSS property used for a look, and a
JavaScript global used as a type test, each doing something the code around it
assumed was innocent.

**The composer frost made the card a containing block (issue #1724).** The
scene neutralizer gave the composer card its frosted input look with
`backdrop-filter: blur(var(--dsh-input-card-blur))` on
`[data-composer-card]`. A non-none `backdrop-filter` (like `transform`,
`filter`, `contain` or `perspective`) makes the element the CONTAINING BLOCK
for its fixed-position descendants, and the official shell renders its tooltips
INSIDE the composer card: the send arrow's bubble is `position: fixed`, so it
resolved its viewport coordinates against the card, landed far outside it but
still inside the conversation scrollport, added its own height to
`scrollHeight`, and every hover clamped the scroll to the new bottom. The
measured shape: composer top 1164 -> 89, `scrollHeight` +1071, 82 jumps in 60
seconds, snapping back when the tooltip unmounted.

**An `instanceof` against the ambient global threw inside an observer.** The
wallpaper controller tested elements with `instanceof HTMLElement` (and
`HTMLVideoElement`, `HTMLIFrameElement`). Those bindings belong to the app's
realm; the sandboxed wallpaper lane renders into its own, and the reference
threw a bare `ReferenceError` out of a MutationObserver callback rather than
answering `false`. The trigger was another observer (the frost follower's own)
mutating the body next to it; the tests that run the real controller against a
sandboxed lane surfaced it immediately.

## Decision

**The frost is painted by a body-level follower, never by the card.** A new
attribute, `data-dsh-composer-frost`, marks an empty `position: fixed`
element that the runtime mounts on `document.body` while the scene markers are
set and removes when they clear. It carries `backdrop-filter:
blur(var(--dsh-input-card-blur, 10px))` — the same setting, the same strength —
and tracks the composer card's border box through a rAF-coalesced measure that
writes only when the box changed, reusing the shape `shell-rendering.ts`
already uses for the composer height. `z-index: -1` puts it above the skin art
layers and below the shell.

A body-level sibling is not an ancestor of the card, so it can carry the blur
without ever becoming the tooltip's containing block; because nested
`backdrop-filter`s do not compose in Chromium, the card itself must stay
filter-free for the follower's blur to read through its translucent fill. The
neutralizer sheet therefore carries no rule for `[data-composer-card]` at all,
which is the property the new test asserts.

**Element kind is read from the node, and a constructor test comes from the
owning document.** `nodeType === 1` / `tagName === 'IFRAME'` replace the bare
`instanceof` checks, and the one place that genuinely needs a constructor reads
it from `doc.defaultView` (`HTMLVideoElement`), which the video resume path
already did. This is a repository convention, not a sandbox workaround: an
ambient global describes one realm's classes, and code that reaches for it
across documents throws instead of answering.

## Alternatives considered

- **Keep the blur on the card and move the shell's tooltip out of it.** Rejected:
  that is the official shell's markup, and this repository never edits a DSH
  checkout. The skin center has to be correct against the shell as shipped.
- **A pseudo-element of the card (`::before` / `::after`).** Rejected: a child
  box's `backdrop-filter` does not affect the element's own containing block, so
  it would technically work — but both pseudo-elements are already painted by
  shipped skins (astral-choir, ember-fall, hive-maw, ice-princess, maid-atelier,
  miku, observatory, phoebe-atelier, verdandi and others declare `content`), and a
  runtime rule cannot claim either one without orphaning that decoration. There is
  no third pseudo-element.
- **`[data-composer-seat]::before`.** Rejected: the neutralizer already
  suppresses it, skins own it, and its box is the whole seat — wider and taller
  than the card — so the blurred area would visibly change.
- **A child element inside the card.** Rejected: it breaks the shell's own
  `[data-composer-card] > :last-child` chains that skins rely on
  (`dsh-web-all`'s frame rule, pixel-anime's patches), and a child inside the
  scrollport is the failure mode itself.
- **Blur the wallpaper instead of the card area.** Rejected: the setting is
  documented as "blurs only the area behind the input card", and the wallpaper
  already has its own independent blur control.
- **Silence the `instanceof` failure with a try/catch.** Rejected: it would
  leave the wrong question in place (`instanceof` still cannot answer about
  another realm's element) and turn a loud bug into a silent one.

## Consequences

- No skin-center visual can jolt the conversation: the composer card is never a
  containing block for the shell's fixed popups, and the frost keeps its
  strength, its shape (the card's own `border-radius` is copied onto the
  follower) and its gate (backdrop active AND conversation has rows).
- A hover on the composer now costs one extra composited layer behind the card
  while a scene is active. The follower is removed with the scene, so the stock
  look and the no-background case pay nothing.
- The follower is an empty, `pointer-events: none`, `aria-hidden` element
  outside the scrollport, so it can never take a tap or add to scroll height.
- Element-kind tests in the wallpaper controller no longer depend on which realm
  a node came from, so the sandboxed wallpaper lane stops throwing out of its
  observer callbacks.

## Testing

- `tests/backdrop-scene.spec.ts`: the follower exists only under the marker
  pair, is empty/inert/body-level and outside the scrollport, is sized to the
  card's border box with the card's radius, and its removal leaves nothing
  behind; the injected sheet carries no `[data-composer-card]` rule while still
  asserting the frost rule itself.
- `tests/wallpaper.spec.ts` asserts the neutralizer serves the follower
  selector instead of the card one, next to the existing marker/teardown
  coverage.
- Fail-before evidence: restoring the pre-fix `backdrop-scene.ts` fails three
  of the six `backdrop-scene.spec.ts` cases ("expected ... not to contain
  '[data-composer-card]'", follower absent, follower unsized).

## Coverage gaps

- The jolt itself (real hover, real compositor) is not reproducible in this
  environment; the fix is proven against the generated CSS and the DOM the
  runtime produces, not against a browser recording.
- Chromium's own delivery batching differs from jsdom's, so the follower's
  measure cadence is reasoned from the shell-rendering.ts shape rather than
  measured on a live page.
- Catalog skins that blur the card THEMSELVES (maid-atelier's composer patches,
  phoebe-atelier's hero card) are untouched: that is a shipped-asset look
  decision, not a runtime rule, and it is recorded here so a future report can
  be answered from this note.
