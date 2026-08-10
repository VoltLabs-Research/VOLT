import './AvatarUpload.css';
import { Button, Loader } from '@voltstack/bravais';
import { Camera, User } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

interface AvatarUploadProps {
    avatarUrl: string | null;
    isUploading: boolean;
    onUpload: (file: File) => Promise<void>;
}

const AvatarUpload = ({
    avatarUrl,
    isUploading,
    onUpload
}: AvatarUploadProps) => {
    const helperTextId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(avatarUrl);

    useEffect(() => {
        setPreview(avatarUrl);
    }, [avatarUrl]);

    const handleAvatarTrigger = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file){
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                setPreview(reader.result);
            }
        };
        reader.readAsDataURL(file);

        try{
            await onUpload(file);
        }catch {
            setPreview(avatarUrl);
        }
    };

    let avatarContent = (
        <div className='flex flex-row items-center justify-center w-full h-full avatar-placeholder'>
            <User size={32} />
        </div>
    );

    if (preview) {
        avatarContent = <img src={preview} alt="Avatar" className="avatar-image" />;
    }

    let overlayContent = <Camera size={24} />;

    if (isUploading) {
        overlayContent = <Loader scale={0.6} isFixed={false} />;
    }

    return (
        <div className='flex flex-row items-center gap-4'>
            <Button
                type='button'
                variant='ghost'
                align='start'
                className='avatar-upload-trigger flex items-center gap-4 p-0'
                onClick={handleAvatarTrigger}
                aria-describedby={helperTextId}
                aria-label={preview ? 'Change profile picture' : 'Upload profile picture'}
                disabled={isUploading}
            >
                <div className='rounded-full relative overflow-hidden shrink-0 avatar-upload'>
                    {avatarContent}
                    <div className='flex flex-row items-center absolute inset-0 avatar-overlay r'>
                        {overlayContent}
                    </div>
                </div>

                <div className='flex flex-col gap-1' style={{ textAlign: 'left' }}>
                    <h3 className='text-sm font-semibold text-foreground'>
                        Profile Picture
                    </h3>
                    <div className='text-xs text-muted' id={helperTextId}>
                        Click to upload a new avatar (JPG, PNG, max 5MB)
                    </div>
                </div>
            </Button>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                tabIndex={-1}
                aria-hidden='true'
            />
        </div>
    );
};

export default AvatarUpload;
