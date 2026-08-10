/**
 * `.container-overview-section-title` from the deleted `ContainerOverview.css`.
 *
 * It is passed as `titleClassName` to two `EditableKeyValueCard`s (environment
 * variables and port bindings), which merge it after their own
 * `text-base font-semibold text-foreground` through `cn` — so `text-[0.9375rem]`
 * is what overrides the base size. Kept in one place because both call sites are
 * the same heading in the same column and drifting them apart would be a visible
 * mismatch, and as a complete static literal so Tailwind's scanner sees it.
 *
 * Original: `font-size: .9375rem; font-weight: 600; color: var(--color-text-primary);
 * margin: 0 0 .5rem; letter-spacing: -.01em`.
 */
export const OVERVIEW_SECTION_TITLE_CLASS_NAMES = 'mt-0 mb-2 text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground';
