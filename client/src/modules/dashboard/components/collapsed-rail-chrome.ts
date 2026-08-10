/**
 * The collapsed rail's reach into `shared/ui`.
 *
 * `DashboardSidebar.css` was the worst cross-module sheet in the app: its
 * collapsed cascade restyled `.sidebar-nav-item`, `.sidebar-nav-icon`,
 * `.sidebar-nav-label`, `.sidebar-section-chevron` and `.sidebar-sub-items`, all
 * of which are owned by `shared/ui/components/SidebarNavItem` and
 * `.../SidebarExpandableSection`. Those five class names now carry no styling of
 * their own — they stayed on the DOM purely as markers for this sheet.
 *
 * That mattered because of *layers*. While the sheet was plain unlayered CSS it
 * outranked Tailwind's `utilities` layer, so `.dashboard-sidebar.is-collapsed
 * .sidebar-nav-item { justify-content: center }` beat the base `justify-start` the
 * shared component carries. Convert it to a bare `justify-center` and it silently
 * loses. So every rule below is re-expressed as an ANCESTOR-FLAG / DESCENDANT
 * variant (spec §5b.3), which lands in the same layer at a higher specificity and
 * therefore still wins.
 *
 * ── the two width regimes ────────────────────────────────────────────────────
 *
 * The sheet had a `@media screen and (max-width: 1024px)` block that turns the
 * rail back into a 280px overlay drawer and *partially* undoes the collapsed
 * state. Partially is the operative word: padding and label/chevron/sub-item
 * visibility are restored, but the shrunken icon size and the footer's centring
 * are NOT. Reproducing "mostly reverted" is why the flag cannot simply be dropped
 * below 1024px.
 *
 * Rather than layer a `max-[1024px]:` override on top of an unprefixed collapsed
 * utility — which would leave the winner up to Tailwind's variant sort order for
 * two candidates of equal specificity — the two regimes are written as DISJOINT
 * media queries:
 *
 *   `min-[1024.05px]:`  the rail is genuinely a 64px strip
 *   `max-[1024px]:`     the rail is the 280px drawer
 *
 * Nothing overrides anything, so nothing depends on emission order. The 0.05px
 * offset is the same trick Tailwind uses for its own `max-*` breakpoints.
 *
 * Rules with no `min-`/`max-` prefix are the ones the sheet deliberately left
 * un-reverted at every width.
 */

/** `.sidebar-nav` — the scrolling item list. */
export const RAIL_NAV = 'flex-1 overflow-x-hidden overflow-y-auto px-3 py-2';

/**
 * `.dashboard-sidebar.is-collapsed` → `.sidebar-nav` and the three shared-component
 * classes underneath it.
 *
 * Two details that are easy to get wrong and are called out in the sheet's history:
 *
 *   • the label is hidden with `sr-only`, NOT `hidden`. It is the nav button's only
 *     accessible name, and `display: none` would strip the name outright, leaving a
 *     rail of unlabelled icon buttons (spec §5b.6).
 *   • the icon shrinks with a `text-*` utility, NOT a `size-*` one. The sheet
 *     re-declared `font-size`, which works only because `SidebarNavItem` sizes the
 *     glyph in `em` (`size-[1em]`). A `size-5` here would change the box and leave
 *     the glyph at its old size.
 */
export const RAIL_NAV_COLLAPSED = 'min-[1024.05px]:p-2 [&_.sidebar-nav-icon]:text-lg min-[1024.05px]:[&_.sidebar-nav-item]:justify-center min-[1024.05px]:[&_.sidebar-nav-item]:p-2 max-[1024px]:[&_.sidebar-nav-item]:px-3 max-[1024px]:[&_.sidebar-nav-item]:py-2 min-[1024.05px]:[&_.sidebar-nav-label]:sr-only min-[1024.05px]:[&_.sidebar-section-chevron]:hidden min-[1024.05px]:[&_.sidebar-sub-items]:hidden';

/** `.sidebar-footer-nav`. */
export const RAIL_FOOTER_NAV = 'mb-3';

/**
 * The collapsed footer nav.
 *
 * `justify-center` is deliberately unprefixed. The sheet's footer-scoped rule
 * (`.dashboard-sidebar.is-collapsed .sidebar-footer-nav .sidebar-nav-item`) is one
 * class more specific than the 1024px block's `justify-content: flex-start`, so
 * footer items stayed centred even in the wide drawer. That is the existing
 * behaviour, quirk and all.
 *
 * `.sidebar-footer-nav .sidebar-nav-item { margin-bottom: 0 }` is NOT ported: the
 * shared component no longer sets a bottom margin, so the rule has nothing left to
 * cancel (spec §5b.4).
 */
export const RAIL_FOOTER_NAV_COLLAPSED = 'w-full mb-2 [&_.sidebar-nav-icon]:text-lg [&_.sidebar-nav-item]:justify-center min-[1024.05px]:[&_.sidebar-nav-item]:p-2 max-[1024px]:[&_.sidebar-nav-item]:px-3 max-[1024px]:[&_.sidebar-nav-item]:py-2 min-[1024.05px]:[&_.sidebar-nav-label]:sr-only';

/**
 * The tooltip wrapper around a rail row.
 *
 * `.sidebar-nav-item-wrapper { width: 100% }` used to be a plain div; HeroUI's
 * `Tooltip.Trigger` is that div now. Two props are passed alongside this class at
 * every call site and both are deliberate:
 *
 *   • `tabIndex={-1}` — `Tooltip.Trigger` makes itself focusable, which would add a
 *     second tab stop in front of every one of the rail's buttons. bravais cloned a
 *     plain, non-focusable div, so its sidebar tooltips were hover-only; this keeps
 *     the tab order the same length it has always been.
 *   • `role='presentation'` — the trigger defaults to `role='button'`, which would
 *     nest a button role directly around a real `<button>`.
 *
 * The wrapper is used rather than letting the tooltip find the button itself
 * because `SidebarExpandableSection` renders several React Aria buttons (the header
 * plus one per sub-item). With no explicit trigger they would all consume the
 * trigger context, and the tooltip would anchor to the last one — which, in the
 * collapsed rail, is a `display: none` sub-item with a zero-size rect.
 */
export const RAIL_TOOLTIP_TRIGGER = 'w-full';
