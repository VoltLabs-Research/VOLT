import { PiDotsThreeVerticalBold } from "react-icons/pi";
import DashboardContainer from '../../../components/atoms/DashboardContainer';
import SimpExampleCover from '../../../assets/images/simulation-example-cover.png';
import './Dashboard.css';

const DashboardPage = () => {
    return (
        <DashboardContainer pageName='Dashboard'>
            <figure className='simulation-container'>
                <img className='simulation-image' src={SimpExampleCover} />
                <figcaption className='simulation-caption-container'>
                    <div className='simulation-caption-left-container'>
                        <h3 className='simulation-caption-title'>FCC Test Simulation</h3>
                        <p className='simulation-last-edited'>Edited 6 hours ago</p>
                    </div>
                    <i className='simulation-options-icon-container'>
                        <PiDotsThreeVerticalBold />
                    </i>
                </figcaption>
            </figure>
        </DashboardContainer>
    );
};

export default DashboardPage;