import { Button, Disclosure, cn } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface CollapsibleSectionProps {
    title: string;
    children: ReactNode;

    defaultExpanded?: boolean;

    expanded?: boolean;
    onExpandedChange?: (next: boolean) => void;
    onDelete?: () => void;
    deleteActionLabel?: string;

    noSpacing?: boolean;

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
                            isCompact ? 'text-2xs font-normal' : 'text-sm font-medium'
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
