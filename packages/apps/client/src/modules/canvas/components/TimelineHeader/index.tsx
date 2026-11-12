import CanvasOptionSelect from '../CanvasOptionSelect';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import Scrollable from '@/shared/ui/components/Scrollable';
import useDownloadExposureListing from '../../hooks/use-download-exposure-listing';
import useTabIndicator from './use-tab-indicator';

import { ChevronDown } from 'lucide-react';
import {
    Button,
    DropdownItem,
    DropdownItemIndicator,
    DropdownMenu,
    DropdownPopover,
    DropdownRoot,
    DropdownSection,
    DropdownTrigger,
    Header,
    cn
} from '@heroui/react';
import { useRef } from 'react';
import type { SelectOption } from '@/shared/contracts/form-field';
import type { ReactNode } from 'react';

export enum TimelineTab {
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
    // The open tab; null while the panel is closed and only the ruler shows.
    activeTab: string | null;
    tabs: TimelineTabOption[];
    // A tab opens the panel on itself, or closes it when it is the open one.
    onTabPress: (tab: string) => void;
    onTabSelect: (tab: string) => void;
    onTogglePanel: () => void;
    panelId: string;
    downloadContext: TimelineDownloadContext;
    // The plugin the outputs come from, as the outputs menu titles them.
    outputsTitle?: string;
}

// The open tab's fill is the sliding pill (useTabIndicator), so a tab itself only changes colour.
const tabClassName = (isActive: boolean) => cn(
    'relative z-[1] inline-flex h-6 min-h-6 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-0 bg-transparent px-3 text-xs font-medium leading-none select-none transition-colors duration-200 ease-out',
    isActive ? 'text-foreground' : 'text-muted hover:text-foreground'
);

export const CORE_TABS: TimelineTabOption[] = [
    {
        id: TimelineTab.Particles,
        label: 'Particles'
    },
    {
        id: TimelineTab.SimulationCell,
        label: 'Simulation Cell'
    }
];

const TimelineHeader = ({
    activeTab,
    tabs,
    onTabPress,
    onTabSelect,
    onTogglePanel,
    panelId,
    downloadContext,
    outputsTitle
}: TimelineHeaderProps) => {
    const { download: downloadExposureListing } = useDownloadExposureListing();
    const tablistRef = useRef<HTMLDivElement>(null);
    const indicatorStyle = useTabIndicator(tablistRef, activeTab);
    const isPanelOpen = activeTab !== null;
    const tabSelectOptions: SelectOption[] = tabs.map((tab) => ({
        value: tab.id,
        title: tab.label
    }));

    // Particles, Simulation Cell and Log stay tabs. A plugin's outputs share one tab with a menu,
    // so a plugin with many listings no longer pushes the row past its column; a lone output stays a tab.
    const outputTabs = tabs.filter((tab) => tab.exposureId);
    const groupsOutputs = outputTabs.length > 1;
    const plainTabs = groupsOutputs ? tabs.filter((tab) => !tab.exposureId) : tabs;
    const activeOutput = outputTabs.find((tab) => tab.id === activeTab);

    // Right-click downloads an output's listing.
    const withDownload = (tab: TimelineTabOption | undefined, trigger: ReactNode) => {
        const exposureId = tab?.exposureId;
        const pluginId = downloadContext.pluginId;
        if (!tab || !exposureId || !pluginId) return trigger;

        return (
            <ContextMenuPopover
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

    // Each tab sits in a slot of the tab list, which draws the hairlines between slots and finds the open one.
    const tabSlot = (key: string, isActive: boolean, content: ReactNode) => (
        <span key={key} className='relative inline-flex' data-timeline-tab='' data-timeline-tab-active={isActive || undefined}>
            {content}
        </span>
    );

    const renderTab = (tab: TimelineTabOption) => tabSlot(tab.id, activeTab === tab.id, withDownload(tab.exposureId ? tab : undefined, (
        <button
            type='button'
            role='tab'
            aria-selected={activeTab === tab.id}
            aria-controls={panelId}
            className={tabClassName(activeTab === tab.id)}
            onClick={() => onTabPress(tab.id)}
        >
            {tab.label}
        </button>
    )));

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
                <DropdownPopover placement='top start'>
                    <DropdownMenu
                        aria-label={outputsTitle ?? 'Outputs'}
                        className='p-1.5 pt-1'
                        selectionMode='single'
                        disallowEmptySelection
                        selectedKeys={activeOutput ? [activeOutput.id] : []}
                        onSelectionChange={(keys) => {
                            const key = keys === 'all' ? undefined : [...keys][0];
                            if (key !== undefined) onTabSelect(String(key));
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
        return tabSlot('timeline-outputs', Boolean(activeOutput), withDownload(activeOutput, menu));
    };

    return (
        // As OVITO: the tabs centred on the dock's top edge, and beside them the chevron that folds the panel away.
        <div className='grid h-9 w-full flex-none grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-1 px-2 max-md:pointer-events-auto max-md:order-1 max-md:h-auto max-md:grid-cols-[minmax(0,1fr)_2rem] max-md:p-0'>
            <span aria-hidden='true' className='max-md:hidden' />
            <Scrollable
                ref={tablistRef}
                orientation='horizontal'
                className='timeline-tabs relative flex max-w-full flex-row flex-nowrap items-center justify-self-center whitespace-nowrap max-md:hidden'
                role='tablist'
                aria-label='Timeline tabs'
                data-tour-id='canvas-timeline-tabs'
            >
                <span
                    aria-hidden='true'
                    className='pointer-events-none absolute inset-y-0 left-0 rounded-full bg-foreground/[0.08] transition-[transform,width,opacity] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none'
                    style={indicatorStyle}
                />
                {plainTabs.map(renderTab)}
                {renderOutputsTab()}
            </Scrollable>
            <div className='hidden max-md:block max-md:min-w-0 max-md:overflow-hidden max-md:rounded-full max-md:bg-foreground/[0.06]' data-tour-id='canvas-timeline-tab-selector'>
                <CanvasOptionSelect
                    ariaLabel='Timeline tab'
                    options={tabSelectOptions}
                    value={activeTab}
                    onChange={onTabSelect}
                    placeholder='Open a tab'
                    triggerClassName='max-md:h-8 max-md:min-h-8 max-md:w-full max-md:items-center max-md:rounded-full max-md:border-transparent max-md:bg-transparent max-md:py-0 max-md:pl-3'
                />
            </div>
            <Button
                variant='ghost'
                size='sm'
                isIconOnly
                aria-label={isPanelOpen ? 'Hide panel' : 'Show panel'}
                aria-expanded={isPanelOpen}
                aria-controls={panelId}
                className='size-7 min-h-7 min-w-7 justify-self-end text-muted hover:text-foreground'
                onPress={onTogglePanel}
            >
                {/* Points down to fold the panel away and turns up, on a spring, to bring it back. */}
                <ChevronDown size={13} className={cn('transition-transform duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none', !isPanelOpen && 'rotate-180')} />
            </Button>
        </div>
    );
};

export default TimelineHeader;
