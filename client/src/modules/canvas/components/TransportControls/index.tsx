import { useEditorStore } from '@/modules/canvas/stores/editor';
import { resolveRangedTimesteps } from '@/modules/canvas/utilities/timeline-range';

import { SkipBack, Rewind, Play, FastForward, SkipForward, Pause } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/shared/presentation/components/Button';
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

    const prevFrame = () => {
        if (timesteps.length === 0) return;
        const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        setCurrentTimestep(timesteps[nextIndex]);
    };

    const nextFrame = () => {
        if (timesteps.length === 0) return;
        const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, timesteps.length - 1);
        setCurrentTimestep(timesteps[nextIndex]);
    };

    const handleTogglePlay = () => {
        togglePlay({ trajectoryId, timesteps: availableTimesteps });
    };

    const buttons = useMemo(() => ([
        { Icon: SkipBack, label: 'Jump to start', onClick: jumpToStart },
        { Icon: Rewind, label: 'Previous frame', onClick: prevFrame },
        { Icon: isPlaying ? Pause : Play, label: isPlaying ? 'Pause' : 'Play', onClick: handleTogglePlay },
        { Icon: FastForward, label: 'Next frame', onClick: nextFrame },
        { Icon: SkipForward, label: 'Jump to end', onClick: jumpToEnd }
    ]), [isPlaying, handleTogglePlay, jumpToStart, prevFrame, nextFrame, jumpToEnd]);

    return (
        <div className="volt-container canvas-transport-controls d-flex items-center">
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
        </div>
    );
};

export default TransportControls;
