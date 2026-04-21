import './AvatarUpload.css';
import Button from '@/shared/presentation/components/Button';
import Loader from '@/shared/presentation/components/Loader';
import { Camera, User } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

interface AvatarUploadProps {
    avatarUrl: string | null;
    isUploading: boolean;
    onUpload: (file: File) => Promise<void>;
};

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
        <div className="volt-container w-max h-max d-flex items-center content-center avatar-placeholder">
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
        <div className="volt-container d-flex items-center gap-1">
            <Button
                type='button'
                variant='ghost'
                align='start'
                className='avatar-upload-trigger d-flex items-center gap-1 p-0'
                onClick={handleAvatarTrigger}
                aria-describedby={helperTextId}
                aria-label={preview ? 'Change profile picture' : 'Upload profile picture'}
                disabled={isUploading}
            >
                <div className="volt-container avatar-upload radius-full p-relative overflow-hidden f-shrink-0">
                    {avatarContent}
                    <div className="volt-container avatar-overlay p-absolute inset-0 d-flex items-center r">
                        {overlayContent}
                    </div>
                </div>

                <div className="volt-container d-flex column gap-025" style={{ textAlign: 'left' }}>
                    <h3 className="volt-title font-size-2 font-weight-6">
                        Profile Picture
                    </h3>
                    <div id={helperTextId} className="volt-container color-muted font-size-1">
                        Click to upload a new avatar (JPG, PNG, max 5MB)
                    </div>
                </div>
            </Button>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="avatar-file-input"
                tabIndex={-1}
                aria-hidden='true'
            />
        </div>
    );
};

export default AvatarUpload;
