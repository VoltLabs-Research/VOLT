import { getCategoricalColor } from '@/shared/ui/utils/categorical-palette';
import { useLayoutEffect, useState } from 'react';
import type { WorkspaceCursor } from '@/modules/canvas/collaboration/use-workspace-cursors';

interface WorkspaceCursorsOverlayProps {
    cursors: WorkspaceCursor[];
    containerRef: React.RefObject<HTMLElement | null>;
}

interface ResolvedCursor extends WorkspaceCursor {
    left: number;
    top: number;
}

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
        <div className='pointer-events-none absolute inset-0 z-[8] select-none' aria-hidden='true'>
            {resolvedCursors.map((cursor) => {
                const color = getCategoricalColor(cursor.userId);
                const name = resolveDisplayName(cursor);

                return (
                    <div
                        key={cursor.userId}
                        className='absolute left-0 top-0 flex items-start gap-0.5 opacity-85 will-change-transform [transition:transform_80ms_linear,opacity_120ms_linear]'
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
                        <span
                            className='inline-flex max-w-[140px] translate-x-1.5 translate-y-2.5 items-center truncate rounded-xl px-1.5 py-0.5 text-2xs font-semibold leading-[1.2] text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]'
                            style={{ backgroundColor: color }}
                        >
                            {name}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default WorkspaceCursorsOverlay;
