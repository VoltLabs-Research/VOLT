import {
    DrawerBody,
    DrawerCloseTrigger,
    DrawerContent,
    DrawerDialog,
    DrawerFooter,
    DrawerHeader,
    DrawerHeading,
    ModalBody,
    ModalCloseTrigger,
    ModalContainer,
    ModalDialog,
    ModalFooter,
    ModalHeader,
    ModalHeading
} from '@heroui/react';
import { ModalTopLayer } from '@/shared/ui/modal/top-layer';
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * The two surfaces a bravais `<Modal>` could be.
 *
 * bravais expressed `placement` purely in CSS: one `<dialog>` whose margins,
 * height, radius and `@starting-style` transform changed per placement. HeroUI has
 * no such switch — a centred dialog is the `Modal*` family and an edge-anchored
 * panel is the `Drawer*` family, and they are genuinely different components (the
 * drawer slides rather than zooms, is full-bleed against its edge, and carries its
 * own drag-to-dismiss gesture). So `placement` selects a family here instead of a
 * class, and the two renderers below are deliberately not folded into one: the
 * part components are not interchangeable and every attempt to parameterise them
 * ends in a cast.
 *
 * Everything a call site can observe — the ids, the aria wiring, the close
 * affordance, the ordering of header/body/footer, the top-layer host — is
 * identical between them.
 *
 * ── one preserved quirk ─────────────────────────────────────────────────────
 *
 * The close trigger renders only when the modal is dismissible **and** has a title
 * or a description. In bravais that coupling was structural — the CloseButton was
 * a flex sibling of the heading, inside the `(title || description)` block — so a
 * dismissible modal with neither rendered no close affordance at all. HeroUI
 * positions its close trigger `absolute end-4 top-4` against the dialog, so there
 * is no longer any reason for the coupling; it is kept anyway because dropping it
 * would silently add an X to the one modal that has no header (the canvas
 * CommandPalette, dismissed with Escape or a click outside, as command palettes
 * are). Un-coupling it is a deliberate design change, not a migration detail.
 */
export interface ModalSurfaceProps {
    /**
     * The modal's `id`, written on the dialog element. bravais put it on the
     * `<dialog>` because `getElementById` was the whole open mechanism; it is kept
     * so the trigger's `aria-controls={id}` resolves to a real element and so any
     * `#id` selector or test hook still finds the dialog.
     */
    dialogId: string;
    /** `${id}-title`, or undefined when there is no title. */
    titleId?: string;
    /** `${id}-description`, or undefined when there is no description. */
    descriptionId?: string;
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    /** Passed through to the dialog element, last, so a caller class still wins. */
    className?: string;
    /** `{ maxWidth }` from the `width` prop, or undefined to emit no style at all. */
    dialogStyle?: CSSProperties;
    dismissible: boolean;
}

/**
 * The title/description group.
 *
 * `gap-1` overrides HeroUI's `gap-3`: 12px reads as two separate blocks, and
 * bravais paired a title with its description at 4px. Tailwind's utilities sit in
 * a later `@layer` than HeroUI's component CSS, so a utility passed as `className`
 * wins without `!important` and without a stylesheet.
 *
 * `pe-8` reserves room for the close trigger, which HeroUI positions
 * `absolute end-4 top-4` against the dialog rather than as a flex sibling of the
 * heading — so without it a long dynamic title (`Move ${itemLabel}`, a team name)
 * runs underneath the X. Both branches are complete literals so Tailwind's scanner
 * can see them.
 */
const HEADER_CLASS_NAME = 'gap-1 pe-8';
const HEADER_CLASS_NAME_WITHOUT_CLOSE = 'gap-1';

/** bravais's `text-md text-secondary`, converted by value (see the migration spec §3). */
const DESCRIPTION_CLASS_NAME = 'text-sm text-muted';

/**
 * bravais's dialog inherited `--color-text-primary`; HeroUI's modal and drawer
 * bodies are `text-muted`, on the assumption that the heading carries the
 * emphasis. Restating the foreground converts bravais's colour by value instead of
 * silently greying out the body of all 30 modals. A call site that wants secondary
 * text still says `text-muted`, as several already do.
 */
const BODY_CLASS_NAME = 'text-foreground';

/** The centred modal — bravais's `placement='center'`, and 26 of the 30 call sites. */
export const CenteredModalSurface = ({
    dialogId,
    titleId,
    descriptionId,
    title,
    description,
    children,
    footer,
    className,
    dialogStyle,
    dismissible
}: ModalSurfaceProps) => {
    const [topLayerRoot, setTopLayerRoot] = useState<HTMLDivElement | null>(null);
    const hasHeader = Boolean(title || description);
    const hasCloseTrigger = dismissible && hasHeader;

    return (
        <ModalContainer>
            <ModalDialog
                id={dialogId}
                className={className}
                style={dialogStyle}
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                <ModalTopLayer root={topLayerRoot}>
                    {hasCloseTrigger && <ModalCloseTrigger aria-label='Close modal' />}

                    {hasHeader && (
                        <ModalHeader className={hasCloseTrigger ? HEADER_CLASS_NAME : HEADER_CLASS_NAME_WITHOUT_CLOSE}>
                            {title && <ModalHeading id={titleId}>{title}</ModalHeading>}
                            {description && (
                                <p id={descriptionId} className={DESCRIPTION_CLASS_NAME}>{description}</p>
                            )}
                        </ModalHeader>
                    )}

                    <ModalBody className={BODY_CLASS_NAME}>{children}</ModalBody>

                    {footer && <ModalFooter>{footer}</ModalFooter>}
                </ModalTopLayer>
            </ModalDialog>

            {/* See top-layer.tsx for why this sits beside the dialog rather than inside it. */}
            <div ref={setTopLayerRoot} className='pointer-events-auto' />
        </ModalContainer>
    );
};

interface EdgeModalSurfaceProps extends ModalSurfaceProps {
    placement: 'right' | 'bottom';
}

/**
 * The edge-anchored drawer — bravais's `placement='right'` (4 dashboard drawers)
 * and `placement='bottom'` (currently unused).
 *
 * HeroUI's drawer reproduces bravais's right drawer closely: full height, square
 * corners, and a real slide-in from the edge (bravais used `@starting-style` with
 * `translateX(100%)`; HeroUI animates `translate` between the same two states).
 * Its resting width is `w-80 sm:w-96` against bravais's `max-width: 460px`, which
 * `width` still overrides.
 */
export const EdgeModalSurface = ({
    dialogId,
    titleId,
    descriptionId,
    title,
    description,
    children,
    footer,
    className,
    dialogStyle,
    dismissible,
    placement
}: EdgeModalSurfaceProps) => {
    const [topLayerRoot, setTopLayerRoot] = useState<HTMLDivElement | null>(null);
    const hasHeader = Boolean(title || description);
    const hasCloseTrigger = dismissible && hasHeader;

    return (
        <DrawerContent placement={placement}>
            <DrawerDialog
                id={dialogId}
                className={className}
                style={dialogStyle}
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                <ModalTopLayer root={topLayerRoot}>
                    {hasCloseTrigger && <DrawerCloseTrigger aria-label='Close modal' />}

                    {hasHeader && (
                        <DrawerHeader className={hasCloseTrigger ? HEADER_CLASS_NAME : HEADER_CLASS_NAME_WITHOUT_CLOSE}>
                            {title && <DrawerHeading id={titleId}>{title}</DrawerHeading>}
                            {description && (
                                <p id={descriptionId} className={DESCRIPTION_CLASS_NAME}>{description}</p>
                            )}
                        </DrawerHeader>
                    )}

                    <DrawerBody className={BODY_CLASS_NAME}>{children}</DrawerBody>

                    {footer && <DrawerFooter>{footer}</DrawerFooter>}
                </ModalTopLayer>
            </DrawerDialog>

            <div ref={setTopLayerRoot} className='pointer-events-auto' />
        </DrawerContent>
    );
};
