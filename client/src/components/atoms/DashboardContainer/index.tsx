import { HiPlus } from 'react-icons/hi';
import { IoSearchOutline } from 'react-icons/io5';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { IoNotificationsOutline } from "react-icons/io5";
import './DashboardContainer.css';

const DashboardContainer = ({ children, pageName }) => {

    return (
        <div className='dashboard-container'>
            <article className='dashboard-header-container'>
                <div className='dashboard-header-left-container'>
                    <h3 className='dashboard-header-title'>{pageName}</h3>
                    <div className='clickable-container'>
                        <i className='clickable-icon-container'>
                            <HiPlus />
                        </i>
                        <span className='clickable-title'>New Folder</span>
                    </div>
                </div>

                <div className='dashboard-header-right-container'>
                    <div className='dashboard-clickables-container'>
                        {[IoNotificationsOutline].map((Icon, index) => (
                            <div className='dashboard-clickable-container' key={index}>
                                <Icon />
                            </div>
                        ))}
                    </div>

                    <div className='search-container'>
                        <i className='search-icon-container'>
                            <IoSearchOutline />
                        </i>
                        <input placeholder='Search' className='search-input '/>
                    </div>

                    <div className='create-new-button-container'>
                        <i className='create-new-button-icon-container'>
                            <HiPlus />
                        </i>
                        <span className='create-new-button-title'>Create</span>
                        <i className='create-new-button-dropdown-icon-container'>
                            <MdKeyboardArrowDown />
                        </i>
                    </div>
                </div>
            </article>

            {children}
        </div>
    );
};

export default DashboardContainer;