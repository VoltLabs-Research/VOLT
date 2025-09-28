import { 
    IoHappyOutline, 
    IoEllipsisVerticalOutline, 
    IoCreateOutline, 
    IoTrashOutline } from 'react-icons/io5';

export type MessageControlsProps = {
    isOwn: boolean;
    isOptionsOpen: boolean;
    onOpenReactions: () => void;
    onOpenOptions: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const MessageControls = ({
    isOwn,
    isOptionsOpen,
    onOpenReactions,
    onOpenOptions,
    onEdit,
    onDelete
}: MessageControlsProps) => {
    return (
        <div className='chat-message-controls'>
            <button 
                className='chat-message-reaction-btn'
                onClick={onOpenReactions}
            >
                <IoHappyOutline/>
            </button>

            {isOwn && (
                <div className='relative'>
                    <button
                        className='chat-message-options'
                        onClick={onOpenOptions}
                    >
                        <IoEllipsisVerticalOutline/>
                    </button>

                    {isOptionsOpen && (
                        <div className='chat-message-options-menu'>
                            <button
                                className='chat-message-option'
                                onClick={onEdit}
                            >
                                <IoCreateOutline/> Edit
                            </button>
                            <button
                                className='chat-message-option danger' 
                                onClick={onDelete}
                            >
                                <IoTrashOutline/> Delete
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MessageControls;