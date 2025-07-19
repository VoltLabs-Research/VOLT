import { HiPlus, HiArrowUp } from 'react-icons/hi';
import './AIPromptBox.css';

const AIPromptBox = () => {

    return (
        <div className='ai-prompt-container-wrapper'>
            <div className='ai-prompt-add-file-container'>
                <i className='ai-prompt-add-file-icon-container'>
                    <HiPlus />
                </i>
                <span className='ai-prompt-add-file-title'>Add files</span>
            </div>
            <div className='ai-prompt-container'>
                <input className='ai-prompt-input' placeholder="I'm here to help you, ask me for anything." />
                <i className='ai-prompt-icon-container'>
                    <HiArrowUp />
                </i>
            </div>
        </div>
    );
};

export default AIPromptBox;