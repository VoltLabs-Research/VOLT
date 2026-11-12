import CanvasOptionSelect from '../CanvasOptionSelect';
import FrameCombobox from '../FrameCombobox';
import PresetPopover from './PresetPopover';
import TransportControls from '../TransportControls';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import useDownloadExposureListing from '../../hooks/use-download-exposure-listing';

import { ChevronDown, ZoomIn } from 'lucide-react';
import {
    DropdownItem,
    DropdownItemIndicator,
    DropdownMenu,
    DropdownPopover,
    DropdownRoot,
    DropdownSection,
    DropdownTrigger,
    Header,
    Separator,
    cn
} from '@heroui/react';
import type { SelectOption } from '@/shared/contracts/form-field';
import type { ReactNode } from 'react';
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
    // The plugin the outputs come from, as the outputs menu titles them.
    outputsTitle?: string;
}

const tabClassName = (isActive: boolean) => cn(
    'inline-flex h-7 min-h-7 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-0 px-2.5 text-xs font-medium leading-none select-none transition-colors duration-[140ms] ease-out',
    isActive ? 'bg-foreground/[0.08] text-foreground' : 'bg-transparent text-muted hover:bg-foreground/5 hover:text-foreground'
);

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
    downloadContext,
    outputsTitle
}: TimelineHeaderProps) => {
    const { download: downloadExposureListing } = useDownloadExposureListing();
    const tabSelectOptions: SelectOption[] = tabs.map((tab) => ({
        value: tab.id,
        title: tab.label
    }));

    // Particles, Simulation Cell, Timeline and Log stay tabs. A plugin's outputs share one tab with a menu,
    // so a plugin with many listings no longer pushes the row past its column; a lone output stays a tab.
    const outputTabs = tabs.filter((tab) => tab.exposureId);
    const groupsOutputs = outputTabs.length > 1;
    const plainTabs = groupsOutputs ? tabs.filter((tab) => !tab.exposureId) : tabs;
    const activeOutput = outputTabs.find((tab) => tab.id === activeTab);

    // Right-click downloads an output's listing.
    const withDownload = (tab: TimelineTabOption | undefined, trigger: ReactNode, key: string) => {
        const exposureId = tab?.exposureId;
        const pluginId = downloadContext.pluginId;
        if (!tab || !exposureId || !pluginId) {
            return <span key={key} className='inline-flex'>{trigger}</span>;
        }

        return (
            <ContextMenuPopover
                key={`exposure-tab-popover-${tab.id}`}
                id={`timeline-tab-download-${tab.id}`}
                triggerAction='contextmenu'
                ariaLabel={`${tab.label} actions`}
                menuLabel={`${tab.label} actions`}
                size='sm'
                trigger={<span className='inline-flex'>{trigger}</span>}
                options={[{
                    label: 'Download',
                    onClick: () => void downloadExposureListing({
                        pluginId,
                        exposureId,
                        analysisId: downloadContext.analysisId,
                        trajectoryId: downloadContext.trajectoryId,
                        exposureName: tab.label
                    })
                }]}
            />
        );
    };

    const renderTab = (tab: TimelineTabOption) => withDownload(tab.exposureId ? tab : undefined, (
        <button
            type='button'
            role='tab'
            aria-selected={activeTab === tab.id}
            className={tabClassName(activeTab === tab.id)}
            onClick={() => onTabChange(tab.id)}
        >
            {tab.label}
        </button>
    ), tab.id);

    const renderOutputsTab = () => {
        if (!groupsOutputs) return null;

        const menu = (
            <DropdownRoot>
                <DropdownTrigger
                    // One focus ring, the tabs' own: .timeline-tabs draws it inside the pill.
                    className={cn(tabClassName(Boolean(activeOutput)), 'max-w-52 gap-1 pr-2 data-[focus-visible=true]:ring-0')}
                    aria-label={activeOutput ? `${activeOutput.label}, outputs` : 'Outputs'}
                >
                    <span className='min-w-0 truncate'>{activeOutput?.label ?? 'Outputs'}</span>
                    <ChevronDown size={11} className='shrink-0 opacity-70' aria-hidden='true' />
                </DropdownTrigger>
                <DropdownPopover placement='bottom start'>
                    <DropdownMenu
                        aria-label={outputsTitle ?? 'Outputs'}
                        className='p-1.5 pt-1'
                        selectionMode='single'
                        disallowEmptySelection
                        selectedKeys={activeOutput ? [activeOutput.id] : []}
                        onSelectionChange={(keys) => {
                            const key = keys === 'all' ? undefined : [...keys][0];
                            if (key !== undefined) onTabChange(String(key));
                        }}
                    >
                        <DropdownSection id='timeline-outputs'>
                            {outputsTitle ? <Header className='px-2.5 pb-0.5 pt-2 text-2xs'>{outputsTitle}</Header> : null}
                            {outputTabs.map((tab) => (
                                <DropdownItem
                                    key={tab.id}
                                    id={tab.id}
                                    textValue={tab.label}
                                    className='min-h-7 px-2.5 py-1 text-xs data-[focused=true]:bg-default data-[focus-visible=true]:ring-0 data-[focus-visible=true]:ring-offset-0'
                                >
                                    <DropdownItemIndicator type='checkmark' />
                                    {tab.label}
                                </DropdownItem>
                            ))}
                        </DropdownSection>
                    </DropdownMenu>
                </DropdownPopover>
            </DropdownRoot>
        );

        // The open output downloads from here, as it did from its own tab.
        return withDownload(activeOutput, menu, 'timeline-outputs');
    };

    return (
        // Laid out by its own width, not the window's: docked beside the right panel, it is narrower than the window.
        <div className='@container w-full max-md:contents'>
            <div className='grid h-10 w-full grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 px-2 py-1 @max-[800px]:flex @max-[800px]:h-auto @max-[800px]:min-h-10 @max-[800px]:flex-wrap max-md:contents max-md:h-auto max-md:min-h-0 max-md:p-0'>
                <div className='flex min-w-0 flex-row items-center @max-[800px]:flex-[1_1_100%] max-md:pointer-events-none max-md:order-1 max-md:w-full max-md:flex-none max-md:self-stretch'>
                    <Scrollable orientation='horizontal' className='timeline-tabs flex flex-[0_1_auto] flex-row flex-nowrap items-center overflow-y-hidden whitespace-nowrap max-md:hidden [&>*]:shrink-0' role='tablist' aria-label='Timeline tabs' data-tour-id='canvas-timeline-tabs'>
                        {plainTabs.map(renderTab)}
                        {renderOutputsTab()}
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
                    <div className='pointer-events-none flex flex-row items-center justify-center px-1.5 @max-[800px]:order-3 @max-[800px]:w-full @max-[800px]:p-0 max-md:order-3 max-md:w-auto max-md:flex-none max-md:justify-start max-md:p-0'>
                        <div className='pointer-events-auto flex w-max flex-row items-center justify-center @max-[800px]:w-full max-md:contents max-md:w-auto'>
                            <TransportControls
                                trajectoryId={trajectoryId}
                                currentTimestep={currentTimestep}
                                availableTimesteps={availableTimesteps}
                            />
                        </div>
                    </div>
                    <div className='flex min-w-0 flex-row items-center justify-end @max-[800px]:flex-[1_1_100%] @max-[800px]:justify-start max-md:pointer-events-none max-md:w-auto max-md:flex-none max-md:justify-start'>
                        <div className='flex min-w-0 flex-[0_1_auto] flex-row items-center justify-end gap-2 @max-[800px]:flex-wrap @max-[800px]:justify-start max-md:pointer-events-none max-md:flex-nowrap max-md:justify-start max-md:gap-1 max-md:overflow-hidden'>
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
                            {/* No icon: FastForward is the Forward 10 timesteps button's. */}
                            <PresetPopover
                                id='timeline-speed'
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
        </div>
    );
};

export default TimelineHeader;
