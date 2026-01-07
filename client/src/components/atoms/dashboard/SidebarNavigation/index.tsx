import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { RiHomeSmile2Fill } from "react-icons/ri";
import { TbCube3dSphere } from 'react-icons/tb';
import { IoCubeOutline, IoAnalytics, IoPeopleOutline, IoKeyOutline, IoChevronDown } from 'react-icons/io5';
import { GoWorkflow } from 'react-icons/go';
import { CiChat1 } from 'react-icons/ci';
import { HiOutlineServer } from 'react-icons/hi';
import { BsFiles } from 'react-icons/bs';
import { MdImportExport } from 'react-icons/md';
import type { IconType } from 'react-icons';
import { Skeleton } from '@mui/material';
import { useTeamStore } from '@/stores/slices/team';
import useTeamStateReset from '@/hooks/team/use-team-state-reset';
import useToast from '@/hooks/ui/use-toast';
import Select from '@/components/atoms/form/Select';
import Container from '@/components/primitives/Container';
import { IoIosAdd } from 'react-icons/io';
import pluginApi from '@/services/api/plugin/plugin';
import type { IListingsWithExposures } from '@/services/api/plugin/types';

interface SidebarNavigationProps {
    setSidebarOpen: (status: boolean) => void;
    setSettingsExpanded: (status: boolean) => void;
};

const SidebarNavigation = ({ setSidebarOpen, setSettingsExpanded }: SidebarNavigationProps) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [analysesExpanded, setAnalysesExpanded] = useState(false);
    const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set());
    const [exposures, setExposures] = useState<IListingsWithExposures[]>([]);
    const [isLoadingExposures, setIsLoadingExposures] = useState(true);
    const [trajectoriesExpanded, setTrajectoriesExpanded] = useState(false);

    const navigate = useNavigate();
    const { pathname } = useLocation();
    const teams = useTeamStore((state) => state.teams);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);
    const { resetAllTeamState } = useTeamStateReset();
    const { showError, showSuccess } = useToast();
    const leaveTeam = useTeamStore((state) => state.leaveTeam);

    useEffect(() => {
        if (!selectedTeam?._id) return;
        const fetchExposures = async () => {
            try {
                const response = await pluginApi.getPlugins({ limit: 1000 });
                const exposures = response.data
                    .filter(p => p.listingsWithExposures)
                    .map(p => p.listingsWithExposures!);
                setExposures(exposures);
            } catch (error) {
                console.error('Failed to fetch exposures:', error);
            } finally {
                setIsLoadingExposures(false);
            }
        };

        fetchExposures();
    }, [selectedTeam]);

    const handleTeamChange = (teamId: string) => {
        if (selectedTeam?._id === teamId) return;

        resetAllTeamState();

        setSelectedTeam(teamId);
        setSearchParams({ team: teamId });
    };

    const handleLeaveTeam = async (teamId: string) => {
        try {
            await leaveTeam(teamId);

            const state = useTeamStore.getState();
            const remainingTeams = state.teams;
            const currentSelected = state.selectedTeam;

            if (currentSelected?._id === teamId && remainingTeams.length > 0) {
                const newTeamId = remainingTeams[0]._id;
                setSelectedTeam(newTeamId);

                resetAllTeamState();

                setSearchParams({ team: newTeamId });
            }

            showSuccess(`Left team successfully`);
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to leave team';
            showError(errorMessage);
        }
    };

    const teamOptions = useMemo(() =>
        teams.map(team => ({
            value: team._id,
            title: team.name,
            description: team.description || undefined
        })), [teams]
    );

    const mainNavItems: Array<[string, IconType, string]> = useMemo(() => ([
        ['Dashboard', RiHomeSmile2Fill, '/dashboard'],
        ['Containers', IoCubeOutline, '/dashboard/containers'],
    ]), []);

    const secondaryNavItems: Array<[string, IconType, string]> = useMemo(() => ([
        ['Plugins', GoWorkflow, '/dashboard/plugins/list'],
        ['Messages', CiChat1, '/dashboard/messages'],
        ['Clusters', HiOutlineServer, '/dashboard/clusters'],
        ['File Explorer', BsFiles, '/dashboard/file-explorer'],
        ['Import', MdImportExport, '/dashboard/ssh-connections'],
        ['My Team', IoPeopleOutline, '/dashboard/my-team'],
        ['Manage Roles', IoKeyOutline, '/dashboard/manage-roles']
    ]), []);

    return (
        <nav className='sidebar-nav'>
            {mainNavItems.map(([name, Icon, to], index) => (
                <button
                    key={index}
                    className={`sidebar-nav-item ${(to === '/dashboard' ? pathname === to : pathname.startsWith(to)) ? 'is-selected' : ''}`}
                    onClick={() => {
                        navigate(to);
                        setSidebarOpen(false);
                        setSettingsExpanded(false);
                    }}
                >
                    <span className='sidebar-nav-icon'>
                        <Icon />
                    </span>
                    <span className='sidebar-nav-label'>{name}</span>
                </button>
            ))}

            {/* Trajectories Dropdown */}
            <button
                className={`sidebar-nav-item sidebar-section-header ${pathname.includes('/trajectories') || pathname.includes('/simulation-cells') ? 'is-selected' : ''}`}
                onClick={() => setTrajectoriesExpanded(!trajectoriesExpanded)}
            >
                <span className="sidebar-nav-icon">
                    <TbCube3dSphere />
                </span>
                <span className="sidebar-nav-label">Trajectories</span>
                <IoChevronDown
                    className={`sidebar-section-chevron ${trajectoriesExpanded ? 'is-expanded' : ''}`}
                    size={14}
                />
            </button>

            {trajectoriesExpanded && (
                <div className="sidebar-sub-items">
                    <button
                        className={`sidebar-sub-item ${pathname === '/dashboard/trajectories/list' ? 'is-selected' : ''}`}
                        onClick={() => {
                            navigate('/dashboard/trajectories/list');
                            setSidebarOpen(false);
                        }}
                    >
                        View All
                    </button>
                    <button
                        className={`sidebar-sub-item ${pathname === '/dashboard/simulation-cells/list' ? 'is-selected' : ''}`}
                        onClick={() => {
                            navigate('/dashboard/simulation-cells/list');
                            setSidebarOpen(false);
                        }}
                    >
                        Simulation Cells
                    </button>
                </div>
            )}


            {/* Analysis Configs Dropdown */}
            <button
                className={`sidebar-nav-item sidebar-section-header ${pathname.includes('/analysis-configs') ? 'is-selected' : ''}`}
                onClick={() => setAnalysesExpanded(!analysesExpanded)}
            >
                <span className="sidebar-nav-icon">
                    <IoAnalytics />
                </span>
                <span className="sidebar-nav-label">Analysis</span>
                <IoChevronDown
                    className={`sidebar-section-chevron ${analysesExpanded ? 'is-expanded' : ''}`}
                    size={14}
                />
            </button>

            {analysesExpanded && (
                <div className="sidebar-sub-items">
                    <button
                        className={`sidebar-sub-item ${pathname === '/dashboard/analysis-configs/list' && !searchParams.get('plugin') ? 'is-selected' : ''}`}
                        onClick={() => {
                            navigate('/dashboard/analysis-configs/list');
                            setSidebarOpen(false);
                        }}
                    >
                        View all
                    </button>
                    {isLoadingExposures ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="sidebar-nested-section" style={{ padding: '4px 12px' }}>
                                <Skeleton
                                    animation="wave"
                                    variant="rectangular"
                                    height={24}
                                    width="100%"
                                    sx={{ borderRadius: 1, devbgcolor: 'rgba(255, 255, 255, 0.05)' }}
                                />
                            </div>
                        ))
                    ) : (
                        exposures.map((plugin) => (
                            <div key={plugin.pluginSlug} className="sidebar-nested-section">
                                <button
                                    className={`sidebar-sub-item sidebar-nested-header ${pathname.includes(`/plugins/${plugin.pluginSlug}/listing/`) ? 'is-selected' : ''}`}
                                    onClick={() => {
                                        setExpandedPlugins(prev => {
                                            const next = new Set(prev);
                                            if (next.has(plugin.pluginSlug)) {
                                                next.delete(plugin.pluginSlug);
                                            } else {
                                                next.add(plugin.pluginSlug);
                                            }
                                            return next;
                                        });
                                    }}
                                    title={plugin.pluginName}
                                >
                                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                        {plugin.pluginName}
                                    </span>
                                    <IoChevronDown
                                        className={`sidebar-nested-chevron ${expandedPlugins.has(plugin.pluginSlug) ? 'is-expanded' : ''}`}
                                        size={12}
                                    />
                                </button>
                                {expandedPlugins.has(plugin.pluginSlug) && (
                                    <div className="sidebar-nested-items">
                                        {plugin.exposures.map((exposure) => (
                                            <button
                                                key={exposure.slug}
                                                className={`sidebar-nested-item ${pathname.includes(`/plugins/${plugin.pluginSlug}/listing/${encodeURIComponent(exposure.slug)}`) ? 'is-selected' : ''}`}
                                                onClick={() => {
                                                    navigate(`/dashboard/plugins/${plugin.pluginSlug}/listing/${encodeURIComponent(exposure.slug)}`);
                                                    setSidebarOpen(false);
                                                }}
                                                title={exposure.name}
                                            >
                                                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {exposure.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {secondaryNavItems.map(([name, Icon, to], index) => (
                <button
                    key={index}
                    className={`sidebar-nav-item ${(to === '/dashboard' ? pathname === to : pathname.startsWith(to)) ? 'is-selected' : ''}`}
                    onClick={() => {
                        navigate(to);
                        setSidebarOpen(false);
                        setSettingsExpanded(false);
                    }}
                >
                    <span className='sidebar-nav-icon'>
                        <Icon />
                    </span>
                    <span className='sidebar-nav-label'>{name}</span>
                </button>
            ))}

            <div className='sidebar-divider' />

            {/* Team Section */}
            <Container className='sidebar-team-section'>
                <Select
                    options={teamOptions}
                    value={selectedTeam?._id || null}
                    onChange={handleTeamChange}
                    onLeaveTeam={handleLeaveTeam}
                    className="team-select"
                />
            </Container>

            <button
                className='sidebar-nav-item'
                commandfor="team-creator-modal"
                command="show-modal"
            >
                <span className='sidebar-nav-icon'>
                    <IoIosAdd />
                </span>
                <span className='sidebar-nav-label'>Create Team</span>
            </button>
        </nav>
    );
};

export default SidebarNavigation;