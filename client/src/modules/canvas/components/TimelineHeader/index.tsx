import FrameCombobox from '../FrameCombobox';
import PresetPopover from './PresetPopover';
import TransportControls from '../TransportControls';

import { Atom, Box as BoxIcon, Gauge, ZoomIn } from 'lucide-react';
import { Button, Divider, Popover, Row, Select, PopoverMenu, PopoverMenuItem } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import type { DownloadPluginListingParams } from '../../hooks/use-download-plugin-listing';
import type { ReactNode } from 'react';

export enum TimelineTab {
    Timeline = 'timeline',
    Particles = 'particles',
    SimulationCell = 'simulation-cell',
    Log = 'log'
}

interface TimelineDownloadContext {
    pluginId?: string;
    analysisId?: string;
    trajectoryId?: string;
}

export interface TimelineTabOption {
    id: string;
    label: string;
    icon?: ReactNode;
    exposureId?: string;
}

interface TimelineHeaderProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    tabs: TimelineTabOption[];
    trajectoryId?: string;
    currentTimestep: number | undefined;
    startFrame: number | undefined;
    endFrame: number | undefined;
    availableTimesteps: number[];
    zoomPercent: number;
    onZoomPreset: (preset: number) => void;
    onRangeStartChange: (value: number | undefined) => void;
    onRangeEndChange: (value: number | undefined) => void;
    playSpeed: number;
    onPlaySpeedChange: (speed: number) => void;
    onDownloadExposureListing?: (params: DownloadPluginListingParams) => void;
    downloadContext: TimelineDownloadContext;
}

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 400];
const SPEED_PRESETS = [0.25, 0.5, 1, 2, 4, 8, 10];

export const CORE_TABS: TimelineTabOption[] = [
    {
        id: TimelineTab.Particles,
        label: 'Particles',
        icon: <Atom style={{
            width: 12,
            height: 12
        }} />
    },
    {
        id: TimelineTab.SimulationCell,
        label: 'Simulation Cell',
        icon: <BoxIcon style={{
            width: 12,
            height: 12
        }} />
    },
    {
        id: TimelineTab.Timeline,
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

const TimelineHeader = ({
    activeTab,
    onTabChange,
    tabs,
    trajectoryId,
    currentTimestep,
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
    const tabSelectOptions: SelectOption[] = tabs.map((tab) => ({
        value: tab.id,
        title: tab.label
    }));

    const renderTab = (tab: TimelineTabOption) => {
        const tabButton = (
            <Button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                variant={activeTab === tab.id ? 'solid' : 'ghost'}
                intent="canvas"
                shape="rounded"
                size="sm"
                className="text-xs canvas-btn-compact"
                onClick={() => onTabChange(tab.id)}
                leftIcon={tab.icon}
            >
                {tab.label}
            </Button>
        );

        const download = tab.exposureId && downloadContext.pluginId && onDownloadExposureListing
            ? {
                exposureId: tab.exposureId,
                pluginId: downloadContext.pluginId,
                run: onDownloadExposureListing
            }
            : undefined;

        if (!download) {
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
                                download.run({
                                    pluginId: download.pluginId,
                                    exposureId: download.exposureId,
                                    analysisId: downloadContext.analysisId,
                                    trajectoryId: downloadContext.trajectoryId,
                                    exposureName: tab.label
                                });
                                close();
                            }}
                        />
                    </PopoverMenu>
                )}
            </Popover>
        );
    };

    return (
        <Row width='max' className="canvas-timeline-header">
            <Row className="canvas-timeline-tabs-region">
                <Row className="canvas-timeline-tabs scrollbar-none" role="tablist" aria-label="Timeline tabs" data-tour-id="canvas-timeline-tabs">
                    {tabs.map(renderTab)}
                </Row>
                <div className="canvas-timeline-tab-select-region" data-tour-id="canvas-timeline-tab-selector">
                    <Select
                        options={tabSelectOptions}
                        value={activeTab}
                        onChange={onTabChange}
                        placeholder="Tab"
                        className="canvas-timeline-tab-select"
                        showSelectionIcon
                        title="Timeline tab"
                        aria-label="Timeline tab"
                    />
                </div>
            </Row>

            <Row className="canvas-timeline-mobile-actions">
                <Row justify='center' className="canvas-timeline-controls-region">
                    <Row justify='center' className="canvas-timeline-controls-center">
                        <TransportControls
                            trajectoryId={trajectoryId}
                            currentTimestep={currentTimestep}
                            availableTimesteps={availableTimesteps}
                        />
                    </Row>
                </Row>

                <Row justify='end' className="canvas-timeline-frame-region">
                    <Row gap='05' justify='end' className="canvas-timeline-frame-info">
                        <FrameCombobox
                            value={startFrame}
                            options={availableTimesteps}
                            onChange={onRangeStartChange}
                            title='Start timestep'
                        />
                        <FrameCombobox
                            value={endFrame}
                            options={availableTimesteps}
                            onChange={onRangeEndChange}
                            title='End timestep'
                        />

                        <Divider orientation='vertical' className='shrink-0' />

                        <PresetPopover
                            id="timeline-speed"
                            icon={<Gauge size={12} />}
                            presets={SPEED_PRESETS}
                            value={playSpeed}
                            suffix="x"
                            onSelect={onPlaySpeedChange}
                        />

                        <PresetPopover
                            id="timeline-zoom"
                            icon={<ZoomIn size={12} />}
                            presets={ZOOM_PRESETS}
                            value={zoomPercent}
                            suffix="%"
                            onSelect={onZoomPreset}
                        />
                    </Row>
                </Row>
            </Row>
        </Row>
    );
};

export default TimelineHeader;
