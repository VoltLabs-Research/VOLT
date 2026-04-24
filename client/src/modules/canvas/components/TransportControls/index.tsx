import { useEditorStore } from '@/modules/canvas/stores/editor';
import { resolveRangedTimesteps } from '@/modules/canvas/utilities/timeline-range';

import { SkipBack, Rewind, ChevronLeft, Play, ChevronRight, FastForward, SkipForward, Pause } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/shared/presentation/primitives/Button';
import Row from '@/shared/presentation/primitives/Row';
import './TransportControls.css';

interface TransportControlsProps {
    trajectoryId?: string;
    currentTimestep: number | undefined;
    availableTimesteps: number[];
};

const TransportControls = ({ trajectoryId, currentTimestep, availableTimesteps }: TransportControlsProps) => {
    const {
        isPlaying,
        togglePlay,
        setCurrentTimestep,
        rangeStart,
        rangeEnd
    } = useEditorStore(useShallow((state) => ({
        isPlaying: state.isPlaying,
        togglePlay: state.togglePlay,
        setCurrentTimestep: state.setCurrentTimestep,
        rangeStart: state.rangeStart,
        rangeEnd: state.rangeEnd
    })));

    const timesteps = useMemo(() => {
        return resolveRangedTimesteps(availableTimesteps, rangeStart, rangeEnd);
    }, [availableTimesteps, rangeStart, rangeEnd]);
    const currentIndex = currentTimestep !== undefined ? timesteps.indexOf(currentTimestep) : -1;

    const jumpToStart = () => {
        if (timesteps.length === 0) return;
        setCurrentTimestep(timesteps[0]);
    };

    const jumpToEnd = () => {
        if (timesteps.length === 0) return;
        setCurrentTimestep(timesteps[timesteps.length - 1]);
    };

    const jumpBack10 = () => {
        if (timesteps.length === 0) return;
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const nextIndex = Math.max(0, baseIndex - 10);
        setCurrentTimestep(timesteps[nextIndex]);
    };

    const jumpForward10 = () => {
        if (timesteps.length === 0) return;
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const nextIndex = Math.min(timesteps.length - 1, baseIndex + 10);
        setCurrentTimestep(timesteps[nextIndex]);
    };

    const prevTimestep = () => {
        if (timesteps.length === 0) return;
        const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        setCurrentTimestep(timesteps[nextIndex]);
    };

    const nextTimestep = () => {
        if (timesteps.length === 0) return;
        const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, timesteps.length - 1);
        setCurrentTimestep(timesteps[nextIndex]);
    };

    const handleTogglePlay = () => {
        togglePlay({ trajectoryId, timesteps: availableTimesteps });
    };

    const buttons = useMemo(() => ([
        { Icon: SkipBack, label: 'Jump to start', onClick: jumpToStart },
        { Icon: Rewind, label: 'Back 10 timesteps', onClick: jumpBack10 },
        { Icon: ChevronLeft, label: 'Previous timestep', onClick: prevTimestep },
        { Icon: isPlaying ? Pause : Play, label: isPlaying ? 'Pause' : 'Play', onClick: handleTogglePlay },
        { Icon: ChevronRight, label: 'Next timestep', onClick: nextTimestep },
        { Icon: FastForward, label: 'Forward 10 timesteps', onClick: jumpForward10 },
        { Icon: SkipForward, label: 'Jump to end', onClick: jumpToEnd }
    ]), [isPlaying, handleTogglePlay, jumpToStart, jumpBack10, prevTimestep, nextTimestep, jumpForward10, jumpToEnd]);

    return (
        <Row className="canvas-transport-controls">
            {buttons.map((btn) => (
                <Button
                    key={btn.label}
                    variant="ghost"
                    intent="canvas"
                    size="sm"
                    shape="circle"
                    className="canvas-btn-compact"
                    iconOnly
                    aria-label={btn.label}
                    title={btn.label}
                    onClick={btn.onClick}
                >
                    <btn.Icon style={{ width: 13, height: 13 }} />
                </Button>
            ))}
        </Row>
    );
};

export default TransportControls;
