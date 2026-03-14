import Container from '@/shared/presentation/components/Container';

import type { ResizeDirectionValue } from '../../../hooks/use-resizable';

import './ResizeHandle.css';

interface ResizeHandleProps {
    direction: ResizeDirectionValue;
    isDragging: boolean;
    onPointerDown: (e: React.PointerEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    label: string;
    controls: string;
    valueMin: number;
    valueMax: number;
    valueNow: number;
};

const ResizeHandle = ({ direction, isDragging, onPointerDown, onKeyDown, label, controls, valueMin, valueMax, valueNow }: ResizeHandleProps) => (
    <Container
        className={`canvas-resize-handle z-5 canvas-resize-handle--${direction}${isDragging ? ' canvas-resize-handle--active' : ''}`}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        role="separator"
        tabIndex={0}
        aria-label={label}
        aria-controls={controls}
        aria-orientation={direction}
        aria-valuemin={valueMin}
        aria-valuemax={valueMax}
        aria-valuenow={valueNow}
    />
);

export default ResizeHandle;
