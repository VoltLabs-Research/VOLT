import { getTrajectoryListingFolderDroppableId } from '@/modules/trajectory/utils/listing';
import { BreadcrumbsItem, BreadcrumbsRoot, cn } from '@heroui/react';
import { useDroppable } from '@dnd-kit/core';
import type { FolderBreadcrumbItem } from '@/shared/ui/hooks/use-folder-breadcrumbs';

const DroppableCrumbLabel = ({ item }: { item: FolderBreadcrumbItem }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: getTrajectoryListingFolderDroppableId(item.id)
    });

    return (
        <span
            ref={setNodeRef}
            className={cn('block max-w-48 truncate', isOver && 'is-drag-over underline')}
        >
            {item.title}
        </span>
    );
};

interface SimulationBreadcrumbsProps {
    items: FolderBreadcrumbItem[];
    onOpen: (folderId: string | null) => void;

    droppable?: boolean;
}

const SimulationBreadcrumbs = ({ items, onOpen, droppable = false }: SimulationBreadcrumbsProps) => {
    if (!items.length) {
        return null;
    }

    return (
        <BreadcrumbsRoot className='min-w-0 flex-wrap' aria-label='Folder breadcrumbs'>
            {items.map((item) => (
                <BreadcrumbsItem
                    key={item.id ?? 'root'}
                    onPress={() => onOpen(item.id)}
                >
                    {droppable
                        ? <DroppableCrumbLabel item={item} />
                        : <span className='block max-w-48 truncate'>{item.title}</span>}
                </BreadcrumbsItem>
            ))}
        </BreadcrumbsRoot>
    );
};

export default SimulationBreadcrumbs;
