import { Button, Disclosure, cn } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * bravais's `CollapsibleSection`, rebuilt on HeroUI's `Disclosure`.
 *
 * Four call sites in this module use it (ArgumentFieldsRenderer, PluginConfigField,
 * ConnectorLayoutEditor, IfStatementEditor) and only ever pass this subset of
 * bravais's 22 props, so the surface below is exactly that subset — `title`,
 * expansion (controlled or not), an optional delete action, `noSpacing`, and the
 * two classNames. Everything else bravais accepted was unused here and is gone.
 *
 * Three deliberate differences from bravais, all visible:
 *
 *   1. **The chevron and the delete button swap places.** bravais rendered the
 *      chevron as a *second* trigger button after the actions row; HeroUI requires
 *      `Disclosure.Indicator` inside `Disclosure.Trigger` (it is what carries
 *      `data-expanded`, and a second `slot="trigger"` button would fight RAC's own
 *      aria wiring). So the order is title → chevron → delete rather than
 *      title → delete → chevron, and the chevron is no longer separately clickable
 *      — the whole title row is the trigger, which it already was.
 *   2. **The panel animates.** bravais set `height: auto | 0` with
 *      `transition: none`, so it snapped. `.disclosure__content` animates height and
 *      opacity over 200ms, and honours `prefers-reduced-motion`.
 *   3. **No `title` attribute on the delete button.** HeroUI's `ButtonProps` is
 *      closed and declares none (spec §5b note 8). `aria-label` carries the same
 *      string, so the accessible name is unchanged; only the native tooltip is lost.
 *
 * The delete button's reveal is bravais's, faithfully: `opacity-0` plus
 * `pointer-events-none`, lifted only by `:focus-within` on the header — bravais had
 * no hover rule, so this stays keyboard-first rather than quietly gaining one.
 */
interface CollapsibleSectionProps {
    title: string;
    children: ReactNode;
    /** Uncontrolled initial state. Ignored when `expanded` is supplied. */
    defaultExpanded?: boolean;
    /** Controlled expansion. */
    expanded?: boolean;
    onExpandedChange?: (next: boolean) => void;
    onDelete?: () => void;
    deleteActionLabel?: string;
    /** Drops the `mb-6` bravais applied below every section by default. */
    noSpacing?: boolean;
    /**
     * The dense variant `ArgumentFieldsRenderer.css` used to reach in and produce
     * for `.canvas-argument-list-item`: a 24px header row and an 11px title.
     */
    isCompact?: boolean;
    className?: string;
    bodyClassName?: string;
};

const CollapsibleSection = ({
    title,
    children,
    defaultExpanded = false,
    expanded,
    onExpandedChange,
    onDelete,
    deleteActionLabel = 'Delete section',
    noSpacing = false,
    isCompact = false,
    className,
    bodyClassName
}: CollapsibleSectionProps) => {
    return (
        <Disclosure
            isExpanded={expanded}
            defaultExpanded={defaultExpanded}
            onExpandedChange={onExpandedChange}
            className={cn('flex flex-col', noSpacing ? null : 'mb-6', className)}
        >
            <Disclosure.Heading
                className={cn(
                    'group m-0 flex flex-row items-center justify-between gap-2',
                    isCompact ? 'py-0.5' : 'p-2'
                )}
            >
                <Disclosure.Trigger
                    className={cn(
                        'flex min-w-0 flex-1 select-none flex-row items-center gap-2 border-none bg-transparent text-left',
                        isCompact ? 'min-h-6 p-0' : 'min-h-11 py-1'
                    )}
                >
                    <span
                        className={cn(
                            'min-w-0 flex-1 text-foreground',
                            isCompact ? 'text-[0.7rem] font-normal' : 'text-[0.8125rem] font-[550]'
                        )}
                    >
                        {title}
                    </span>

                    <Disclosure.Indicator className={cn('shrink-0 text-muted', isCompact ? 'size-4' : 'size-5')} />
                </Disclosure.Trigger>

                {onDelete && (
                    <Button
                        isIconOnly
                        size='sm'
                        variant='ghost'
                        aria-label={deleteActionLabel}
                        onPress={onDelete}
                        className={cn(
                            'shrink-0 opacity-0 pointer-events-none transition-opacity duration-150 ease-out-fluid hover:text-danger group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
                            isCompact ? 'size-6 min-h-6 min-w-6 p-1' : null
                        )}
                    >
                        <Trash2 size={isCompact ? 12 : 16} aria-hidden='true' />
                    </Button>
                )}
            </Disclosure.Heading>

            <Disclosure.Content>
                <div className={cn('flex flex-col pl-2', bodyClassName)}>
                    {children}
                </div>
            </Disclosure.Content>
        </Disclosure>
    );
};

export default CollapsibleSection;
