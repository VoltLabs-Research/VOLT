import '@/shared/presentation/styles/resize-handle.css';

import type { ResizeDirectionValue } from '../../hooks/use-resizable';

import './ResizeHandle.css';

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
}

const ResizeHandle = ({ direction, isDragging, onPointerDown, onKeyDown, onDoubleClick, label, controls, valueMin, valueMax, valueNow }: ResizeHandleProps) => (
    <div className={`canvas-resize-handle z-5 canvas-resize-handle--${direction}${isDragging ? ' canvas-resize-handle--active' : ''}`} onPointerDown={onPointerDown} onKeyDown={onKeyDown} onDoubleClick={onDoubleClick} role="separator" tabIndex={0} aria-label={`${label} (double-click to reset)`} aria-controls={controls} aria-orientation={direction} aria-valuemin={valueMin} aria-valuemax={valueMax} aria-valuenow={valueNow} title='Double-click to reset'>
        <span className={`canvas-resize-handle__grip volt-resize-handle__grip volt-resize-handle__grip--${direction}`} aria-hidden='true' />
    </div>
);

export default ResizeHandle;
