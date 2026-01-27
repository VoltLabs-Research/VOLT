import { useMemo, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { usePlugins } from '@/modules/plugins/presentation/hooks/use-plugin-queries';
import { Skeleton } from '@mui/material';
import { IoAnalytics, IoChevronDown } from 'react-icons/io5';

interface SidebarAnalysisNavProps {
    setSidebarOpen: (status: boolean) => void;
}

const SidebarAnalysisNav = ({ setSidebarOpen }: SidebarAnalysisNavProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [searchParams] = useSearchParams();
    const [analysesExpanded, setAnalysesExpanded] = useState(false);
    const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set());

    const { plugins, isLoading: isLoadingExposures } = usePlugins({ limit: 1000 });

    const exposures = useMemo(() => {
        return plugins
            .filter(p => p.listingsWithExposures)
            .map(p => p.listingsWithExposures!);
    }, [plugins]);

    return (
        <>
            <button
                className={`sidebar-nav-item sidebar-section-header ${pathname.includes('/analysis-configs') ? 'is-selected' : ''} p-relative gap-075 w-max font-size-2 font-weight-4 color-secondary cursor-pointer`}
                onClick={() => setAnalysesExpanded(!analysesExpanded)}
            >
                <span className="sidebar-nav-icon font-size-4">
                    <IoAnalytics />
                </span>
                <span className="sidebar-nav-label">Analysis</span>
                <IoChevronDown
                    className={`sidebar-section-chevron ${analysesExpanded ? 'is-expanded' : ''} color-muted`}
                    size={14}
                />
            </button>

            {analysesExpanded && (
                <div className="sidebar-sub-items">
                    <button
                        className={`sidebar-sub-item ${pathname === '/dashboard/analysis-configs/list' && !searchParams.get('plugin') ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
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
                                    sx={{ borderRadius: 1, bgcolor: 'rgba(255, 255, 255, 0.05)' }}
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
                                        className={`sidebar-nested-chevron ${expandedPlugins.has(plugin.pluginSlug) ? 'is-expanded' : ''} color-muted`}
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
        </>
    );
};

export default SidebarAnalysisNav;
