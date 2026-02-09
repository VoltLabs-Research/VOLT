import type { ReactNode } from 'react';
import { ZoomIn, Atom, Box } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import TransportControls from '../TransportControls';
import FrameCombobox from '../FrameCombobox';

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 400];

type TimelineTab = 'timeline' | 'particles' | 'simulation-cell';

const TABS: { id: TimelineTab; label: string; icon: ReactNode }[] = [
    { id: 'particles', label: 'Particles', icon: <Atom style={{ width: 12, height: 12 }} /> },
    { id: 'simulation-cell', label: 'Simulation Cell', icon: <Box style={{ width: 12, height: 12 }} /> },
    {
        id: 'timeline',
        label: 'Timeline',
        icon: (
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3.5" width="12" height="7" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
                <line x1="5" y1="3.5" x2="5" y2="10.5" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
                <line x1="9" y1="3.5" x2="9" y2="10.5" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
            </svg>
        )
    }
];

interface TimelineHeaderProps {
    activeTab: TimelineTab;
    onTabChange: (tab: TimelineTab) => void;
    startFrame: number;
    endFrame: number;
    availableTimesteps: number[];
    zoomPercent: number;
    onZoomPreset: (preset: number) => void;
    onRangeStartChange: (value: number | undefined) => void;
    onRangeEndChange: (value: number | undefined) => void;
}

const TimelineHeader = ({
    activeTab,
    onTabChange,
    startFrame,
    endFrame,
    availableTimesteps,
    zoomPercent,
    onZoomPreset,
    onRangeStartChange,
    onRangeEndChange
}: TimelineHeaderProps) => {
    const isTimelineTab = activeTab === 'timeline';

    return (
        <Container className="canvas-timeline-header d-flex items-center p-05 w-max">
            <Container className="canvas-timeline-tabs d-flex items-center gap-05 flex-1" role="tablist" aria-label="Timeline tabs">
                {TABS.map((tab) => (
                    <Button
                        key={tab.id}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        variant={activeTab === tab.id ? 'solid' : 'ghost'}
                        intent="canvas"
                        shape="square"
                        size="sm"
                        onClick={() => onTabChange(tab.id)}
                        title={tab.label}
                        leftIcon={tab.icon}
                    >
                        {tab.label}
                    </Button>
                ))}
            </Container>

            {isTimelineTab && (
                <>
                    <Container className="d-flex items-center content-center">
                        <TransportControls />
                    </Container>

                    <Container className="canvas-timeline-frame-info d-flex items-center gap-05 flex-1 content-end">
                        {[
                            { value: startFrame, onChange: onRangeStartChange, title: 'Start frame' },
                            { value: endFrame, onChange: onRangeEndChange, title: 'End frame' }
                        ].map((frame) => (
                            <FrameCombobox
                                key={frame.title}
                                value={frame.value}
                                options={availableTimesteps}
                                onChange={frame.onChange}
                                title={frame.title}
                            />
                        ))}

                        <Container className="canvas-viewport-divider f-shrink-0" />

                        <Popover
                            id="timeline-zoom"
                            noPadding
                            trigger={(
                                <Button
                                    variant="ghost"
                                    intent="canvas"
                                    shape="square"
                                    size="sm"
                                    leftIcon={<ZoomIn size={12} />}
                                    title="Zoom level"
                                >
                                    {zoomPercent}%
                                </Button>
                            )}
                        >
                            {(close) => (
                                <PopoverMenu>
                                    {ZOOM_PRESETS.map((preset) => (
                                        <Button
                                            key={preset}
                                            variant={preset === zoomPercent ? 'solid' : 'ghost'}
                                            intent="canvas"
                                            shape="square"
                                            size="sm"
                                            block
                                            align="start"
                                            onClick={() => { onZoomPreset(preset); close(); }}
                                        >
                                            {preset}%
                                        </Button>
                                    ))}
                                </PopoverMenu>
                            )}
                        </Popover>
                    </Container>
                </>
            )}
        </Container>
    );
};

export type { TimelineTab };
export default TimelineHeader;
