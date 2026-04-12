import './DashboardTabs.css';
import Container from '@/shared/presentation/components/Container';

export interface DashboardTabOption<TTabId extends string = string> {
    id: TTabId;
    label: string;
}

interface DashboardTabsProps<TTabId extends string = string> {
    activeTab: TTabId;
    ariaLabel: string;
    onChange: (tabId: TTabId) => void;
    tabs: ReadonlyArray<DashboardTabOption<TTabId>>;
}

const DashboardTabs = <TTabId extends string>({
    activeTab,
    ariaLabel,
    onChange,
    tabs
}: DashboardTabsProps<TTabId>) => {
    return (
        <Container className='dashboard-tabbed-card-tabs' role='tablist' aria-label={ariaLabel}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        type='button'
                        role='tab'
                        aria-selected={isActive}
                        className='dashboard-tabbed-card-tab'
                        data-active={isActive}
                        onClick={() => onChange(tab.id)}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </Container>
    );
};

export default DashboardTabs;
