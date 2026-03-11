import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import DraggableRow from './DraggableRow';
import { cn } from '@/shared/utils';
import { File, Image, Link, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import type { FileTreeNode as FileTreeNodeType } from '@/modules/latex/utilities/file-tree';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';

interface AssetNodeProps {
    node: FileTreeNodeType;
    depth: number;
    onAssetDelete: (asset: LatexAsset) => void;
    onAssetInsertRef: (asset: LatexAsset) => void;
};

const getAssetIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return <Image size={13} />;
    return <File size={13} />;
};

/** Renders a draggable asset row inside the file tree. */
const AssetNode = ({ node, depth, onAssetDelete, onAssetInsertRef }: AssetNodeProps) => {
    const asset = node.data as LatexAsset;
    const indent = depth * 12;
    const mimeShort = asset.mimetype.split('/')[1] ?? asset.mimetype;

    const handleDelete = useCallback(
        () => onAssetDelete(asset),
        [asset, onAssetDelete]
    );

    const handleInsert = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onAssetInsertRef(asset);
        },
        [asset, onAssetInsertRef]
    );

    const renderContent = (isDragging: boolean) => (
        <Container
            className={cn(
                'latex-workspace__asset-row d-flex items-center content-between gap-05',
                isDragging && 'is-dragging'
            )}
            style={{ paddingLeft: `${0.75 + indent / 16}rem` }}
        >
            <Container className='d-flex items-center gap-05 flex-1 min-w-0'>
                <span className='color-muted d-flex items-center f-shrink-0'>
                    {getAssetIcon(asset.mimetype)}
                </span>
                <span
                    className='latex-workspace__file-name text-truncate'
                    title={asset.path ?? asset.originalName}
                >
                    {asset.originalName}
                </span>
            </Container>
            <Container className='d-flex items-center gap-025 f-shrink-0'>
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

    return <DraggableRow id={node.id}>{renderContent}</DraggableRow>;
};

export default AssetNode;
