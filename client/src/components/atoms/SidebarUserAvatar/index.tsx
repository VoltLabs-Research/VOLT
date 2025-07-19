import useAuthStore from '../../../stores/authentication';
import ActionBasedFloatingContainer from '../ActionBasedFloatingContainer';
import { CiLogout, CiSettings } from 'react-icons/ci';
import './SidebarUserAvatar.css';

const SidebarUserAvatar = () => {
    const { user } = useAuthStore();

    return (
        <ActionBasedFloatingContainer
            options={[
                ['Account Settings', CiSettings, () => {}],
                ['Sign Out', CiLogout, () => {}]
            ]}
        >
            <div className='sidebar-user-container'>
                <div className='sidebar-user-avatar-container'>
                    <span className='sidebar-user-avatar'>{user.firstName[0]}</span>
                </div>

                <span className='sidebar-user-fullname'>{user.firstName} {user.lastName}</span>
            </div>
        </ActionBasedFloatingContainer>
    );
};

export default SidebarUserAvatar;