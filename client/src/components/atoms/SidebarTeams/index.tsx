import { HiPlus } from 'react-icons/hi';
import './SidebarTeams.css';

const SidebarTeams = () => {

    return (
        <div className='sidebar-teams-container'>
            <h3 className='sidebar-teams-title'>Teams</h3>
            <div className='sidebar-new-team-container'>
                <i className='sidebar-new-team-icon-container'>
                    <HiPlus />
                </i>

                <span className='sidebar-new-team-title'>Create new team</span>
            </div>
        </div>
    );
};

export default SidebarTeams;