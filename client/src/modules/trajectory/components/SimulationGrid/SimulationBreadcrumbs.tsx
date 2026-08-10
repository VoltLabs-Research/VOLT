import { getTrajectoryListingFolderDroppableId } from '@/modules/trajectory/utils/listing';
import { cn } from '@/shared/utils/cn';
import { ChevronRight } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';

export interface SimulationBreadcrumbItem {
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
                className={cn(className, 'volt-breadcrumbs__current')}
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
            className={cn(className, 'volt-breadcrumbs__trigger')}
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
            className={cn('trajectory-breadcrumb-drop-target', isOver ? 'is-drag-over' : '')}
        />
    );
};

interface SimulationBreadcrumbsProps {
    items: SimulationBreadcrumbItem[];
    onOpen: (folderId: string | null) => void;
    /** Turns every crumb into a drop target so trajectories can be dragged into an ancestor folder. */
    droppable?: boolean;
}

const SimulationBreadcrumbs = ({ items, onOpen, droppable = false }: SimulationBreadcrumbsProps) => {
    if (!items.length) {
        return null;
    }

    const Link = droppable ? DroppableSimulationBreadcrumbLink : SimulationBreadcrumbLink;

    return (
        <div className='dashboard-simulations-breadcrumbs'>
            <nav className='volt-breadcrumbs trajectory-breadcrumbs' aria-label='Folder breadcrumbs'>
                <ol className='volt-breadcrumbs__list'>
                    {items.map((item, index) => (
                        <li key={item.key} className='volt-breadcrumbs__item trajectory-breadcrumb-wrapper'>
                            {index > 0 ? (
                                <ChevronRight size={12} className='volt-breadcrumbs__separator' aria-hidden='true' />
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
