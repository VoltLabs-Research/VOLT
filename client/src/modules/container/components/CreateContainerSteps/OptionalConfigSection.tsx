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

const OptionalConfigSection = ({
    title,
    description,
    defaultExpanded = false,
    errorCount = 0,
    children
}: OptionalConfigSectionProps) => {
    const hasError = errorCount > 0;
    const [isExpanded, setIsExpanded] = useState(defaultExpanded || hasError);

    const [hasBeenExpanded, setHasBeenExpanded] = useState(defaultExpanded || hasError);
    const expanded = isExpanded || hasError;

    useEffect(() => {
        if (expanded && !hasBeenExpanded) {
            setHasBeenExpanded(true);
        }
    }, [expanded, hasBeenExpanded]);

    return (
        <div className='col-span-full flex flex-col gap-4 rounded-xl border border-border p-6'>
            <Disclosure isExpanded={expanded} onExpandedChange={setIsExpanded}>
                <Disclosure.Heading>
                    <Disclosure.Trigger className='flex w-full min-h-11 flex-1 select-none flex-row items-center justify-between gap-2 py-1 text-left'>
                        <span className='text-sm font-semibold text-foreground'>{title}</span>
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
