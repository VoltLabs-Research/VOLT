import { Chip, Disclosure } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface OptionalConfigSectionProps {
    title: string;
    description: string;
    defaultExpanded?: boolean;
    errorCount?: number;
    children: ReactNode;
}

/**
 * `.create-container-config-card.full-width` from the deleted `CreateContainer.css`:
 * a bordered card spanning the whole configuration grid.
 */
const CARD_CLASS_NAMES = 'col-span-full flex flex-col gap-4 rounded-xl border border-border p-6';

/**
 * `.collapsible-section-trigger` was `min-height: 2.75rem; padding: .25rem 0;
 * flex: 1; text-align: left`, and `.collapsible-section-title` was 0.8125rem — a
 * size that lived only in CSS, so bravais's own `font-semibold text-primary`
 * classes set the weight and colour but not the size.
 */
const TRIGGER_CLASS_NAMES = 'flex w-full min-h-11 flex-1 select-none flex-row items-center justify-between gap-2 py-1 text-left';
const TITLE_CLASS_NAMES = 'text-[0.8125rem] font-semibold text-foreground';

/** Collapsible card for the optional parts of the container configuration step. */
const OptionalConfigSection = ({
    title,
    description,
    defaultExpanded = false,
    errorCount = 0,
    children
}: OptionalConfigSectionProps) => {
    const hasError = errorCount > 0;
    const [isExpanded, setIsExpanded] = useState(defaultExpanded || hasError);
    /*
     * bravais's CollapsibleSection was lazy-mount-once, never-unmount: children
     * rendered only after the first expansion (`hasBeenExpanded ? children : null`)
     * and then stayed mounted behind `height: 0` forever. React Aria's
     * DisclosurePanel already keeps children mounted and only hides them, so only
     * the "not until first expanded" half needs restating — without it these three
     * sections would mount their `EditableKeyValueCard`s on the configuration step's
     * first paint, which they never did.
     */
    const [hasBeenExpanded, setHasBeenExpanded] = useState(defaultExpanded || hasError);
    const expanded = isExpanded || hasError;

    useEffect(() => {
        if (expanded && !hasBeenExpanded) {
            setHasBeenExpanded(true);
        }
    }, [expanded, hasBeenExpanded]);

    return (
        <div className={CARD_CLASS_NAMES}>
            {/*
              * Two deliberate differences from bravais's CollapsibleSection.
              *
              * It rendered TWO toggles for one region — the title button and a separate
              * chevron button, both carrying `aria-expanded` and `aria-controls` for the
              * same body — so AT saw two expand controls for one panel. Disclosure has
              * one trigger, with the indicator inside it.
              *
              * And bravais flipped the body's height between 0 and auto with
              * `transition: none`, while HeroUI's `.disclosure__content` animates height
              * over 200ms. That is a visible behaviour change, not a free upgrade.
              */}
            <Disclosure isExpanded={expanded} onExpandedChange={setIsExpanded}>
                <Disclosure.Heading>
                    <Disclosure.Trigger className={TRIGGER_CLASS_NAMES}>
                        <span className={TITLE_CLASS_NAMES}>{title}</span>
                        <span className='flex flex-row items-center gap-1'>
                            {hasError && (
                                <Chip color='danger' variant='soft' size='sm'>
                                    <Chip.Label>{`${errorCount} to fix`}</Chip.Label>
                                </Chip>
                            )}
                            <Disclosure.Indicator className='text-muted'>
                                <ChevronDown size={20} />
                            </Disclosure.Indicator>
                        </span>
                    </Disclosure.Trigger>
                </Disclosure.Heading>
                <Disclosure.Content>
                    <Disclosure.Body className='mt-3 flex flex-col gap-4'>
                        <p className='text-sm text-muted'>{description}</p>
                        {hasBeenExpanded ? children : null}
                    </Disclosure.Body>
                </Disclosure.Content>
            </Disclosure>
        </div>
    );
};

export default OptionalConfigSection;
