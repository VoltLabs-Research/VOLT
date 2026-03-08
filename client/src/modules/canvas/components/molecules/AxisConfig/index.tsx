import Container from '@/shared/presentation/components/Container';
import Slider from '@/shared/presentation/components/Slider';
import { SliceAxis } from '@/modules/fractal/types/configuration';

interface AxisConfigProps {
    axis: SliceAxis;
    position: number;
    angle: number;
    onPositionChange: (axis: SliceAxis, value: number) => void;
    onAngleChange: (axis: SliceAxis, value: number) => void;
};

const AxisConfig = ({
    axis,
    position,
    angle,
    onPositionChange,
    onAngleChange
}: AxisConfigProps) => {
    const sliders: { key: string; label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void; format: string; visible?: boolean }[] = [
        { key: 'position', label: 'Position', min: 0, max: 1, step: 0.01, value: position, onChange: (v) => onPositionChange(axis, v), format: `${(position * 100).toFixed(0)}%` },
        { key: 'angle', label: 'Angle', min: -90, max: 90, step: 1, value: angle, onChange: (v) => onAngleChange(axis, v), format: `${angle.toFixed(0)} deg`, visible: axis !== SliceAxis.X }
    ];

    return (
        <Container className="d-flex column gap-025">
            <Container className="d-flex content-between items-center">
                <span className="font-size-05 color-muted">{axis.toUpperCase()} Axis</span>
            </Container>

            {sliders.filter((s) => s.visible !== false).map((s) => (
                <Container key={s.key} className="d-flex content-between items-center">
                    <span className="font-size-05 color-muted">{s.label}</span>
                    <Container className="d-flex items-center gap-05">
                        <Slider
                            min={s.min}
                            max={s.max}
                            step={s.step}
                            value={s.value}
                            onChange={s.onChange}
                        />
                        <span className="font-size-05 color-muted">{s.format}</span>
                    </Container>
                </Container>
            ))}
        </Container>
    );
};

export default AxisConfig;
