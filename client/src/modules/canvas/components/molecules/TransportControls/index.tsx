import { useEditorStore } from '@/modules/canvas/stores/editor';

import { SkipBack, Rewind, Play, FastForward, SkipForward, Pause } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';

import './TransportControls.css';

const TransportControls = () => {
    const {
        timestepData,
        currentTimestep,
        isPlaying,
        togglePlay,
        setCurrentTimestep
    } = useEditorStore(useShallow((state) => ({
        timestepData: state.timestepData,
        currentTimestep: state.currentTimestep,
        isPlaying: state.isPlaying,
        togglePlay: state.togglePlay,
        setCurrentTimestep: state.setCurrentTimestep
    })));

    const timesteps = timestepData.timesteps;
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

    const buttons = useMemo(() => ([
        { Icon: SkipBack, label: 'Jump to start', onClick: jumpToStart },
        { Icon: Rewind, label: 'Previous frame', onClick: prevFrame },
        { Icon: isPlaying ? Pause : Play, label: isPlaying ? 'Pause' : 'Play', onClick: togglePlay },
        { Icon: FastForward, label: 'Next frame', onClick: nextFrame },
        { Icon: SkipForward, label: 'Jump to end', onClick: jumpToEnd }
    ]), [isPlaying, togglePlay, jumpToStart, prevFrame, nextFrame, jumpToEnd]);

    return (
        <Container className="canvas-transport-controls d-flex items-center">
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
        </Container>
    );
};

export default TransportControls;
