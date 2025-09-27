import React from 'react';
import { TbArrowLeft } from 'react-icons/tb';

interface NavOption { title: string; icon: React.ComponentType<{ size?: number }>; }

interface SettingsSidebarProps {
	activeSection: string;
	navOptions: NavOption[];
	onChange: (section: string) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeSection, navOptions, onChange }) => {
	return (
		<aside className='settings-sidebar'>
			<div className='sidebar-header'>
				<button className='back-button'>
					<TbArrowLeft size={20} />
				</button>
				<h1 className='sidebar-title'>Settings</h1>
			</div>

			<nav className='sidebar-nav'>
				{navOptions.map((option) => {
					const Icon = option.icon;
					const isActive = activeSection === option.title;
					return (
						<button
							key={option.title}
							className={`nav-item ${isActive ? 'active' : ''}`}
							onClick={() => onChange(option.title)}
						>
							<Icon size={20} />
							<span>{option.title}</span>
						</button>
					);
				})}
			</nav>
		</aside>
	);
};

export default SettingsSidebar;


