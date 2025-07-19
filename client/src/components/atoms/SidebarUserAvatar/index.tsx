import useAuthStore from '../../../stores/authentication';
import './SidebarUserAvatar.css';

const SidebarUserAvatar = () => {
    const { user } = useAuthStore();

    return (
        <div className='sidebar-user-container'>
            <div className='sidebar-user-avatar-container'>
                <span className='sidebar-user-avatar'>{user.firstName[0]}</span>
            </div>

            <span className='sidebar-user-fullname'>{user.firstName} {user.lastName}</span>
        </div>
    );
};

export default SidebarUserAvatar;