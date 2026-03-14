import { cn } from '@/shared/utils';
import Container from '@/shared/presentation/components/Container';
import type { ReactNode, MouseEvent } from 'react';

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

    const rowClassName = cn('file-explorer-row', isInteractive && 'is-interactive', isSelected && 'is-selected');

    const content = (
        <>
            <Container className='file-explorer-row-name'>
                <span className='file-explorer-row-icon'>{icon}</span>
                <span className='file-explorer-row-text'>{name}</span>
            </Container>
            <span className='file-explorer-row-meta'>{type ?? '-'}</span>
            <span className='file-explorer-row-meta'>{size ?? '-'}</span>
            <span className='file-explorer-row-meta'>{date ?? '-'}</span>
        </>
    );

    if (!isInteractive) {
        return (
            <Container className={rowClassName}>
                {content}
            </Container>
        );
    }

    return (
        <button
            type='button'
            className={rowClassName}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            aria-pressed={isSelected}
        >
            {content}
        </button>
    );
};

export default FileExplorerRow;
