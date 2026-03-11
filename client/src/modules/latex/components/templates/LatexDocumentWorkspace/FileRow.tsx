import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import { cn } from '@/shared/utils';
import { FileText, Star, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';

interface FileRowProps {
    file: LatexFileEntry;
    onSelect: (fileId: string) => void;
    onDelete: (fileId: string) => void;
    onSetEntrypoint: (fileId: string) => void;
};

const FILE_ICON = <FileText size={14} />;

const FileRow = ({ file, onSelect, onDelete, onSetEntrypoint }: FileRowProps) => {
    const handleSelect = useCallback(() => onSelect(file._id), [file._id, onSelect]);
    const handleDelete = useCallback(() => onDelete(file._id), [file._id, onDelete]);
    const handleEntrypoint = useCallback(() => onSetEntrypoint(file._id), [file._id, onSetEntrypoint]);

    return (
        <Container
            className={cn(
                'latex-workspace__file-row d-flex items-center content-between gap-05',
                file.isSelected && 'is-selected'
            )}
            onClick={handleSelect}
        >
            <Container className='d-flex items-center gap-05 flex-1 min-w-0'>
                <span className='color-muted d-flex items-center f-shrink-0'>{FILE_ICON}</span>
                <span className='latex-workspace__file-name text-truncate'>
                    {file.path && <span className='color-muted font-size-05'>{file.path}</span>}
                    {file.name}
                </span>
                {file.isEntrypoint && (
                    <span className='latex-workspace__entrypoint-badge color-muted f-shrink-0' title='Entrypoint'>
                        <Star size={10} />
                    </span>
                )}
            </Container>
            <Container className='d-flex items-center gap-025 f-shrink-0'>
                {!file.isEntrypoint && (
                    <IconButton
                        variant='ghost'
                        size='sm'
                        title='Set as entrypoint'
                        onClick={handleEntrypoint}
                    >
                        <Star size={11} />
                    </IconButton>
                )}
                {!file.isEntrypoint && (
                    <IconButton
                        variant='ghost'
                        size='sm'
                        title='Delete file'
                        onClick={handleDelete}
                    >
                        <Trash2 size={11} />
                    </IconButton>
                )}
            </Container>
        </Container>
    );
};

export default FileRow;
