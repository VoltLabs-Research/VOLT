import { Tooltip, cn } from '@heroui/react';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { Copy } from 'lucide-react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

interface FileExplorerRowProps {
    icon: ReactNode;
    name: string;
    type?: string;
    size?: string;
    date?: string;
    isSelected?: boolean;
    onClick?: () => void;
    onDoubleClick?: () => void;
};

const FileExplorerRow = ({
    icon,
    name,
    type,
    size,
    date,
    isSelected = false,
    onClick,
    onDoubleClick
}: FileExplorerRowProps) => {
    const isInteractive = Boolean(onClick || onDoubleClick);

    const handleClick = (e: MouseEvent) => {
        e.stopPropagation();
        onClick?.();
    };

    const handleDoubleClick = (e: MouseEvent) => {
        e.stopPropagation();
        onDoubleClick?.();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Enter' && e.key !== ' ') {
            return;
        }

        e.preventDefault();
        onClick?.();
    };

    const handleCopyName = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        void copyTextToClipboard(name, {
            successMessage: 'File name copied to clipboard',
            errorMessage: 'Failed to copy file name'
        });
    };

    const rowClassName = cn(
        'group grid w-full grid-cols-[1fr_100px_100px_120px] items-center border-b border-border bg-transparent px-4 py-2.5 text-left transition-colors duration-150 cursor-pointer hover:bg-surface-hover',
        'max-[900px]:grid-cols-[1fr] max-[900px]:items-start max-[900px]:gap-1 max-[900px]:px-4 max-[900px]:py-3',
        isSelected && 'bg-surface-tertiary'
    );
    const rowLabel = `${name}${type ? `, ${type}` : ''}${size ? `, ${size}` : ''}${date ? `, ${date}` : ''}`;

    const content = (
        <>
            <div className='flex min-w-0 items-center gap-2 max-[900px]:items-start'>
                <span className='flex shrink-0 items-center justify-center text-muted' aria-hidden='true'>{icon}</span>
                <span className='truncate text-muted group-hover:text-foreground max-[900px]:whitespace-normal max-[900px]:[overflow-wrap:anywhere]' title={name}>{name}</span>
                <Tooltip delay={300} closeDelay={0}>
                    <Tooltip.Trigger<'button'>
                        className='inline-flex shrink-0 items-center justify-center rounded-lg bg-transparent p-1 text-muted opacity-0 transition-[opacity,background-color,color] duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 max-[900px]:opacity-100'
                        render={(triggerProps) => (
                            <button
                                {...triggerProps}
                                type='button'
                                aria-label={`Copy full name for ${name}`}
                                onClick={handleCopyName}
                            >
                                <Copy size={14} aria-hidden='true' />
                            </button>
                        )}
                    />
                    <Tooltip.Content>
                        Copy full file name
                    </Tooltip.Content>
                </Tooltip>
            </div>
            <span className={cn('text-[0.85rem] text-muted max-[900px]:ml-7 max-[900px]:whitespace-normal max-[900px]:[overflow-wrap:anywhere] max-[900px]:before:mr-1.5 max-[900px]:before:inline-block max-[900px]:before:min-w-12 max-[900px]:before:text-xs max-[900px]:before:font-medium max-[900px]:before:uppercase max-[900px]:before:tracking-[0.04em] max-[900px]:before:text-muted', "max-[900px]:before:content-['Type']")} title={type} aria-label={`Type: ${type ?? 'Not available'}`}>{type ?? '-'}</span>
            <span className={cn('text-[0.85rem] text-muted max-[900px]:ml-7 max-[900px]:whitespace-normal max-[900px]:[overflow-wrap:anywhere] max-[900px]:before:mr-1.5 max-[900px]:before:inline-block max-[900px]:before:min-w-12 max-[900px]:before:text-xs max-[900px]:before:font-medium max-[900px]:before:uppercase max-[900px]:before:tracking-[0.04em] max-[900px]:before:text-muted', "max-[900px]:before:content-['Size']")} title={size} aria-label={`Size: ${size ?? 'Not available'}`}>{size ?? '-'}</span>
            <span className={cn('text-[0.85rem] text-muted max-[900px]:ml-7 max-[900px]:whitespace-normal max-[900px]:[overflow-wrap:anywhere] max-[900px]:before:mr-1.5 max-[900px]:before:inline-block max-[900px]:before:min-w-12 max-[900px]:before:text-xs max-[900px]:before:font-medium max-[900px]:before:uppercase max-[900px]:before:tracking-[0.04em] max-[900px]:before:text-muted', "max-[900px]:before:content-['Date']")} title={date} aria-label={`Date: ${date ?? 'Not available'}`}>{date ?? '-'}</span>
        </>
    );

    if (!isInteractive) {
        return (
            <div className={rowClassName} role='listitem' aria-label={rowLabel}>
                {content}
            </div>
        );
    }

    return (
        <div className={rowClassName} onClick={handleClick} onDoubleClick={handleDoubleClick} onKeyDown={handleKeyDown} aria-label={rowLabel} role='listitem' tabIndex={0} aria-selected={isSelected}>
            {content}
        </div>
    );
};

export default FileExplorerRow;
