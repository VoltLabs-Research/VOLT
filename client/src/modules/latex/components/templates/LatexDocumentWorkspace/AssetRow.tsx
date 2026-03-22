import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import { getAssetDisplayName } from '@/modules/latex/utilities/workspace';
import { formatSize } from '@/shared/utils/format';
import { File, FileText, Image, Link, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';

interface AssetRowProps {
    asset: LatexAsset;
    onDelete: (asset: LatexAsset) => void;
    onInsertRef: (asset: LatexAsset) => void;
};

const getAssetIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return <Image size={14} />;
    if (mimetype === 'application/pdf') return <FileText size={14} />;
    return <File size={14} />;
};

const AssetRow = ({ asset, onDelete, onInsertRef }: AssetRowProps) => {
    const mimeShort = asset.mimetype.split('/')[1] ?? asset.mimetype;
    const dirPart = asset.path.includes('/')
        ? asset.path.substring(0, asset.path.lastIndexOf('/') + 1)
        : undefined;

    const handleDelete = useCallback(() => onDelete(asset), [asset, onDelete]);
    const handleInsert = useCallback(() => onInsertRef(asset), [asset, onInsertRef]);

    return (
        <Container className='latex-workspace__asset-row d-flex items-center content-between gap-05'>
            <Container className='d-flex items-center gap-05 flex-1 min-w-0'>
                <span className='color-muted d-flex items-center f-shrink-0'>
                    {getAssetIcon(asset.mimetype)}
                </span>
                <span className='latex-workspace__file-name text-truncate' title={asset.path}>
                    {dirPart && (
                        <span className='color-muted'>{dirPart}</span>
                    )}
                    {getAssetDisplayName(asset)}
                </span>
            </Container>
            <Container className='d-flex items-center gap-025 f-shrink-0'>
                <span className='latex-workspace__asset-meta color-muted'>{formatSize(asset.size)}</span>
                <span className='latex-workspace__asset-meta color-muted'>{mimeShort}</span>
                <IconButton
                    variant='ghost'
                    size='sm'
                    title='Insert reference in editor'
                    onClick={handleInsert}
                >
                    <Link size={12} />
                </IconButton>
                <IconButton
                    variant='ghost'
                    size='sm'
                    title='Delete asset'
                    onClick={handleDelete}
                >
                    <Trash2 size={12} />
                </IconButton>
            </Container>
        </Container>
    );
};

export default AssetRow;
