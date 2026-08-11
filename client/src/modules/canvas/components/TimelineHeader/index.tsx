import CanvasOptionSelect from '../CanvasOptionSelect';
import FrameCombobox from '../FrameCombobox';
import PresetPopover from './PresetPopover';
import TransportControls from '../TransportControls';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import {
    CONTROLS_CENTER_CLASS,
    CONTROLS_REGION_CLASS,
    FRAME_INFO_CLASS,
    FRAME_INFO_COMPACT_INPUT_CLASS,
    FRAME_REGION_CLASS,
    HEADER_CLASS,
    MOBILE_ACTIONS_CLASS,
    TABS_CLASS,
    TABS_REGION_CLASS,
    TAB_SELECT_REGION_CLASS,
    TAB_SELECT_TRIGGER_CLASS
} from '../Timeline/timeline-classes';

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

/**
 * A timeline tab stays a plain `<button>`, not a HeroUI one: `role='tab'` and
 * `aria-selected` are not on `Button`'s closed prop interface (spec §5b.8), and a
 * `role='tablist'` whose children are not tabs is broken ARIA rather than a style
 * choice. The chrome below is bravais's `variant='ghost'|'solid' intent='canvas'
 * size='sm' shape='rounded'` translated by value — `--button-bg` is `--default`,
 * `--hover-bg`/`--active-bg` are `--surface-hover`, and `size-sm`'s own 0.8125rem font
 * size outranked the `text-xs` the call site passed, so 0.8125rem is what rendered.
 */
const TAB_BUTTON_CLASS = 'inline-flex h-[1.875rem] min-h-[2.1rem] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3.5 text-[0.8125rem] font-medium leading-none select-none transition-colors duration-150 ease-out';

const TAB_BUTTON_ACTIVE_CLASS = 'bg-default text-foreground hover:bg-surface-hover';

const TAB_BUTTON_IDLE_CLASS = 'bg-transparent text-muted hover:bg-surface-hover hover:text-foreground';

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
                className={cn(TAB_BUTTON_CLASS, isActive ? TAB_BUTTON_ACTIVE_CLASS : TAB_BUTTON_IDLE_CLASS)}
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

        /*
         * A right-click download menu, so this stays `ContextMenuPopover`: React Aria has
         * no contextmenu trigger, and suppressing the browser menu needs the real
         * `MouseEvent`. The span is the trigger element — it is what receives the cloned
         * `onContextMenu` and `data-popover-trigger` — because HeroUI's `Button` has a
         * closed prop interface and cannot be handed either.
         */
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
        <div className={HEADER_CLASS}>
            <div className={TABS_REGION_CLASS}>
                <div className={TABS_CLASS} role='tablist' aria-label='Timeline tabs' data-tour-id='canvas-timeline-tabs'>
                    {tabs.map(renderTab)}
                </div>
                <div className={TAB_SELECT_REGION_CLASS} data-tour-id='canvas-timeline-tab-selector'>
                    <CanvasOptionSelect
                        ariaLabel='Timeline tab'
                        options={tabSelectOptions}
                        value={activeTab}
                        onChange={onTabChange}
                        placeholder='Tab'
                        triggerClassName={TAB_SELECT_TRIGGER_CLASS}
                    />
                </div>
            </div>

            <div className={MOBILE_ACTIONS_CLASS}>
                <div className={CONTROLS_REGION_CLASS}>
                    <div className={CONTROLS_CENTER_CLASS}>
                        <TransportControls
                            trajectoryId={trajectoryId}
                            currentTimestep={currentTimestep}
                            availableTimesteps={availableTimesteps}
                        />
                    </div>
                </div>

                <div className={FRAME_REGION_CLASS}>
                    <div className={FRAME_INFO_CLASS}>
                        <FrameCombobox
                            value={startFrame}
                            options={availableTimesteps}
                            onChange={onRangeStartChange}
                            title='Start timestep'
                            groupClassName={FRAME_INFO_COMPACT_INPUT_CLASS}
                        />
                        <FrameCombobox
                            value={endFrame}
                            options={availableTimesteps}
                            onChange={onRangeEndChange}
                            title='End timestep'
                            groupClassName={FRAME_INFO_COMPACT_INPUT_CLASS}
                        />

                        {/* `.canvas-timeline-frame-info .volt-divider { display: none }` under 768px. */}
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
