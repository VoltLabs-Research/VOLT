import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import type { SliceAxis } from '@/modules/fractal/presentation/types/configuration';

interface AxisButtonsProps {
    axes: SliceAxis[];
    isAxisActive: (axis: SliceAxis) => boolean;
    onAxisClick: (axis: SliceAxis) => void;
}

const AxisButtons = ({ axes, isAxisActive, onAxisClick }: AxisButtonsProps) => (
    <Container className="d-flex gap-05">
        {axes.map((axis) => (
            <Button
                key={axis}
                variant={isAxisActive(axis) ? 'solid' : 'soft'}
                intent="canvas"
                shape="square"
                size="sm"
                block
                onClick={() => onAxisClick(axis)}
            >
                {axis.toUpperCase()}
            </Button>
        ))}
    </Container>
);

export default AxisButtons;
