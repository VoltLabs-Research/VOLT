import './SidebarNavigationOption.css';

const SidebarNavigationOption = ({ name, Icon, isSelected = false }) => {

    return (
        <div className={'sidebar-nav-option-container '.concat(isSelected ? 'selected' : '')}>
            <i className='sidebar-nav-option-icon-container'>
                <Icon />
            </i>

            <h3 className='sidebar-nav-option-name'>{name}</h3>
        </div>
    );
};

export default SidebarNavigationOption;