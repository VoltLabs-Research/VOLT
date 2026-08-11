import { getTrajectoryListingFolderDroppableId } from '@/modules/trajectory/utils/listing';
import { cn } from '@/shared/utils/cn';
import { ChevronRight } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';

interface SimulationBreadcrumbItem {
    key: string;
    title: string;
    folderId: string | null;
}

interface SimulationBreadcrumbLinkProps {
    item: SimulationBreadcrumbItem;
    isCurrent: boolean;
    onOpen: (folderId: string | null) => void;
    dropRef?: (element: HTMLElement | null) => void;
    className?: string;
}

const SimulationBreadcrumbLink = ({ item, isCurrent, onOpen, dropRef, className }: SimulationBreadcrumbLinkProps) => {
    if (isCurrent) {
        return (
            <span
                ref={dropRef}
                className={cn(className, 'inline-flex min-w-0 max-w-48 items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-2.5 py-2 bg-surface-hover font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--border)]')}
                aria-current='page'
                title={item.title}
            >
                {item.title}
            </span>
        );
    }

    return (
        <button
            ref={dropRef}
            type='button'
            className={cn(className, 'inline-flex min-w-0 max-w-48 items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-2.5 py-2 cursor-pointer border-none bg-transparent text-left font-[inherit] text-muted hover:bg-surface-hover hover:text-foreground')}
            onClick={() => onOpen(item.folderId)}
            title={item.title}
            aria-label={`Open ${item.title}`}
        >
            {item.title}
        </button>
    );
};

const DroppableSimulationBreadcrumbLink = (props: SimulationBreadcrumbLinkProps) => {
    const { setNodeRef, isOver } = useDroppable({
        id: getTrajectoryListingFolderDroppableId(props.item.folderId)
    });

    return (
        <SimulationBreadcrumbLink
            {...props}
            dropRef={setNodeRef}
            className={cn('relative transition-[box-shadow] duration-[160ms]', isOver ? 'is-drag-over shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--info)_62%,transparent)]' : '')}
        />
    );
};

interface SimulationBreadcrumbsProps {
    items: SimulationBreadcrumbItem[];
    onOpen: (folderId: string | null) => void;

    droppable?: boolean;
}

const SimulationBreadcrumbs = ({ items, onOpen, droppable = false }: SimulationBreadcrumbsProps) => {
    if (!items.length) {
        return null;
    }

    const Link = droppable ? DroppableSimulationBreadcrumbLink : SimulationBreadcrumbLink;

    return (
        <div className='dashboard-simulations-breadcrumbs'>
            <nav className='min-w-0' aria-label='Folder breadcrumbs'>
                <ol className='flex flex-row flex-wrap items-center gap-[0.15rem] m-0 min-w-0 list-none p-0'>
                    {items.map((item, index) => (
                        <li key={item.key} className='flex flex-row items-center gap-1'>
                            {index > 0 ? (
                                <ChevronRight size={12} className='shrink-0 text-muted' aria-hidden='true' />
                            ) : null}
                            <Link
                                item={item}
                                isCurrent={index === items.length - 1}
                                onOpen={onOpen}
                            />
                        </li>
                    ))}
                </ol>
            </nav>
        </div>
    );
};

export default SimulationBreadcrumbs;
