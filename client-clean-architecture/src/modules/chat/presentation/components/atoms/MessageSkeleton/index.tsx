type SkeletonProps = { variant?: 'message' | 'file' | 'contact'; isSent?: boolean };

/* TODO: USE MUI! */
const  MessageSkeleton = ({ variant = 'message', isSent }: SkeletonProps) => {
    if(variant === 'contact') return <div className="skeleton-contact"/>;
    if(variant === 'file') return <div className="skeleton-file"/>;
    return <div className={`skeleton-message ${isSent ? 'sent' : 'received'}`}/>;
}

export default MessageSkeleton;
