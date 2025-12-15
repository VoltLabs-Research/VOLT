import Title from '@/components/primitives/Title';

type WelcomeEmptyProps = {
    isConnected: boolean
};

const WelcomeEmpty = ({ isConnected }: WelcomeEmptyProps) => {
    return (
        <div className='chat-welcome-container'>
            <div className='chat-welcome-content'>
                <Title className="font-size-4 font-weight-6">Welcome to Chat</Title>
                <p>Select a conversation or start a new chat with a team member</p>
                {!isConnected && (
                    <div className='chat-connection-status'>
                        <p>Connecting to chat service...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WelcomeEmpty;
