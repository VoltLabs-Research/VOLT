import React from 'react';
import { TbArrowLeft } from 'react-icons/tb';
import Container from '@/components/primitives/Container';
import './SettingsSidebar.css';
import Title from '@/components/primitives/Title';

interface NavOption {
	title: string;
	icon: React.ComponentType<{ size?: number }>;
};

interface SettingsSidebarProps {
	activeSection: string;
	navOptions: NavOption[];
	onChange: (section: string) => void;
};

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeSection, navOptions, onChange }) => {
	return (
		<Container className='d-flex column p-sticky settings-sidebar'>
			<Container className='d-flex items-center gap-1 sidebar-header'>
				<button className='back-button'>
					<TbArrowLeft size={20} />
				</button>
				<Title className='font-size-1 sidebar-title'>Settings</Title>
			</Container>

			<Container className='sidebar-nav d-flex column gap-025'>
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
			</Container>
		</Container>
	);
};

export default SettingsSidebar;
