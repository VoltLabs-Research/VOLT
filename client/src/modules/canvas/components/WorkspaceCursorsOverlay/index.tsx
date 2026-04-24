import { useLayoutEffect, useState } from 'react';
import Box from '@/shared/presentation/primitives/Box';
import type { WorkspaceCursor } from '@/modules/canvas/collaboration/use-workspace-cursors';
import './WorkspaceCursorsOverlay.css';

interface WorkspaceCursorsOverlayProps {
    cursors: WorkspaceCursor[];
    containerRef: React.RefObject<HTMLElement | null>;
}

interface ResolvedCursor extends WorkspaceCursor {
    left: number;
    top: number;
}

const USER_COLORS = [
    '#ef4444',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316'
];

const resolveColor = (userId: string): string => {
    let hash = 0;
    for (let index = 0; index < userId.length; index += 1) {
        hash = (hash * 31 + userId.charCodeAt(index)) | 0;
    }

    const bucket = Math.abs(hash) % USER_COLORS.length;
    return USER_COLORS[bucket];
};

const resolveDisplayName = (cursor: WorkspaceCursor): string => {
    const parts = [cursor.firstName, cursor.lastName].filter(Boolean);
    if (parts.length === 0) {
        return 'Peer';
    }

    return parts.join(' ');
};

const WorkspaceCursorsOverlay = ({ cursors, containerRef }: WorkspaceCursorsOverlayProps) => {
    const [resolvedCursors, setResolvedCursors] = useState<ResolvedCursor[]>([]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) {
            setResolvedCursors([]);
            return;
        }

        const rect = container.getBoundingClientRect();
        const next: ResolvedCursor[] = cursors.map((cursor) => ({
            ...cursor,
            left: cursor.x * rect.width,
            top: cursor.y * rect.height
        }));

        setResolvedCursors(next);
    }, [cursors, containerRef]);

    if (resolvedCursors.length === 0) {
        return null;
    }

    return (
        <Box position='absolute' inset='0' selectNone className='workspace-cursors-overlay' aria-hidden='true'>
            {resolvedCursors.map((cursor) => {
                const color = resolveColor(cursor.userId);
                const name = resolveDisplayName(cursor);

                return (
                    <div
                        key={cursor.userId}
                        className='workspace-cursor'
                        style={{ transform: `translate3d(${cursor.left}px, ${cursor.top}px, 0)` }}
                    >
                        <svg
                            width='16'
                            height='16'
                            viewBox='0 0 16 16'
                            fill='none'
                            xmlns='http://www.w3.org/2000/svg'
                        >
                            <path
                                d='M1.5 1.5L13.5 6.5L7 8.5L5 14.5L1.5 1.5Z'
                                fill={color}
                                stroke='white'
                                strokeWidth='1'
                                strokeLinejoin='round'
                            />
                        </svg>
                        <span className='workspace-cursor-label' style={{ backgroundColor: color }}>
                            {name}
                        </span>
                    </div>
                );
            })}
        </Box>
    );
};

export default WorkspaceCursorsOverlay;
