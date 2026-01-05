import { useMemo, useState } from 'react';
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
import { useTeamStore } from '@/stores/slices/team';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import useTeamStateReset from '@/hooks/team/use-team-state-reset';
import useToast from '@/hooks/ui/use-toast';
import { NodeType } from '@/types/plugin';
import Select from '@/components/atoms/form/Select';
import Container from '@/components/primitives/Container';
import { IoIosAdd } from 'react-icons/io';

interface SidebarNavigationProps{
    setSidebarOpen: (status: boolean) => void;
    setSettingsExpanded: (status: boolean) => void;
};

const SidebarNavigation = ({ setSidebarOpen, setSettingsExpanded }: SidebarNavigationProps) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [analysesExpanded, setAnalysesExpanded] = useState(false);
    const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set());
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const teams = useTeamStore((state) => state.teams);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);
    const plugins = usePluginStore((state) => state.plugins);
    const { resetAllTeamState } = useTeamStateReset();
    const { showError, showSuccess } = useToast();
    const leaveTeam = useTeamStore((state) => state.leaveTeam);

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
        ['Trajectories', TbCube3dSphere, '/dashboard/trajectories/list'],
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
    
    // Group plugins with their exposures that have listings or perAtomProperties
    const pluginsWithExposures = useMemo(() => {
        const result: Array<{
            pluginName: string;
            pluginSlug: string;
            exposures: Array<{ name: string; slug: string; hasPerAtomProperties: boolean }>;
        }> = [];

        plugins.forEach(plugin => {
            if (!plugin.workflow?.nodes || !plugin.workflow?.edges || !plugin.slug) return;
            const { nodes, edges } = plugin.workflow;

            // Find visualizer nodes with listings OR perAtomProperties
            const visualizerNodes = nodes.filter(node =>
                node.type === NodeType.VISUALIZERS && (
                    (node.data?.visualizers?.listing && Object.keys(node.data.visualizers.listing).length > 0) ||
                    (node.data?.visualizers?.perAtomProperties && node.data.visualizers.perAtomProperties.length > 0)
                )
            );

            if (visualizerNodes.length === 0) return;

            // Trace backward from visualizers to find connected exposures
            const findConnectedExposure = (nodeId: string, depth = 0): string | null => {
                if (depth > 5) return null;
                const incomingEdge = edges.find(e => e.target === nodeId);
                if (!incomingEdge) return null;
                const sourceNode = nodes.find(n => n.id === incomingEdge.source);
                if (!sourceNode) return null;
                if (sourceNode.type === NodeType.EXPOSURE) {
                    return sourceNode.data?.exposure?.name || null;
                }
                return findConnectedExposure(sourceNode.id, depth + 1);
            };

            const exposures: Array<{ name: string; slug: string; hasPerAtomProperties: boolean }> = [];
            const seenExposures = new Set<string>();

            visualizerNodes.forEach(vizNode => {
                const exposureName = findConnectedExposure(vizNode.id);
                if (exposureName && !seenExposures.has(exposureName)) {
                    seenExposures.add(exposureName);
                    const hasPerAtomProperties = Boolean(
                        vizNode.data?.visualizers?.perAtomProperties?.length
                    );
                    exposures.push({ name: exposureName, slug: exposureName, hasPerAtomProperties });
                }
            });

            if (exposures.length === 0) return;

            // Get modifier name for plugin display name
            const modifierNode = nodes.find(n => n.type === NodeType.MODIFIER);
            const pluginName = modifierNode?.data?.modifier?.name || plugin.slug;

            result.push({
                pluginName,
                pluginSlug: plugin.slug,
                exposures
            });
        });

        return result;
    }, [plugins]);
    
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
                    {pluginsWithExposures.map((plugin) => (
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
                    ))}
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