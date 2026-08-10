import { cn } from '@heroui/react';

import type { ResizeDirectionValue } from '../../hooks/use-resizable';

interface ResizeHandleProps {
    direction: ResizeDirectionValue;
    isDragging: boolean;
    onPointerDown: (e: React.PointerEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onDoubleClick?: (e: React.MouseEvent) => void;
    label: string;
    controls: string;
    valueMin: number;
    valueMax: number;
    valueNow: number;
    /**
     * The rail geometry `CanvasPage.css` used to impose through
     * `.canvas-resize-rail--right > .canvas-resize-handle--horizontal`. It arrives
     * as a prop now because a descendant selector in a module stylesheet no longer
     * outranks the base utilities this component carries (spec §5b.3), and the two
     * rails in `CanvasPage` are the only callers that need it — `AIPage` renders the
     * handle bare and keeps the base geometry.
     */
    className?: string;
}

/**
 * The transparent border is the hit target: 15px wide with 7px transparent borders
 * and `bg-clip-padding`, pulled back by a negative margin so it straddles the seam
 * without taking layout space. The visible dots are
 * `.volt-resize-handle__grip::before`, which lives in the app's one stylesheet
 * because a pseudo-element has no utility form.
 */
const DIRECTION_CLASS = {
    horizontal: 'w-[15px] -mx-[7px] cursor-col-resize border-x-[7px] border-x-transparent pointer-coarse:w-6 pointer-coarse:-mx-[11px] pointer-coarse:border-x-[11px]',
    vertical: 'h-[15px] -my-[7px] cursor-row-resize border-y-[7px] border-y-transparent pointer-coarse:h-6 pointer-coarse:-my-[11px] pointer-coarse:border-y-[11px]'
} as const;

const ResizeHandle = ({ direction, isDragging, onPointerDown, onKeyDown, onDoubleClick, label, controls, valueMin, valueMax, valueNow, className }: ResizeHandleProps) => (
    <div
        className={cn(
            'relative z-[1] touch-none bg-transparent bg-clip-padding outline-none',
            DIRECTION_CLASS[direction],
            isDragging && 'canvas-resize-handle--active',
            className
        )}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onDoubleClick={onDoubleClick}
        role='separator'
        tabIndex={0}
        aria-label={`${label} (double-click to reset)`}
        aria-controls={controls}
        aria-orientation={direction}
        aria-valuemin={valueMin}
        aria-valuemax={valueMax}
        aria-valuenow={valueNow}
        title='Double-click to reset'
    >
        <span className={`volt-resize-handle__grip volt-resize-handle__grip--${direction}`} aria-hidden='true' />
    </div>
);

export default ResizeHandle;
