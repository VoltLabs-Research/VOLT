import { useNavigate } from 'react-router-dom';
import { PiDotsThreeVerticalBold } from "react-icons/pi";
import { PiAtomThin } from 'react-icons/pi';
import SimpExampleCover from '../../../assets/images/simulation-example-cover.png';
import formatTimeAgo from '../../../utilities/formatTimeAgo';
import './SimulationCard.css';

const SimulationCard = ({ trajectory }) => {
    const navigate = useNavigate();

    return (
        <figure 
            className='simulation-container' 
            key={trajectory._id} 
            onClick={() => navigate(`/canvas/${trajectory._id}/`)}
        >
            <div className='simulation-cover-container'>
                {true ? (
                    <i className='simulation-cover-icon-container'>
                        <PiAtomThin />
                    </i>
                ) : (
                    <img className='simulation-image' src={SimpExampleCover} />
                )}
            </div>
            <figcaption className='simulation-caption-container'>
                <div className='simulation-caption-left-container'>
                    <h3 className='simulation-caption-title'>{trajectory.name}</h3>
                    <p className='simulation-last-edited'>Edited {formatTimeAgo(trajectory.updatedAt)}</p>
                </div>
                <i className='simulation-options-icon-container'>
                    <PiDotsThreeVerticalBold />
                </i>
            </figcaption>
        </figure>
    );
};

export default SimulationCard;