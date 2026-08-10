import { UNSAFE_PortalProvider } from 'react-aria';
import { createContext, useCallback, useContext } from 'react';
import type { ReactNode } from 'react';

/**
 * The top-layer portal bridge — the replacement for bravais's
 * `TopLayerRootContext` / `FloatingRootContext`.
 *
 * ── the problem it solves ────────────────────────────────────────────────────
 *
 * bravais's Modal was a native `<dialog>` opened with `showModal()`, so it lived
 * in the browser's *top layer*: painted above the entire document regardless of
 * `z-index`. Anything that portalled to `document.body` — a Select's listbox, a
 * Popover, a Tooltip — therefore landed **below** the dialog and was invisible.
 * bravais fixed that by publishing the `<dialog>` element on two contexts, and
 * every floating primitive read it and passed it as its `FloatingPortal root`.
 *
 * HeroUI's modal is *not* in the top layer — it is a React portal into
 * `document.body` (react-aria's `Overlay` → `ReactDOM.createPortal`) — but the
 * problem survives in a different form. `.modal__backdrop` and
 * `.drawer__backdrop` are `fixed inset-0 z-50`, while HeroUI's popover, select,
 * dropdown and tooltip surfaces declare **no z-index at all** (verified across
 * `@heroui/styles/dist/components/*.css`: `z-50` appears only on modal,
 * alert-dialog, drawer and toast). In the root stacking context a positioned
 * element with `z-index: auto` paints in step 8 and one with `z-index: 50` paints
 * in step 9, so the backdrop covers a later sibling regardless of DOM order. A
 * Select opened inside a Modal would render *behind* the modal.
 *
 * ── the mechanism ───────────────────────────────────────────────────────────
 *
 * `UNSAFE_PortalProvider` is react-aria's own answer: `Overlay` and
 * `OverlayContainer` both consult `useUNSAFE_PortalContext().getContainer()`
 * before defaulting to `document.body`, and every HeroUI overlay is built on one
 * of those two. Publishing a container inside the modal therefore redirects
 * *every* nested overlay with no call-site change at all — which is the whole
 * point, given how many Selects and Tooltips live inside modals.
 *
 * `react-aria` is imported here even though it is not in `package.json`: it is a
 * peer dependency of `@heroui/react` (alongside `react-aria-components`), so npm
 * installs exactly one hoisted copy, and both this file and every RAC overlay
 * resolve to the same `private/overlays/PortalProvider` module — the same context
 * object, which is what makes the redirect work at all. It should still be listed
 * explicitly as a direct dependency; nothing else in the app imports it, and a
 * future install that hoists it differently would break silently rather than
 * loudly (two context instances, and every nested overlay quietly back on
 * `document.body`).
 *
 * The container `<Modal>` hands us is an empty `div` rendered as the **last child
 * of `ModalContainer` / `DrawerContent`**, i.e. a sibling of the dialog, not a
 * descendant of it. Every part of that placement is load-bearing:
 *
 *   • inside the `z-50` backdrop, so nested overlays share the modal's stacking
 *     context and win on DOM order rather than losing on z-index;
 *   • *after* the dialog, so they paint above the dialog's own content;
 *   • outside the dialog, because `.modal__dialog--scroll-inside` is
 *     `overflow-clip` — a popover portalled into the dialog would be clipped at
 *     its edge (bravais had this same clipping and simply lived with it);
 *   • inside `ModalContainer`, which is the element react-aria passes to
 *     `ariaHideOutside([modalRef])`. Anything added *outside* that subtree while
 *     the modal is open is walked by react-aria's MutationObserver and marked
 *     `inert`; anything added inside it is skipped, because the observer's own
 *     guard is "is the mutation target contained by a visible node". Portalling
 *     into the container is the only placement that is not racing that observer.
 *   • also inside `ModalContainer`, which is the ref `useOverlay` tests for
 *     outside presses — so clicking an option in a Select counts as *inside* the
 *     modal and cannot dismiss it. A container placed on the backdrop instead
 *     would make every option click an outside press.
 *
 * `ModalContainer` / `DrawerContent` are `pointer-events: none` (the dialog turns
 * them back on for itself), so the host div restates `pointer-events: auto` for
 * its portalled children to inherit.
 *
 * ── what a call site has to do ──────────────────────────────────────────────
 *
 * Nothing, for any overlay from `@heroui/react`. `useModalTopLayerRoot` exists for
 * the exceptions: a surface positioned with `@floating-ui/react` (still a direct
 * dependency; the app's own cursor-tracking and canvas overlays use it) reads this
 * and passes it as `<FloatingPortal root={…}>`, which is exactly the contract
 * bravais's two contexts had. Outside a modal it returns `null`, which every
 * floating-ui portal already treats as "use the body".
 */
const ModalTopLayerContext = createContext<HTMLElement | null>(null);

/**
 * The element a floating surface should portal into so it paints above the
 * enclosing modal, or `null` when there is no enclosing modal.
 */
export const useModalTopLayerRoot = (): HTMLElement | null => {
    return useContext(ModalTopLayerContext);
};

interface ModalTopLayerProps {
    /** The host element rendered beside the dialog; `null` until it mounts. */
    root: HTMLElement | null;
    children: ReactNode;
}

export const ModalTopLayer = ({ root, children }: ModalTopLayerProps) => {
    /*
     * Falls back to `document.body` rather than returning `null`. react-aria reads
     * this as `portalContainer = getContainer()` and then bails with
     * `if (!portalContainer) return null` — so a null return would make a nested
     * overlay render *nothing at all*. `root` is null only for the single commit
     * in which the host div and these children mount together, but an overlay that
     * is open on that first commit would otherwise silently vanish.
     */
    const getContainer = useCallback(() => root ?? document.body, [root]);

    return (
        <ModalTopLayerContext.Provider value={root}>
            <UNSAFE_PortalProvider getContainer={getContainer}>
                {children}
            </UNSAFE_PortalProvider>
        </ModalTopLayerContext.Provider>
    );
};
