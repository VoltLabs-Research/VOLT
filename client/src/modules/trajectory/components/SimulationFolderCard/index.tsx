import type { TrajectoryFolderRow } from '@/modules/trajectory/utilities/listing';
import { ChevronRight, Folder } from 'lucide-react';
import { Stack, Heading, Row } from '@/shared/presentation/primitives';
import { useCallback, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import './SimulationFolderCard.css';

const FOLDER_DRAG_INTENT_DISTANCE = 8;

interface SimulationFolderCardProps {
    folder: TrajectoryFolderRow;
    onOpen: (folderId: string) => void;
};

export default function SimulationFolderCard({ folder, onOpen }: SimulationFolderCardProps) {
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
            className='simulation-folder-card radius-md b-soft p-1-5 cursor-pointer'
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerCancel={resetPointerIntent}
            tabIndex={0}
            role='button'
            aria-label={`Open folder ${folder.title}`}
        >
            <Stack gap='1-5' height='max' className='simulation-folder-card__content'>
                <Row className='simulation-folder-card__icon flex-center'>
                    <Folder size={28} strokeWidth={1.75} />
                </Row>

                <Stack gap='05' flex='1'>
                    <Heading level={3} size='xl' weight='medium' truncate>
                        {folder.title}
                    </Heading>
                </Stack>

                <Row gap='05' className='simulation-folder-card__footer color-secondary font-size-2'>
                    <span>Open folder</span>
                    <ChevronRight size={14} strokeWidth={2} />
                </Row>
            </Stack>
        </article>
    );
}
