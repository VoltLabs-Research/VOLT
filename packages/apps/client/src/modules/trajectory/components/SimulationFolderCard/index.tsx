import type { TrajectoryFolderRow } from '@/modules/trajectory/contracts/listing';
import useTrajectoryPreview from '../SimulationCard/use-trajectory-preview';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import type { MenuOption } from '@/shared/contracts/menu';
import { formatDistanceToNowStrict } from 'date-fns';
import { MoreHorizontal } from 'lucide-react';
import { useCallback, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';

const FOLDER_DRAG_INTENT_DISTANCE = 8;

const SHEET = 'absolute top-1/2 left-1/2 aspect-[4/3] overflow-hidden rounded-lg bg-background ring-1 ring-foreground/8 transition-transform duration-300 ease-(--ease-emphasized) motion-reduce:transition-none';

// Front to back; the stack fans out a little further on hover.
const SHEET_LAYERS = [
    'z-[3] [transform:translate(-50%,-44%)] group-hover/card:[transform:translate(-50%,-40%)]',
    'z-[2] [transform:translate(-36%,-62%)_rotate(4deg)] group-hover/card:[transform:translate(-30%,-70%)_rotate(7deg)]',
    'z-[1] [transform:translate(-66%,-56%)_rotate(-5deg)] group-hover/card:[transform:translate(-74%,-60%)_rotate(-8deg)]'
];

const SINGLE_SHEET = '[transform:translate(-50%,-50%)] group-hover/card:[transform:translate(-50%,-53%)]';

interface FolderPreviewSheetProps {
    trajectoryId: string;
    className: string;
    width: string;
}

const FolderPreviewSheet = ({ trajectoryId, className, width }: FolderPreviewSheetProps) => {
    const { previewBlobUrl } = useTrajectoryPreview({ trajectoryId, allowPersistedPreviewFallback: true });

    return (
        <div className={`${SHEET} ${className}`} style={{ width }}>
            {previewBlobUrl ? <img className='size-full object-cover' src={previewBlobUrl} alt='' /> : null}
        </div>
    );
};

interface SimulationFolderCardProps {
    folder: TrajectoryFolderRow;
    onOpen: (folderId: string) => void;
    menuOptions?: MenuOption[];
}

export default function SimulationFolderCard({ folder, onOpen, menuOptions = [] }: SimulationFolderCardProps) {
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const didDragRef = useRef(false);
    const previewIds = folder.previewTrajectoryIds ?? [];
    const isSingle = previewIds.length === 1;

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

    // Teachers' course card: a tint well fanning out previews of the folder's latest trajectories, the caption beneath it.
    // The transparent border is where GridItem shows a drop target while a trajectory is dragged over the folder.
    return (
        <article
            className='simulation-folder-card group/card relative flex h-full min-h-64 cursor-pointer flex-col rounded-3xl border border-transparent p-2 transition-colors duration-150 hover:bg-foreground/4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
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
            <div aria-hidden='true' className='relative min-h-40 flex-1 overflow-hidden rounded-2xl bg-foreground/5'>
                {previewIds.length === 0 ? (
                    <div className='flex h-full items-center justify-center px-4 text-center text-sm text-muted'>
                        No trajectories yet
                    </div>
                ) : previewIds.map((trajectoryId, index) => (
                    <FolderPreviewSheet
                        key={trajectoryId}
                        trajectoryId={trajectoryId}
                        className={isSingle ? SINGLE_SHEET : SHEET_LAYERS[index]}
                        width={isSingle ? '72%' : '58%'}
                    />
                ))}
            </div>
            <div className='flex min-w-0 flex-col gap-1 px-2 pt-3 pb-1.5'>
                <h3 className='truncate text-sm font-medium text-foreground'>
                    {folder.title}
                </h3>
                {folder.updatedAt ? (
                    <p className='truncate text-xs text-muted'>
                        Edited {formatDistanceToNowStrict(new Date(folder.updatedAt), { addSuffix: true })}
                    </p>
                ) : null}
            </div>
        </article>
    );
}
