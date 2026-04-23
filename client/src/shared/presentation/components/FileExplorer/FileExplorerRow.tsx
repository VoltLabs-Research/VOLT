import { cn } from '@/shared/utils';
import { Tooltip } from '@/shared/presentation/primitives';
import { Copy } from 'lucide-react';
import { sileo } from 'sileo';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

export interface FileExplorerRowProps {
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

    const handleCopyName = async (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();

        try {
            await navigator.clipboard.writeText(name);
            sileo.success({ title: 'File name copied to clipboard' });
        } catch {
            sileo.error({ title: 'Failed to copy file name' });
        }
    };

    const rowClassName = cn('file-explorer-row', isInteractive && 'is-interactive', isSelected && 'is-selected');
    const rowLabel = `${name}${type ? `, ${type}` : ''}${size ? `, ${size}` : ''}${date ? `, ${date}` : ''}`;

    const content = (
        <>
            <div className='file-explorer-row-name'>
                <span className='file-explorer-row-icon' aria-hidden='true'>{icon}</span>
                <span className='file-explorer-row-text' title={name}>{name}</span>
                <Tooltip content='Copy full file name'>
                    <button
                        type='button'
                        className='file-explorer-row-copy'
                        aria-label={`Copy full name for ${name}`}
                        onClick={handleCopyName}
                    >
                        <Copy size={14} aria-hidden='true' />
                    </button>
                </Tooltip>
            </div>
            <span className='file-explorer-row-meta' title={type} aria-label={`Type: ${type ?? 'Not available'}`}>{type ?? '-'}</span>
            <span className='file-explorer-row-meta' title={size} aria-label={`Size: ${size ?? 'Not available'}`}>{size ?? '-'}</span>
            <span className='file-explorer-row-meta' title={date} aria-label={`Date: ${date ?? 'Not available'}`}>{date ?? '-'}</span>
        </>
    );

    if (!isInteractive) {
        return (
            <div className={`${rowClassName}`} role='listitem' aria-label={rowLabel}>
                {content}
            </div>
        );
    }

    return (
        <div className={`${rowClassName}`} onClick={handleClick} onDoubleClick={handleDoubleClick} onKeyDown={handleKeyDown} aria-label={rowLabel} role='listitem' tabIndex={0} aria-selected={isSelected}>
            {content}
        </div>
    );
};

export default FileExplorerRow;
