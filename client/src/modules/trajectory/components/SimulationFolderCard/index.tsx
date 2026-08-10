import type { TrajectoryFolderRow } from '@/modules/trajectory/contracts/listing';
import { IconButton, Popover, PopoverMenu, PopoverMenuItem } from '@voltstack/bravais';
import type { MenuOption } from '@/shared/contracts/menu';
import { ChevronRight, Folder, MoreHorizontal } from 'lucide-react';
import { useCallback, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import './SimulationFolderCard.css';

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
            className='simulation-folder-card rounded-xl border border-border relative cursor-pointer'
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
                    className='simulation-folder-card__actions'
                    data-row-click-ignore='true'
                >
                    <Popover
                        id={`simulation-folder-popover-${folder._id}`}
                        trigger={(
                            <IconButton
                                size='sm'
                                className='simulation-folder-card__actions-btn'
                                title={`Open actions for ${folder.title}`}
                                aria-label={`Open actions for ${folder.title}`}
                            >
                                <MoreHorizontal size={16} />
                            </IconButton>
                        )}
                    >
                        <PopoverMenu>
                            {menuOptions.map((option) => {
                                const Icon = option.icon;

                                return (
                                    <PopoverMenuItem
                                        key={option.label}
                                        icon={Icon ? <Icon /> : undefined}
                                        label={option.label}
                                        onClick={() => {
                                            void option.onClick?.();
                                        }}
                                        disabled={option.disabled}
                                        variant={option.destructive ? 'danger' : undefined}
                                    />
                                );
                            })}
                        </PopoverMenu>
                    </Popover>
                </div>
            ) : null}
            <div className='flex flex-col gap-6 h-full simulation-folder-card__content'>
                <div className='flex flex-row items-center simulation-folder-card__icon justify-center'>
                    <Folder size={30} strokeWidth={1.75} />
                </div>

                <div className='flex flex-col gap-2 flex-1'>
                    <h3 className='text-xl font-medium text-foreground truncate'>
                        {folder.title}
                    </h3>
                </div>

                <div className='flex flex-row items-center gap-2 simulation-folder-card__footer text-muted text-sm'>
                    <span>Open folder</span>
                    <ChevronRight size={14} strokeWidth={2} />
                </div>
            </div>
        </article>
    );
}
