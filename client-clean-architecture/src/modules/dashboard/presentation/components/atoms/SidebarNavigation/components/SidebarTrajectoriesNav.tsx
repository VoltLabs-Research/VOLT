import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TbCube3dSphere } from 'react-icons/tb';
import { IoChevronDown } from 'react-icons/io5';

interface SidebarTrajectoriesNavProps {
    setSidebarOpen: (status: boolean) => void;
}

const SidebarTrajectoriesNav = ({ setSidebarOpen }: SidebarTrajectoriesNavProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [trajectoriesExpanded, setTrajectoriesExpanded] = useState(false);

    return (
        <>
            <button
                className={`sidebar-nav-item sidebar-section-header ${pathname.includes('/trajectories') || pathname.includes('/simulation-cells') ? 'is-selected' : ''} p-relative gap-075 w-max font-size-2 font-weight-4 color-secondary cursor-pointer`}
                onClick={() => setTrajectoriesExpanded(!trajectoriesExpanded)}
            >
                <span className="sidebar-nav-icon font-size-4">
                    <TbCube3dSphere />
                </span>
                <span className="sidebar-nav-label">Trajectories</span>
                <IoChevronDown
                    className={`sidebar-section-chevron ${trajectoriesExpanded ? 'is-expanded' : ''} color-muted`}
                    size={14}
                />
            </button>

            {trajectoriesExpanded && (
                <div className="sidebar-sub-items">
                    <button
                        className={`sidebar-sub-item ${pathname === '/dashboard/trajectories/list' ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                        onClick={() => {
                            navigate('/dashboard/trajectories/list');
                            setSidebarOpen(false);
                        }}
                    >
                        View All
                    </button>
                    <button
                        className={`sidebar-sub-item ${pathname === '/dashboard/simulation-cells/list' ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                        onClick={() => {
                            navigate('/dashboard/simulation-cells/list');
                            setSidebarOpen(false);
                        }}
                    >
                        Simulation Cells
                    </button>
                </div>
            )}
        </>
    );
};

export default SidebarTrajectoriesNav;
