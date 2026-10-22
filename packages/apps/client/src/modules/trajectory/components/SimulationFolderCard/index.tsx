import type { TrajectoryFolderRow } from '@/modules/trajectory/contracts/listing';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import type { MenuOption } from '@/shared/contracts/menu';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChevronRight, Folder, MoreHorizontal } from 'lucide-react';
import { useCallback, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';

const FOLDER_DRAG_INTENT_DISTANCE = 8;

interface SimulationFolderCardProps {
    folder: TrajectoryFolderRow;
    onOpen: (folderId: string) => void;
    menuOptions?: MenuOption[];
}

export default function SimulationFolderCard({ folder, onOpen, menuOptions = [] }: SimulationFolderCardProps) {
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const didDragRef = useRef(false);

    const resetPointerIntent = useCallback(() => {
        pointerStartRef.current = null;
        didDragRef.current = false;
    }, []);

    const openFolder = useCallback(() => {
        onOpen(folder._id);
    }, [folder._id, onOpen]);

    const handlePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
        if (!event.isPrimary || event.button !== 0) {
            resetPointerIntent();
            return;
        }

        pointerStartRef.current = {
            x: event.clientX,
            y: event.clientY
        };
        didDragRef.current = false;
    }, [resetPointerIntent]);

    const handlePointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
        if (!pointerStartRef.current) {
            return;
        }

        const distanceX = Math.abs(event.clientX - pointerStartRef.current.x);
        const distanceY = Math.abs(event.clientY - pointerStartRef.current.y);
        if (distanceX >= FOLDER_DRAG_INTENT_DISTANCE || distanceY >= FOLDER_DRAG_INTENT_DISTANCE) {
            didDragRef.current = true;
        }
    }, []);

    const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
        const shouldSuppressClick = didDragRef.current;
        resetPointerIntent();

        if (event.target instanceof Element && event.target.closest('[data-row-click-ignore="true"]')) {
            return;
        }

        if (shouldSuppressClick || event.metaKey || event.ctrlKey) {
            return;
        }

        openFolder();
    }, [openFolder, resetPointerIntent]);

    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        openFolder();
    }, [openFolder]);

    // Pollium's folder tile: a borderless tint card. The transparent border is where GridItem
    // shows a drop target while a trajectory is dragged over the folder.
    return (
        <article
            className='simulation-folder-card group/card relative flex h-full min-h-64 cursor-pointer flex-col gap-4 rounded-3xl border border-transparent bg-foreground/4 p-5 transition-colors duration-150 hover:bg-foreground/7'
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerCancel={resetPointerIntent}
            tabIndex={0}
            role='button'
            aria-label={`Open folder ${folder.title}`}
        >
            {menuOptions.length > 0 ? (
                <div
                    className='absolute top-3.5 right-3.5 z-10 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-focus-within/card:opacity-100 has-[[aria-expanded=true]]:opacity-100 [@media(hover:none)]:opacity-100'
                    data-row-click-ignore='true'
                >
                    <ContextMenuPopover
                        id={`simulation-folder-popover-${folder._id}`}
                        trigger={(
                            <button
                                type='button'
                                className='flex size-8 cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent text-muted transition-colors duration-150 hover:bg-foreground/6 hover:text-foreground'
                                title={`Open actions for ${folder.title}`}
                                aria-label={`Open actions for ${folder.title}`}
                            >
                                <MoreHorizontal size={16} />
                            </button>
                        )}
                        options={menuOptions}
                        triggerAction='click'
                        placement='bottom-end'
                        ariaLabel={`Actions for ${folder.title}`}
                        menuLabel={`Actions for ${folder.title}`}
                    />
                </div>
            ) : null}
            <span className='flex size-13 items-center justify-center rounded-2xl bg-foreground/6 text-foreground'>
                <Folder size={24} strokeWidth={1.75} />
            </span>
            <div className='flex min-w-0 flex-col gap-1'>
                <h3 className='truncate text-lg font-semibold text-foreground'>
                    {folder.title}
                </h3>
                {folder.updatedAt ? (
                    <p className='truncate text-sm text-muted'>
                        Edited {formatDistanceToNowStrict(new Date(folder.updatedAt), { addSuffix: true })}
                    </p>
                ) : null}
            </div>
            <span className='mt-auto flex items-center gap-1 text-sm text-muted'>
                Open folder
                <ChevronRight size={14} />
            </span>
        </article>
    );
}
