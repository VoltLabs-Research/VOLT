import type { TrajectoryFolderRow } from '@/modules/trajectory/contracts/listing';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import type { MenuOption } from '@/shared/contracts/menu';
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

    return (
        <article
            className='simulation-folder-card group/card relative flex h-full min-h-[200px] cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-transparent p-6 transition-[border-color,box-shadow] duration-[160ms] hover:border-border/72'
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
                    className='absolute top-[0.45rem] right-[0.45rem] z-[4] opacity-0 transition-[opacity,background-color] duration-[160ms] group-hover/card:opacity-100 group-focus-within/card:opacity-100'
                    data-row-click-ignore='true'
                >
                    <ContextMenuPopover
                        id={`simulation-folder-popover-${folder._id}`}
                        trigger={(
                            <button
                                type='button'
                                className='flex size-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-muted shadow-none transition-colors duration-150 hover:bg-foreground/6 hover:text-foreground'
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
            <div className='flex min-h-full flex-col gap-6 h-full'>
                <div className='flex size-[3.25rem] flex-row items-center justify-center rounded-[0.95rem] border-0 bg-surface-secondary text-muted'>
                    <Folder size={30} strokeWidth={1.75} />
                </div>
                <div className='flex flex-col gap-2 flex-1'>
                    <h3 className='text-xl font-medium text-foreground truncate'>
                        {folder.title}
                    </h3>
                </div>
                <div className='mt-auto flex flex-row items-center gap-2 text-sm text-muted'>
                    <span>Open folder</span>
                    <ChevronRight size={14} strokeWidth={2} />
                </div>
            </div>
        </article>
    );
}
