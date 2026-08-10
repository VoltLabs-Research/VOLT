import {
    Button,
    DropdownItem,
    DropdownMenu,
    DropdownPopover,
    DropdownRoot,
    DropdownTrigger,
    Tooltip,
    cn
} from '@heroui/react';
import Brand from '@/modules/dashboard/components/Brand';
import SidebarFooterNavigation from '@/modules/dashboard/components/SidebarFooterNavigation';
import SidebarNavigation from '@/modules/dashboard/components/SidebarNavigation';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import TeamSelector from '@/modules/team/components/TeamSelector';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import { openModal } from '@/shared/ui/modal';
import { useState } from 'react';
import { Plus, UserPlus, X } from 'lucide-react';

interface DashboardSidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (status: boolean) => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
    onExpandSidebar: () => void;
}

/**
 * `.dashboard-sidebar` and `.is-collapsed` are both gone from the markup.
 *
 * They were the ancestor flags the deleted sheet's collapsed cascade hung off, and
 * spec §5b.3 would have them become `[.dashboard-sidebar.is-collapsed_&]:…`
 * variants. Anchoring instead on the element that already knows it is collapsed —
 * the nav and the footer nav, both of which receive `collapsed` as a prop — reaches
 * the same shared components at the same specificity without a distant class that
 * nothing else validates. See `collapsed-rail-chrome.ts`.
 *
 * `--duration-fast` was 150ms and `--ease-standard` is the same curve as
 * `ease-out-fluid`.
 */
const SIDEBAR = 'fixed left-0 top-0 z-[100] flex h-dvh w-[280px] flex-col bg-transparent transition-[width] duration-150 ease-out-fluid';

/**
 * Below 1024px the rail stops being a rail: it becomes a 280px overlay drawer that
 * slides in from the left. The sheet forced that width with `!important` purely to
 * beat its own `.is-collapsed { width: 64px }`; with the collapse gated behind
 * `min-[1024.05px]` there is nothing left to out-shout.
 *
 * `--glass-bg` / `--glass-border` were already flattened to a solid surface and a
 * real border before this migration, and `--glass-blur` resolves to `none`, so the
 * backdrop filter is dropped rather than ported (spec §3a).
 */
const SIDEBAR_DRAWER = 'max-[1024px]:w-[280px] max-[1024px]:border-r max-[1024px]:border-border max-[1024px]:bg-surface max-[1024px]:shadow-[8px_0_32px_rgba(0,0,0,0.3)] max-[1024px]:transition-[transform,width] max-[1024px]:duration-[250ms] max-[1024px]:ease-out-fluid';
const SIDEBAR_DRAWER_OPEN = 'max-[1024px]:translate-x-0';
const SIDEBAR_DRAWER_CLOSED = 'max-[1024px]:-translate-x-full';

/** `.dashboard-sidebar.is-collapsed { width: 64px }` — only while it is a real rail. */
const SIDEBAR_COLLAPSED = 'min-[1024.05px]:w-16';

/** `.sidebar-close-btn` — the drawer's own dismiss affordance, desktop-hidden. */
const CLOSE_BUTTON = 'absolute top-4 right-4 hidden items-center justify-center rounded-md border border-border bg-surface-tertiary max-[1024px]:flex max-[1024px]:size-11 max-[1024px]:p-0';

/** `.sidebar-workspace`. */
const WORKSPACE = 'flex items-center gap-1.5 px-3 pt-1 pb-2';
const WORKSPACE_COLLAPSED = 'min-[1024.05px]:hidden';

/** `.sidebar-footer`. `border-top` used `--color-border-soft`, now `--border`. */
const FOOTER = 'border-t border-border p-3';

/**
 * `.dashboard-sidebar.is-collapsed .sidebar-footer` — `flex` and `flex-col` are NOT
 * media-gated because the sheet's 1024px block only reverted the padding and the
 * cross-axis alignment, leaving the column layout in place at every width.
 */
const FOOTER_COLLAPSED = 'flex flex-col min-[1024.05px]:items-center min-[1024.05px]:p-2';

/*
 * The sheet's last cross-module arm — `.dashboard-sidebar.is-collapsed
 * .user-menu-trigger-collapsed` — is NOT re-expressed here. `UserMenuPopover` has
 * since been migrated and its own `TRIGGER_COLLAPSED` class string already carries
 * the full-width centred layout the rule supplied, so reaching in from this side
 * would only shadow the owner's own utilities at a higher specificity. The
 * `user-menu-trigger-collapsed` marker it kept for this contract is now unused; see
 * the handoff.
 */

const DashboardSidebar = ({ sidebarOpen, setSidebarOpen, collapsed, onToggleCollapse, onExpandSidebar }: DashboardSidebarProps) => {
    const [settingsExpanded, setSettingsExpanded] = useState(false);
    const { handleSettingsClick, handleSignOut, isSigningOut } = useUserSessionActions();
    const singleTenant = useSingleTenant();

    return (
        <aside
            className={cn(
                SIDEBAR,
                SIDEBAR_DRAWER,
                sidebarOpen ? SIDEBAR_DRAWER_OPEN : SIDEBAR_DRAWER_CLOSED,
                collapsed && SIDEBAR_COLLAPSED
            )}
        >
            <Tooltip>
                <Button
                    isIconOnly
                    variant='ghost'
                    className={CLOSE_BUTTON}
                    aria-label='Close sidebar'
                    onPress={() => setSidebarOpen(false)}
                >
                    <X size={20} />
                </Button>
                <Tooltip.Content placement='bottom'>Close sidebar</Tooltip.Content>
            </Tooltip>

            <Brand collapsed={collapsed} onToggleCollapse={onToggleCollapse} />

            {!singleTenant && (
            <div className={cn(WORKSPACE, collapsed && WORKSPACE_COLLAPSED)}>
                {/* `.sidebar-workspace .sidebar-workspace-selector { flex: 1; min-width: 0 }`
                    was a descendant rule over TeamSelector's root. It is a wrapper now
                    rather than a className so it does not depend on how the team module
                    forwards `className` once that module migrates. */}
                <div className='flex-1 min-w-0'>
                    <TeamSelector />
                </div>

                <DropdownRoot>
                    <Tooltip>
                        <DropdownTrigger
                            className='flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground'
                            aria-label='Team actions'
                        >
                            <Plus size={18} aria-hidden='true' />
                        </DropdownTrigger>
                        <Tooltip.Content placement='bottom'>Team actions</Tooltip.Content>
                    </Tooltip>
                    <DropdownPopover placement='bottom end'>
                        <DropdownMenu aria-label='Team actions'>
                            <DropdownItem id='create-team' textValue='Create team' onAction={() => openModal('team-creator-modal')}>
                                <Plus size={16} aria-hidden='true' />
                                Create team
                            </DropdownItem>
                            <DropdownItem id='join-team' textValue='Join existing team' onAction={() => openModal('join-team-modal')}>
                                <UserPlus size={16} aria-hidden='true' />
                                Join existing team
                            </DropdownItem>
                        </DropdownMenu>
                    </DropdownPopover>
                </DropdownRoot>
            </div>
            )}

            <SidebarNavigation
                setSidebarOpen={setSidebarOpen}
                collapsed={collapsed}
                onExpandSidebar={onExpandSidebar}
            />

            <div className={cn(FOOTER, collapsed && FOOTER_COLLAPSED)}>
                <SidebarFooterNavigation
                    setSettingsExpanded={setSettingsExpanded}
                    settingsExpanded={settingsExpanded}
                    collapsed={collapsed}
                />

                {/*
                  The user menu (Account Settings + Sign Out) is a per-user concern, not a
                  multi-tenant one. It must render in single-tenant/local mode too — otherwise a
                  local user has no way to sign out or reach account settings from the UI.
                */}
                <UserMenuPopover
                    onSettingsClick={handleSettingsClick}
                    onSignOut={handleSignOut}
                    isSigningOut={isSigningOut}
                    collapsed={collapsed}
                />
            </div>
        </aside>
    );
};

export default DashboardSidebar;
