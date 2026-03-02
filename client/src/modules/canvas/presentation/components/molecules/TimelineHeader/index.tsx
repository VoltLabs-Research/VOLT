import type { ReactNode } from 'react';
import { ZoomIn, Gauge, Atom, Box } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import Tooltip from '@/shared/presentation/components/Tooltip';
import TransportControls from '../TransportControls';
import FrameCombobox from '../FrameCombobox';

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 400];
const SPEED_PRESETS = [0.25, 0.5, 1, 2, 4, 8, 10];

type TimelineTab = 'timeline' | 'particles' | 'simulation-cell';

export interface TimelineTabOption {
    id: string;
    label: string;
    icon?: ReactNode;
    exposureId?: string;
}

const CORE_TABS: TimelineTabOption[] = [
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
    activeTab: string;
    onTabChange: (tab: string) => void;
    tabs?: TimelineTabOption[];
    startFrame: number;
    endFrame: number;
    availableTimesteps: number[];
    zoomPercent: number;
    onZoomPreset: (preset: number) => void;
    onRangeStartChange: (value: number | undefined) => void;
    onRangeEndChange: (value: number | undefined) => void;
    playSpeed: number;
    onPlaySpeedChange: (speed: number) => void;
    onDownloadExposureListing?: (params: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        exposureName?: string;
    }) => void;
    downloadContext?: {
        pluginId?: string;
        analysisId?: string;
        trajectoryId?: string;
    };
}

const TimelineHeader = ({
    activeTab,
    onTabChange,
    tabs,
    startFrame,
    endFrame,
    availableTimesteps,
    zoomPercent,
    onZoomPreset,
    onRangeStartChange,
    onRangeEndChange,
    playSpeed,
    onPlaySpeedChange,
    onDownloadExposureListing,
    downloadContext
}: TimelineHeaderProps) => {
    const resolvedTabs = tabs?.length ? tabs : CORE_TABS;

    return (
        <Container className="canvas-timeline-header d-flex items-center w-max">
            <Container className="canvas-timeline-tabs-region d-flex items-center">
                <Container className="canvas-timeline-tabs scrollbar-none d-flex items-center" role="tablist" aria-label="Timeline tabs">
                    {resolvedTabs.map((tab) => {
                        const canDownloadExposure = Boolean(
                            tab.exposureId &&
                            downloadContext?.pluginId &&
                            onDownloadExposureListing
                        );

                        const tabButton = (
                            <Button
                                key={tab.id}
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                variant={activeTab === tab.id ? 'solid' : 'ghost'}
                                intent="canvas"
                                shape="rounded"
                                size="sm"
                                className="font-size-05 canvas-btn-compact"
                                onClick={() => onTabChange(tab.id)}
                                leftIcon={tab.icon}
                            >
                                {tab.label}
                            </Button>
                        );

                        if (!canDownloadExposure) {
                            return tabButton;
                        }

                        return (
                            <Popover
                                key={`exposure-tab-popover-${tab.id}`}
                                id={`timeline-tab-download-${tab.id}`}
                                triggerAction="contextmenu"
                                trigger={tabButton}
                            >
                                {(close) => (
                                    <PopoverMenu>
                                        <PopoverMenuItem
                                            label="Download"
                                            onClick={() => {
                                                onDownloadExposureListing?.({
                                                    pluginId: downloadContext?.pluginId || '',
                                                    exposureId: tab.exposureId || '',
                                                    analysisId: downloadContext?.analysisId,
                                                    trajectoryId: downloadContext?.trajectoryId,
                                                    exposureName: tab.label
                                                });
                                                close();
                                            }}
                                        />
                                    </PopoverMenu>
                                )}
                            </Popover>
                        );
                    })}
                </Container>
            </Container>

            <Container className="canvas-timeline-controls-region d-flex items-center content-center">
                <Container className="canvas-timeline-controls-center d-flex items-center content-center">
                    <TransportControls />
                </Container>
            </Container>

            <Container className="canvas-timeline-frame-region d-flex items-center content-end">
                <Container className="canvas-timeline-frame-info d-flex items-center gap-05 content-end">
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
                        id="timeline-speed"
                        noPadding
                        trigger={(
                            <Button
                                variant="ghost"
                                intent="canvas"
                                shape="rounded"
                                size="sm"
                                className="font-size-05 canvas-btn-compact"
                                leftIcon={<Gauge size={12} />}
                            >
                                {playSpeed}x
                            </Button>
                        )}
                    >
                        {(close) => (
                            <PopoverMenu>
                                {SPEED_PRESETS.map((preset) => (
                                    <Button
                                        key={preset}
                                        variant={preset === playSpeed ? 'solid' : 'ghost'}
                                        intent="canvas"
                                        shape="rounded"
                                        size="sm"
                                        className="font-size-05"
                                        block
                                        align="start"
                                        onClick={() => { onPlaySpeedChange(preset); close(); }}
                                    >
                                        {preset}x
                                    </Button>
                                ))}
                            </PopoverMenu>
                        )}
                    </Popover>

                    <Popover
                        id="timeline-zoom"
                        noPadding
                        trigger={(
                            <Button
                                variant="ghost"
                                intent="canvas"
                                shape="rounded"
                                size="sm"
                                className="font-size-05 canvas-btn-compact"
                                leftIcon={<ZoomIn size={12} />}
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
                                        shape="rounded"
                                        size="sm"
                                        className="font-size-05"
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
            </Container>
        </Container>
    );
};

export type { TimelineTab };
export { CORE_TABS };
export default TimelineHeader;
