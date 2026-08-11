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

    className?: string;
}

const ResizeHandle = ({ direction, isDragging, onPointerDown, onKeyDown, onDoubleClick, label, controls, valueMin, valueMax, valueNow, className }: ResizeHandleProps) => (
    <div
        className={cn(
            'relative z-[1] touch-none bg-transparent bg-clip-padding outline-none',
            direction === 'vertical'
                ? 'h-[15px] -my-[7px] cursor-row-resize border-y-[7px] border-y-transparent pointer-coarse:h-6 pointer-coarse:-my-[11px] pointer-coarse:border-y-[11px]'
                : 'w-[15px] -mx-[7px] cursor-col-resize border-x-[7px] border-x-transparent pointer-coarse:w-6 pointer-coarse:-mx-[11px] pointer-coarse:border-x-[11px]',
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
        <span
            className={direction === 'vertical'
                ? 'volt-resize-handle__grip volt-resize-handle__grip--vertical'
                : 'volt-resize-handle__grip volt-resize-handle__grip--horizontal'}
            aria-hidden='true'
        />
    </div>
);

export default ResizeHandle;
