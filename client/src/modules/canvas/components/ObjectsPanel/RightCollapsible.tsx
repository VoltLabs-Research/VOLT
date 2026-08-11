import { cn } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import type { ReactNode } from 'react';

/**
 * bravais's `CollapsibleSection`, rebuilt from its own DOM with utilities.
 *
 * It is not HeroUI's `Disclosure`: the header carries a `headerAction` beside the
 * trigger, and `Disclosure.Heading` wraps its trigger in an `<h3>` — which would put a
 * second interactive control inside a heading. bravais split the row into a title
 * trigger, an actions cluster and a separate chevron button, and every override in
 * `RightPanel.css` and `ObjectsPanel.css` sized those three parts, so the split stays.
 *
 * Two behaviours are preserved rather than tidied:
 *
 *   - the body mounts lazily and then *stays* mounted (`hasBeenExpanded`), so a collapsed
 *     analysis tree keeps its loaded exposures and its scroll position;
 *   - `icon` is accepted and never rendered. bravais's compiled component did not
 *     destructure `icon` at all, so the `<Layers />` every call site passes has never
 *     appeared. Removing the prop would be a larger change than leaving it inert.
 *
 * The `:focus-visible` box-shadow rings are dropped rather than translated: `index.css`
 * rings every plain button with `outline: 2px solid var(--focus)`.
 */

/*
 * The compact sizes are ancestor-flag variants rather than a prop, because that is what
 * they were: `.canvas-objects-panel--analysis-compact .canvas-right-dropdown-header`, and
 * so on. Every collapsible inside a compact panel shrinks — including the artifact
 * sections, which are several components below `ObjectsPanel` — with nothing threaded
 * through. The variant also wins over the `max-md:` heights on specificity, exactly as the
 * unlayered rule did (spec §5b.3).
 */

/** `.canvas-right-dropdown-header`, with the mobile and compact heights folded in. */
const HEADER_CLASS = 'flex h-[39px] flex-row items-center justify-between gap-2 px-3 max-md:h-auto max-md:min-h-[34px] [.canvas-objects-panel--analysis-compact_&]:h-[30px] [.canvas-objects-panel--analysis-compact_&]:min-h-[30px] [.canvas-objects-panel--analysis-compact_&]:px-2';

/** `.collapsible-section-heading` */
const HEADING_CLASS = 'm-0 min-w-0 flex-1';

/** `.collapsible-section-header-row` / `-title-row`, at the heights the panel imposed. */
const ROW_CLASS = 'flex min-h-8 w-full min-w-0 flex-row items-center gap-2 max-md:min-h-[34px] [.canvas-objects-panel--analysis-compact_&]:min-h-7';

/** `.collapsible-section-trigger` */
const TRIGGER_CLASS = 'mr-1 flex min-h-8 min-w-0 flex-1 cursor-pointer flex-row items-center gap-2 border-none bg-transparent p-0 text-left select-none max-md:min-h-[34px] [.canvas-objects-panel--analysis-compact_&]:min-h-7';

/** `.canvas-right-dropdown-title` */
const TITLE_CLASS = 'min-w-0 flex-1 truncate text-xs text-muted [.canvas-objects-panel--analysis-compact_&]:text-[0.6875rem]';

/** `.collapsible-section-actions` */
const ACTIONS_CLASS = 'flex shrink-0 flex-row items-center gap-0.5';

/** `.collapsible-section-chevron-trigger` */
const CHEVRON_CLASS = 'flex size-[1.625rem] shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-0 text-muted hover:bg-surface-hover focus-visible:bg-surface-hover [.canvas-objects-panel--analysis-compact_&]:size-[1.375rem]';

/**
 * `.collapsible-section-body` plus `.canvas-right-dropdown-body .canvas-tree-container`
 * and its compact override. The tree container belongs to `ArtifactTreeSection` and
 * `SceneCollection`, so that padding stays a descendant rule — a variant here, which is
 * what keeps it above the base utilities those components carry (spec §5b.3).
 */
const BODY_CLASS = 'overflow-hidden pl-2 [&_.canvas-tree-container]:px-0 [&_.canvas-tree-container]:pb-2.5 [&_.canvas-tree-container]:pt-1.5';

const BODY_STATIC_CLASS = 'overflow-visible';

export const PANEL_ICON_STYLE = {
    width: 13,
    height: 13,
    color: 'var(--color-text-secondary)'
} as const;

interface RightCollapsibleProps {
    title: string;
    /** Accepted for call-site compatibility and never rendered — see the note above. */
    icon?: ReactNode;
    expanded: boolean;
    onExpandedChange?: (next: boolean) => void;
    headerAction?: ReactNode;
    children: ReactNode;
    extraClassName?: string;
    collapsible?: boolean;
    tourId?: string;
}

const RightCollapsible = ({
    title,
    expanded,
    onExpandedChange,
    headerAction,
    children,
    extraClassName,
    collapsible = true,
    tourId
}: RightCollapsibleProps) => {
    const reactId = useId();
    const bodyId = `collapsible-section-body-${reactId}`;
    const headingId = `collapsible-section-heading-${reactId}`;
    const triggerId = `collapsible-section-trigger-${reactId}`;
    const [hasBeenExpanded, setHasBeenExpanded] = useState(expanded);

    useEffect(() => {
        if (expanded && !hasBeenExpanded) {
            setHasBeenExpanded(true);
        }
    }, [expanded, hasBeenExpanded]);

    const toggle = () => {
        if (!collapsible) return;
        onExpandedChange?.(!expanded);
    };

    const titleNode = <span className={TITLE_CLASS}>{title}</span>;
    const actionsNode = <span className={ACTIONS_CLASS}>{headerAction}</span>;

    return (
        <div data-tour-id={tourId}>
            <div className={cn('flex flex-col', extraClassName)}>
                <div className={HEADER_CLASS}>
                    <h3 id={headingId} className={HEADING_CLASS}>
                        <span className={ROW_CLASS}>
                            {collapsible ? (
                                <>
                                    <button
                                        id={triggerId}
                                        type='button'
                                        className={TRIGGER_CLASS}
                                        onClick={toggle}
                                        aria-expanded={expanded}
                                        aria-controls={bodyId}
                                    >
                                        {titleNode}
                                    </button>
                                    {actionsNode}
                                    <button
                                        type='button'
                                        className={CHEVRON_CLASS}
                                        onClick={toggle}
                                        aria-expanded={expanded}
                                        aria-controls={bodyId}
                                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
                                    >
                                        <ChevronDown
                                            size={13}
                                            aria-hidden='true'
                                            className={expanded ? undefined : '-rotate-90'}
                                        />
                                    </button>
                                </>
                            ) : (
                                <>
                                    {titleNode}
                                    {actionsNode}
                                </>
                            )}
                        </span>
                    </h3>
                </div>

                <div
                    id={bodyId}
                    className={cn(
                        BODY_CLASS,
                        !collapsible && BODY_STATIC_CLASS,
                        collapsible && !expanded && 'h-0'
                    )}
                    role='region'
                    aria-labelledby={collapsible ? triggerId : headingId}
                >
                    <div className='flex flex-col'>
                        {collapsible ? (hasBeenExpanded ? children : null) : children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RightCollapsible;
