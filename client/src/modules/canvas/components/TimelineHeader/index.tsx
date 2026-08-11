import CanvasOptionSelect from '../CanvasOptionSelect';
import FrameCombobox from '../FrameCombobox';
import PresetPopover from './PresetPopover';
import TransportControls from '../TransportControls';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';

import { Atom, Box as BoxIcon, Gauge, ZoomIn } from 'lucide-react';
import { Separator, cn } from '@heroui/react';
import type { SelectOption } from '@/modules/canvas/contracts/select-option';
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
            <svg width='12' height='12' viewBox='0 0 14 14' fill='none'>
                <rect x='1' y='3.5' width='12' height='7' rx='1.5' stroke='currentColor' strokeWidth='1' fill='none' />
                <line x1='5' y1='3.5' x2='5' y2='10.5' stroke='currentColor' strokeWidth='0.6' opacity='0.5' />
                <line x1='9' y1='3.5' x2='9' y2='10.5' stroke='currentColor' strokeWidth='0.6' opacity='0.5' />
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

    const renderTabButton = (tab: TimelineTabOption) => {
        const isActive = activeTab === tab.id;

        return (
            <button
                type='button'
                role='tab'
                aria-selected={isActive}
                className={cn(
                    'inline-flex h-[1.875rem] min-h-[2.1rem] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3.5 text-[0.8125rem] font-medium leading-none select-none transition-colors duration-150 ease-out',
                    isActive ? 'bg-default text-foreground hover:bg-surface-hover' : 'bg-transparent text-muted hover:bg-surface-hover hover:text-foreground'
                )}
                onClick={() => onTabChange(tab.id)}
            >
                {tab.icon}
                {tab.label}
            </button>
        );
    };

    const renderTab = (tab: TimelineTabOption) => {
        const download = tab.exposureId && downloadContext.pluginId && onDownloadExposureListing
            ? {
                exposureId: tab.exposureId,
                pluginId: downloadContext.pluginId,
                run: onDownloadExposureListing
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
                    onClick: () => {
                        download.run({
                            pluginId: download.pluginId,
                            exposureId: download.exposureId,
                            analysisId: downloadContext.analysisId,
                            trajectoryId: downloadContext.trajectoryId,
                            exposureName: tab.label
                        });
                    }
                }]}
            />
        );
    };

    return (
        <div className='relative flex w-full flex-row items-center px-2 py-1 h-10 max-[900px]:h-auto max-[900px]:min-h-10 max-[900px]:flex-wrap max-[900px]:gap-2 max-md:contents max-md:h-auto max-md:min-h-0 max-md:p-0'>
            <div className='flex min-w-0 flex-auto flex-row items-center max-[900px]:flex-[1_1_100%] max-md:pointer-events-none max-md:order-1 max-md:w-full max-md:flex-none max-md:self-stretch'>
                <div className='flex flex-[0_1_auto] flex-row flex-nowrap items-center overflow-x-auto overflow-y-hidden whitespace-nowrap max-w-[min(55vw,500px)] max-[900px]:max-w-full max-md:hidden [&>*]:shrink-0 [mask-image:linear-gradient(to_right,transparent_0,black_14px,black_calc(100%_-_14px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_14px,black_calc(100%_-_14px),transparent_100%)]' role='tablist' aria-label='Timeline tabs' data-tour-id='canvas-timeline-tabs'>
                    {tabs.map(renderTab)}
                </div>
                <div className='hidden max-md:block max-md:overflow-hidden max-md:rounded-xl max-md:bg-surface-secondary max-md:pointer-events-auto' data-tour-id='canvas-timeline-tab-selector'>
                    <CanvasOptionSelect
                        ariaLabel='Timeline tab'
                        options={tabSelectOptions}
                        value={activeTab}
                        onChange={onTabChange}
                        placeholder='Tab'
                        triggerClassName='max-md:pointer-events-auto max-md:h-auto max-md:min-h-[1.875rem] max-md:w-full max-md:rounded-[inherit] max-md:border-transparent max-md:bg-inherit max-md:px-2 max-md:py-1 max-md:text-[0.6875rem]'
                    />
                </div>
            </div>
            <div className='contents max-md:order-3 max-md:flex max-md:w-full max-md:flex-none max-md:items-center max-md:justify-between max-md:gap-2 max-md:self-stretch max-md:pointer-events-none max-md:[&_button]:pointer-events-auto max-md:[&_input]:pointer-events-auto max-md:[&_select]:pointer-events-auto max-md:[&_[role=button]]:pointer-events-auto max-md:[&_[data-popover-trigger]]:pointer-events-auto'>
                <div className='pointer-events-none absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-row items-center justify-center px-1.5 max-[900px]:static max-[900px]:order-3 max-[900px]:w-full max-[900px]:transform-none max-[900px]:justify-center max-[900px]:p-0 max-md:w-auto max-md:flex-none max-md:justify-start max-md:rounded-xl max-md:border-0 max-md:bg-surface-secondary'>
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
                            groupClassName='max-md:h-[1.875rem] max-md:min-h-[1.875rem] max-md:w-[clamp(3.25rem,17vw,4.5rem)] max-md:rounded-xl max-md:bg-surface-secondary max-md:text-[0.625rem]'
                        />
                        <FrameCombobox
                            value={endFrame}
                            options={availableTimesteps}
                            onChange={onRangeEndChange}
                            title='End timestep'
                            groupClassName='max-md:h-[1.875rem] max-md:min-h-[1.875rem] max-md:w-[clamp(3.25rem,17vw,4.5rem)] max-md:rounded-xl max-md:bg-surface-secondary max-md:text-[0.625rem]'
                        />
                        <Separator orientation='vertical' className='h-4 shrink-0 max-md:hidden' />
                        <PresetPopover
                            id='timeline-speed'
                            icon={<Gauge size={12} />}
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
