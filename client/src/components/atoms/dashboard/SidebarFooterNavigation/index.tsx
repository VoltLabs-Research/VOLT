import { useMemo } from 'react';
import { IoChevronDown, IoSettingsOutline } from 'react-icons/io5';
import { useLocation, useNavigate } from 'react-router';
import { TbHelp } from 'react-icons/tb';
import Container from '@/components/primitives/Container';

interface SidebarFooterNavigationProps{
    setSettingsExpanded: (status: boolean) => void;
    settingsExpanded: boolean;
};

const SidebarFooterNavigation = ({ settingsExpanded, setSettingsExpanded }: SidebarFooterNavigationProps) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const settingsItems = useMemo(() => ([
        { id: 'general', label: 'General', icon: IoSettingsOutline },
        { id: 'authentication', label: 'Authentication', icon: IoSettingsOutline },
        { id: 'theme', label: 'Theme', icon: IoSettingsOutline },
        { id: 'notifications', label: 'Notifications', icon: IoSettingsOutline },
        { id: 'sessions', label: 'Sessions', icon: IoSettingsOutline },
        { id: 'integrations', label: 'Integrations', icon: IoSettingsOutline },
        { id: 'data-export', label: 'Data & Export', icon: IoSettingsOutline },
        { id: 'advanced', label: 'Advanced', icon: IoSettingsOutline }
    ]), []);

    return (
        <Container className='sidebar-footer-nav'>
            <button
                className={`sidebar-nav-item sidebar-section-header ${pathname.startsWith('/dashboard/settings') ? 'is-selected' : ''}`}
                onClick={() => setSettingsExpanded(!settingsExpanded)}
            >
                <span className='sidebar-nav-icon'>
                    <IoSettingsOutline />
                </span>
                <span className='sidebar-nav-label'>Settings</span>
                <IoChevronDown
                    className={`sidebar-section-chevron ${settingsExpanded ? 'is-expanded' : ''}`}
                    size={14}
                />
            </button>

            {settingsExpanded && (
                <Container className='sidebar-sub-items'>
                    {settingsItems.map((item) => (
                        <button
                            key={item.id}
                            className={`sidebar-sub-item ${pathname === `/dashboard/settings/${item.id}` ? 'is-selected' : ''}`}
                            onClick={() => navigate(`/dashboard/settings/${item.id}`)}
                        >
                            {item.label}
                        </button>
                    ))}
                </Container>
            )}

            <button className='sidebar-nav-item'>
                <span className='sidebar-nav-icon'>
                    <TbHelp />
                </span>
                <span className='sidebar-nav-label'>Support</span>
            </button>
        </Container>
    );
};

export default SidebarFooterNavigation;