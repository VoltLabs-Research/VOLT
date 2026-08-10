import { DrawerBackdrop, ModalBackdrop } from '@heroui/react';
import { CenteredModalSurface, EdgeModalSurface } from '@/shared/ui/modal/modal-surface';
import { getInitialFocusTarget } from '@/shared/ui/modal/initial-focus';
import { closeModal, openModal, useIsModalOpen } from '@/shared/ui/modal/use-modal-store';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

/**
 * VOLT's modal.
 *
 * A drop-in replacement for bravais's `Modal`: the prop names, defaults and
 * observable behaviour are the same, so a call site changes its import path and
 * nothing else. What changed underneath is total.
 *
 * ── opening is now React state, not the DOM ─────────────────────────────────
 *
 * bravais rendered a native `<dialog>` and opened it with the Invoker Commands
 * API: the trigger carried `command='show-modal' commandfor={id}` and the browser
 * (or `invokers-polyfill`) performed the open, entirely outside React. A
 * `MutationObserver` on the `open` attribute was the source of truth. HeroUI's
 * modal is a React portal driven by `isOpen`/`onOpenChange`, so the store in
 * `use-modal-store` is the source of truth instead and `openModal(id)` is still
 * callable from anywhere, including non-React modules.
 *
 * Two consequences worth knowing at a call site:
 *
 *   1. **`trigger` no longer gets invoker attributes.** They would do nothing —
 *      there is no `<dialog>` for `commandfor` to name. The clone injects
 *      `onClick={() => openModal(id)}` instead. Every trigger in this app is a
 *      plain DOM `<button>` (or a bravais Button that forwarded `onClick` to one),
 *      so `onClick` is the right hook; a HeroUI `Button` would need `onPress`, and
 *      a trigger built from one should call `openModal(id)` itself rather than rely
 *      on this clone.
 *   2. **An unknown id no longer fails silently in the same way.** bravais's
 *      `openModal` was a no-op when no `<dialog>` with that id existed — a typo, or
 *      a call made before the modal mounted, simply did nothing. The id is now
 *      recorded in the store regardless, so a mistyped id stays open forever with
 *      nothing rendering it, and a modal mounted *after* the call opens the moment
 *      it mounts. Nothing throws in either case, by design.
 *
 * ── what the browser used to do for free, and now does not ──────────────────
 *
 * `showModal()` gave a `<dialog>` the top layer, Escape handling, focus trapping
 * and an `::backdrop`. React Aria supplies all four for the portal, but two pieces
 * are still hand-rolled below because bravais's versions were deliberate and are
 * relied upon: the ordered initial-focus preference (see `initial-focus.ts`) and
 * focus restoration with `{ preventScroll: true }`. The top layer itself is
 * replaced by the portal bridge in `top-layer.tsx`, which is the single most
 * load-bearing piece of this directory — read its header before changing anything
 * about where the dialog sits in the DOM.
 */
interface ModalProps {
    /**
     * REQUIRED, and still the only handle: `openModal`/`closeModal`/`resetModal`
     * key off it, and it derives `${id}-title` / `${id}-description`. It is also
     * written on the dialog element so the trigger's `aria-controls` resolves.
     */
    id: string;
    /**
     * Cloned, not wrapped, exactly as before — and a non-element trigger (a string,
     * a number, a fragment, an array) still renders nothing at all rather than
     * rendering itself. The clone overwrites any `type`, `onClick`,
     * `aria-controls` or `aria-haspopup` the child already had.
     */
    trigger?: ReactNode;
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    /** Appended to the dialog element, last, so a caller class still wins. */
    className?: string;
    /**
     * Sets **max-width, not width** — the dialog is already full-width within its
     * container. When undefined no `style` attribute is emitted and HeroUI's own
     * size applies (`max-w-md`, 448px, against bravais's 500px).
     */
    width?: string;
    /**
     * Fires on every close path: Escape, an interaction outside the dialog, the
     * close button, and a programmatic `closeModal(id)` from anywhere. It receives
     * no event and cannot cancel. It does **not** fire if the component unmounts
     * while open, matching bravais, whose native `close` event never fired either.
     */
    onClose?: () => void;
    /**
     * Gates all three dismissal affordances together, as before: Escape, the
     * outside interaction, and the close button.
     */
    dismissible?: boolean;
    /**
     * Accepted for call-site compatibility, and now inert. React Aria returns
     * `null` from the overlay whenever it is closed, so **every** modal is lazily
     * mounted and there is no longer a mode in which it is not.
     *
     * The consequence is worth knowing: with bravais, `lazyMount={false}` (the
     * default) kept the contents mounted inside a hidden `<dialog>`, so component
     * state survived a close/re-open. It no longer does — the tree is gone. Nothing
     * in this app depended on that state surviving; the three `resetModal` call
     * sites exist precisely because it *did* survive, and they are now redundant
     * rather than wrong.
     */
    lazyMount?: boolean;
    /**
     * `center` is HeroUI's `Modal*` family; `right` and `bottom` are its `Drawer*`
     * family. See `modal-surface.tsx` for why the placement selects a component
     * family rather than a class.
     */
    placement?: 'center' | 'right' | 'bottom';
}

const COARSE_POINTER_MEDIA_QUERY = '(pointer: coarse)';

/**
 * The dialog element, for the hand-rolled focus work. HeroUI's `ModalDialog` and
 * `DrawerDialog` are plain function components whose prop types do not include a
 * `ref` (they are `DialogProps`, and RAC attaches the ref at its own declaration
 * site), so the element is reached from the backdrop — which *does* accept a ref —
 * through the `data-slot` attributes HeroUI sets on every part for exactly this.
 */
const DIALOG_SELECTOR = '[data-slot="modal-dialog"], [data-slot="drawer-dialog"]';

/**
 * `blur` rather than HeroUI's `opaque` default. bravais's `::backdrop` was
 * `color-mix(in srgb, var(--color-overlay) 72%, transparent)` plus `blur(4px)`, and
 * the blur is a recognisable part of how a VOLT modal reads against the dashboard
 * behind it. HeroUI's blur is 12px against bravais's 4px, which is the only
 * difference. Shared by both families — `modalVariants` and `drawerVariants` each
 * declare the same three backdrop variants.
 */
const BACKDROP_VARIANT = 'blur';

/**
 * Everything the modal *paints*, gathered into one value so the exit hold below
 * has a single thing to freeze.
 *
 * `id` and `onClose` are deliberately absent: `id` keys the store subscription and
 * must always be live, and `onClose` is behaviour rather than paint — its timing is
 * a contract that `use-confirm.ts` resolves a promise off, and holding it would
 * change when that promise settles.
 */
interface ModalPresentation {
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
    width?: string;
    dismissible: boolean;
    placement: 'center' | 'right' | 'bottom';
}

export const Modal = ({
    id,
    trigger,
    title,
    description,
    children,
    footer,
    className,
    width,
    onClose,
    dismissible = true,
    placement = 'center'
}: ModalProps) => {
    const isOpen = useIsModalOpen(id);
    const isCoarsePointer = useMedia(COARSE_POINTER_MEDIA_QUERY);
    const [backdropElement, setBackdropElement] = useState<HTMLDivElement | null>(null);
    const restoreFocusElementRef = useRef<HTMLElement | null>(null);
    const wasOpenRef = useRef(isOpen);

    const livePresentation: ModalPresentation = {
        title,
        description,
        children,
        footer,
        className,
        width,
        dismissible,
        placement
    };
    const heldPresentationRef = useRef(livePresentation);

    /*
     * THE EXIT HOLD. Do not remove this because it looks like an indirection.
     *
     * React Aria keeps rendering the overlay after it closes —
     * `if (!state.isOpen && !isExiting || isSSR) return null` — so the dialog stays
     * mounted for the whole `duration-100 fade-out-0 zoom-out-95` exit. `onClose`
     * fires on the store's open→closed edge, which is the *start* of that exit, and
     * roughly 25 owners clear their content in `onClose`. The result was a visible
     * defect: ConfirmActionModal's `onClose` does `setModalState(null)`, so `title`
     * and `description` went undefined one render into the fade, the header and
     * close button unmounted, and the dialog collapsed by the header's height while
     * still fading. bravais had no exit animation, so this never had anywhere to
     * show.
     *
     * The fix is not to delay `onClose` — call sites depend on it firing promptly
     * and `use-confirm.ts` resolves a promise off it. Instead the modal paints what
     * it last painted while open for as long as it is closed, so the fade shows the
     * dialog the user was actually looking at.
     *
     * Three properties make this safe:
     *
     *   • **The hold is keyed on `isOpen`, not on a timer.** The moment the modal is
     *     open again the live props win, so open→close→open faster than the exit
     *     cannot strand stale content — a reopen simply stops consulting the hold.
     *     There is nothing to cancel. This is the same signal React Aria's own
     *     `useExitAnimation` interrupts on (`case 'exiting': if (isOpen)
     *     setExitState('open')`), both in the render phase, so the hold and the
     *     animation state cannot end up disagreeing about which frame is which.
     *   • **It is one ref slot on one component instance, overwritten in place.** No
     *     map, nothing keyed by id, nothing that can grow.
     *   • **It is a layout effect, not a render-time write.** By the time this runs
     *     for the last open commit, the props are still the open ones — an owner
     *     that clears state in `onClose` does so in a *passive* effect, which is
     *     strictly later. So the captured value is always the content as it was
     *     rendered, even when a call site closes and clears in the same handler.
     *
     * No dependency array: the held content has to track edits made while the modal
     * is open (a title that updates live), and `children` is a fresh ReactNode on
     * every render anyway, so any dep list would be equivalent to none.
     */
    useLayoutEffect(() => {
        if (isOpen) {
            heldPresentationRef.current = livePresentation;
        }
    });

    /*
     * Capture what had focus before the overlay mounts.
     *
     * This is a layout effect rather than an ordinary one because of commit
     * ordering: React Aria's `useDialog` moves focus to the dialog from a *passive*
     * effect, and every passive effect in a commit runs after every layout effect.
     * By the time a `useEffect` here ran, `document.activeElement` would already be
     * the dialog and we would "restore" focus into a subtree that is about to
     * unmount. (React Aria's own `FocusScope` sidesteps this by reading
     * `document.activeElement` in a `useRef` initialiser during render.)
     */
    useLayoutEffect(() => {
        if (!isOpen) {
            return;
        }

        if (!restoreFocusElementRef.current && document.activeElement instanceof HTMLElement) {
            restoreFocusElementRef.current = document.activeElement;
        }
    }, [isOpen]);

    /*
     * The single close path. Both `onClose` and focus restoration hang off the
     * open→closed edge of the *store*, not off any one interaction, which is what
     * makes them fire identically for Escape, an outside press, the close button
     * and a programmatic `closeModal(id)` from code that has never heard of this
     * component.
     *
     * `onClose` is in the dependency list so the effect always sees the current
     * closure; the edge guard means a re-run caused only by a new `onClose`
     * identity does nothing.
     *
     * Focus is restored with `{ preventScroll: true }` and only when the element is
     * still `isConnected` — a modal opened from a row that has since been deleted
     * must not throw or scroll the page. React Aria restores focus too, but only
     * when focus was lost to `<body>`; restoring here first makes that a no-op and
     * keeps the behaviour readable in one place.
     */
    useEffect(() => {
        if (wasOpenRef.current === isOpen) {
            return;
        }

        wasOpenRef.current = isOpen;

        if (isOpen) {
            return;
        }

        onClose?.();

        const restoreFocusElement = restoreFocusElementRef.current;
        restoreFocusElementRef.current = null;

        if (restoreFocusElement?.isConnected) {
            restoreFocusElement.focus({ preventScroll: true });
        }
    }, [isOpen, onClose]);

    /*
     * Initial focus, one frame after open so the portal has laid out and React
     * Aria's own dialog focus has already happened — this deliberately runs last
     * and wins. The frame is cancelled on cleanup and the dialog is re-checked for
     * `isConnected`, because a modal can be closed again within that frame.
     */
    useEffect(() => {
        if (!isOpen || !backdropElement) {
            return;
        }

        const dialogElement = backdropElement.querySelector<HTMLElement>(DIALOG_SELECTOR);
        if (!dialogElement) {
            return;
        }

        const focusFrame = window.requestAnimationFrame(() => {
            if (!dialogElement.isConnected) {
                return;
            }

            getInitialFocusTarget(dialogElement, isCoarsePointer).focus({ preventScroll: true });
        });

        return () => window.cancelAnimationFrame(focusFrame);
    }, [isOpen, backdropElement, isCoarsePointer]);

    const handleOpenChange = (nextIsOpen: boolean) => {
        if (nextIsOpen) {
            openModal(id);
            return;
        }

        closeModal(id);
    };

    /*
     * From here down the render reads `painted*` rather than the props directly.
     * While the modal is open those are the props; while it is closed they are the
     * hold above, which is what keeps the exit animation showing the dialog the user
     * closed. Every value that reaches the DOM goes through this, not just the four
     * that produced the observed collapse: one rule ("closed paints what open last
     * painted") is easier to keep true than a list of exceptions, and the same defect
     * is latent in the others — a `dismissible` derived from state, for instance,
     * would otherwise pop the close button in or out mid-fade, and a `placement`
     * change would swap component families and cut the animation off entirely.
     */
    const {
        title: paintedTitle,
        description: paintedDescription,
        children: paintedChildren,
        footer: paintedFooter,
        className: paintedClassName,
        width: paintedWidth,
        dismissible: paintedDismissible,
        placement: paintedPlacement
    } = isOpen ? livePresentation : heldPresentationRef.current;

    /*
     * Derived from the painted title/description rather than the live props, so
     * `aria-labelledby` cannot go undefined while the heading it names is still on
     * screen fading out.
     */
    const titleId = paintedTitle ? `${id}-title` : undefined;
    const descriptionId = paintedDescription ? `${id}-description` : undefined;

    /*
     * `style` is omitted entirely when there is no `width`, so HeroUI's own size
     * variant applies. When there is one, `touchAction` is restated for the edge
     * placements: `DrawerDialog` sets `style={{ touchAction: 'none' }}` for its
     * drag-to-dismiss gesture and applies caller props *after* it, so a bare
     * `{ maxWidth }` would silently delete it.
     */
    const dialogStyle: CSSProperties | undefined = paintedWidth
        ? {
            maxWidth: paintedWidth,
            touchAction: paintedPlacement === 'center' || !paintedDismissible ? undefined : 'none'
        }
        : undefined;

    const surfaceProps = {
        dialogId: id,
        titleId,
        descriptionId,
        title: paintedTitle,
        description: paintedDescription,
        footer: paintedFooter,
        className: paintedClassName,
        dialogStyle,
        dismissible: paintedDismissible,
        children: paintedChildren
    };

    const triggerElement = trigger && isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(trigger)
        ? cloneElement(trigger, {
            onClick: () => openModal(id),
            'aria-controls': id,
            'aria-haspopup': 'dialog',
            type: 'button'
        })
        : null;

    /*
     * `isDismissable` gates the outside interaction and `isKeyboardDismissDisabled`
     * gates Escape — two props where bravais had one `dismissible`, because
     * bravais blocked Escape by calling `preventDefault()` on the native dialog's
     * `cancel` event rather than through a flag. The backdrop is also where
     * `isOpen`/`onOpenChange` belong: React Aria warns if they are placed on the
     * inner container instead.
     */
    const backdropProps = {
        ref: setBackdropElement,
        variant: BACKDROP_VARIANT,
        isOpen,
        onOpenChange: handleOpenChange,
        isDismissable: paintedDismissible,
        isKeyboardDismissDisabled: !paintedDismissible
        // `as const` keeps `variant` as the literal `'blur'`; in a bare object
        // literal it would widen to `string` and stop matching the variant union.
    } as const;

    if (paintedPlacement === 'center') {
        return (
            <>
                {triggerElement}

                <ModalBackdrop {...backdropProps}>
                    <CenteredModalSurface {...surfaceProps} />
                </ModalBackdrop>
            </>
        );
    }

    return (
        <>
            {triggerElement}

            <DrawerBackdrop {...backdropProps}>
                <EdgeModalSurface {...surfaceProps} placement={paintedPlacement} />
            </DrawerBackdrop>
        </>
    );
};
