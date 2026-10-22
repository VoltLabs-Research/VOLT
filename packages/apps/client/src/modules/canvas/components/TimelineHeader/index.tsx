import CanvasOptionSelect from '../CanvasOptionSelect';
import FrameCombobox from '../FrameCombobox';
import PresetPopover from './PresetPopover';
import TransportControls from '../TransportControls';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import useDownloadExposureListing from '../../hooks/use-download-exposure-listing';

import { FastForward, ZoomIn } from 'lucide-react';
import { Separator, cn } from '@heroui/react';
import type { SelectOption } from '@/shared/contracts/form-field';
import Scrollable from '@/shared/ui/components/Scrollable';

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
    downloadContext: TimelineDownloadContext;
}

// Wide enough on phones for a seven-digit timestep beside the list trigger.
const MOBILE_FRAME_GROUP = 'max-md:w-[clamp(4.75rem,24vw,5.75rem)] max-md:[&_input]:pl-2.5';

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 400];
const SPEED_PRESETS = [0.25, 0.5, 1, 2, 4, 8, 10];

export const CORE_TABS: TimelineTabOption[] = [
    {
        id: TimelineTab.Particles,
        label: 'Particles'
    },
    {
        id: TimelineTab.SimulationCell,
        label: 'Simulation Cell'
    },
    {
        id: TimelineTab.Timeline,
        label: 'Timeline'
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
    downloadContext
}: TimelineHeaderProps) => {
    const { download: downloadExposureListing } = useDownloadExposureListing();
    const tabSelectOptions: SelectOption[] = tabs.map((tab) => ({
        value: tab.id,
        title: tab.label
    }));

    const renderTabButton = (tab: TimelineTabOption) => {
        const isActive = activeTab === tab.id;

        return (
            <button
                type='button'
                role='tab'
                aria-selected={isActive}
                className={cn(
                    'inline-flex h-7 min-h-7 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-0 px-2.5 text-xs font-medium leading-none select-none transition-colors duration-[140ms] ease-out',
                    isActive ? 'bg-foreground/[0.08] text-foreground' : 'bg-transparent text-muted hover:bg-foreground/5 hover:text-foreground'
                )}
                onClick={() => onTabChange(tab.id)}
            >
                {tab.label}
            </button>
        );
    };

    const renderTab = (tab: TimelineTabOption) => {
        const download = tab.exposureId && downloadContext.pluginId
            ? {
                exposureId: tab.exposureId,
                pluginId: downloadContext.pluginId
            }
            : undefined;

        if (!download) {
            return <span key={tab.id} className='inline-flex'>{renderTabButton(tab)}</span>;
        }

        return (
            <ContextMenuPopover
                key={`exposure-tab-popover-${tab.id}`}
                id={`timeline-tab-download-${tab.id}`}
                triggerAction='contextmenu'
                ariaLabel={`${tab.label} actions`}
                menuLabel={`${tab.label} actions`}
                size='sm'
                trigger={<span className='inline-flex'>{renderTabButton(tab)}</span>}
                options={[{
                    label: 'Download',
                    onClick: () => void downloadExposureListing({
                        pluginId: download.pluginId,
                        exposureId: download.exposureId,
                        analysisId: downloadContext.analysisId,
                        trajectoryId: downloadContext.trajectoryId,
                        exposureName: tab.label
                    })
                }]}
            />
        );
    };

    return (
        <div className='relative flex w-full flex-row items-center px-2 py-1 h-10 max-[900px]:h-auto max-[900px]:min-h-10 max-[900px]:flex-wrap max-[900px]:gap-2 max-md:contents max-md:h-auto max-md:min-h-0 max-md:p-0'>
            <div className='flex min-w-0 flex-auto flex-row items-center max-[900px]:flex-[1_1_100%] max-md:pointer-events-none max-md:order-1 max-md:w-full max-md:flex-none max-md:self-stretch'>
                <Scrollable orientation='horizontal' className='flex flex-[0_1_auto] flex-row flex-nowrap items-center overflow-y-hidden whitespace-nowrap max-w-[min(55vw,500px)] max-[900px]:max-w-full max-md:hidden [&>*]:shrink-0 [mask-image:linear-gradient(to_right,transparent_0,black_14px,black_calc(100%_-_14px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_14px,black_calc(100%_-_14px),transparent_100%)]' role='tablist' aria-label='Timeline tabs' data-tour-id='canvas-timeline-tabs'>
                    {tabs.map(renderTab)}
                </Scrollable>
                <div className='hidden max-md:pointer-events-auto max-md:block max-md:w-full max-md:overflow-hidden max-md:rounded-full max-md:bg-foreground/[0.06]' data-tour-id='canvas-timeline-tab-selector'>
                    <CanvasOptionSelect
                        ariaLabel='Timeline tab'
                        options={tabSelectOptions}
                        value={activeTab}
                        onChange={onTabChange}
                        placeholder='Tab'
                        triggerClassName='max-md:pointer-events-auto max-md:h-8 max-md:min-h-8 max-md:w-full max-md:rounded-full max-md:border-transparent max-md:bg-transparent max-md:py-0 max-md:pl-3'
                    />
                </div>
            </div>
            <div className='contents max-md:order-3 max-md:flex max-md:w-full max-md:flex-none max-md:items-center max-md:justify-between max-md:gap-2 max-md:self-stretch max-md:pointer-events-none max-md:[&_button]:pointer-events-auto max-md:[&_input]:pointer-events-auto max-md:[&_select]:pointer-events-auto max-md:[&_[role=button]]:pointer-events-auto max-md:[&_[data-popover-trigger]]:pointer-events-auto'>
                <div className='pointer-events-none absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-row items-center justify-center px-1.5 max-[900px]:static max-[900px]:order-3 max-[900px]:w-full max-[900px]:transform-none max-[900px]:justify-center max-[900px]:p-0 max-md:w-auto max-md:flex-none max-md:justify-start'>
                    <div className='pointer-events-auto flex w-max flex-row items-center justify-center max-[900px]:w-full max-md:contents max-md:w-auto'>
                        <TransportControls
                            trajectoryId={trajectoryId}
                            currentTimestep={currentTimestep}
                            availableTimesteps={availableTimesteps}
                        />
                    </div>
                </div>
                <div className='flex min-w-0 flex-auto flex-row items-center justify-end max-[900px]:flex-[1_1_100%] max-[900px]:justify-start max-md:pointer-events-none max-md:w-auto max-md:flex-none max-md:justify-start'>
                    <div className='flex min-w-0 flex-[0_1_auto] flex-row items-center justify-end gap-2 max-[900px]:flex-wrap max-[900px]:justify-start max-md:pointer-events-none max-md:flex-nowrap max-md:gap-1 max-md:overflow-hidden'>
                        <FrameCombobox
                            value={startFrame}
                            options={availableTimesteps}
                            onChange={onRangeStartChange}
                            title='Start timestep'
                            groupClassName={MOBILE_FRAME_GROUP}
                        />
                        <FrameCombobox
                            value={endFrame}
                            options={availableTimesteps}
                            onChange={onRangeEndChange}
                            title='End timestep'
                            groupClassName={MOBILE_FRAME_GROUP}
                        />
                        <Separator orientation='vertical' className='h-4 shrink-0 max-md:hidden' />
                        <PresetPopover
                            id='timeline-speed'
                            icon={<FastForward size={12} />}
                            presets={SPEED_PRESETS}
                            value={playSpeed}
                            suffix='x'
                            onSelect={onPlaySpeedChange}
                        />
                        <PresetPopover
                            id='timeline-zoom'
                            icon={<ZoomIn size={12} />}
                            presets={ZOOM_PRESETS}
                            value={zoomPercent}
                            suffix='%'
                            onSelect={onZoomPreset}
                            hideOnMobile
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimelineHeader;
