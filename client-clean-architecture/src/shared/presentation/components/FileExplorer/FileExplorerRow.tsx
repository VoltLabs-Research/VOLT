import type { ReactNode, MouseEvent } from 'react';
import Container from '@/shared/presentation/components/Container';
import { cn } from '@/shared/utils';

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
    const handleClick = (e: MouseEvent) => {
        e.stopPropagation();
        onClick?.();
    };

    const handleDoubleClick = (e: MouseEvent) => {
        e.stopPropagation();
        onDoubleClick?.();
    };

    return (
        <Container
            className={cn('file-explorer-row', isSelected && 'is-selected')}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            <Container className='file-explorer-row-name'>
                <span className='file-explorer-row-icon'>{icon}</span>
                <span className='file-explorer-row-text'>{name}</span>
            </Container>
            <span className='file-explorer-row-meta'>{type ?? '-'}</span>
            <span className='file-explorer-row-meta'>{size ?? '-'}</span>
            <span className='file-explorer-row-meta'>{date ?? '-'}</span>
        </Container>
    );
};

export default FileExplorerRow;
