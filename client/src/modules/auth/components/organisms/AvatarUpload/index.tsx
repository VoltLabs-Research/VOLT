import './AvatarUpload.css';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Title from '@/shared/presentation/components/Title';
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
        <Container className="w-max h-max d-flex items-center content-center avatar-placeholder">
            <User size={32} />
        </Container>
    );

    if (preview) {
        avatarContent = <img src={preview} alt="Avatar" className="avatar-image" />;
    }

    let overlayContent = <Camera size={24} />;

    if (isUploading) {
        overlayContent = <Loader scale={0.6} isFixed={false} />;
    }

    return (
        <Container className="d-flex items-center gap-1">
            <Button
                type='button'
                variant='ghost'
                className='avatar-upload-trigger d-flex items-center gap-1 p-0'
                onClick={handleAvatarTrigger}
                aria-describedby={helperTextId}
                aria-label={preview ? 'Change profile picture' : 'Upload profile picture'}
                disabled={isUploading}
            >
                <Container className="avatar-upload radius-full p-relative overflow-hidden f-shrink-0">
                    {avatarContent}
                    <Container className="avatar-overlay p-absolute inset-0 d-flex items-center content-center">
                        {overlayContent}
                    </Container>
                </Container>

                <Container className="d-flex column gap-025 text-left">
                    <Title className="font-size-2 font-weight-6">
                        Profile Picture
                    </Title>
                    <Container id={helperTextId} className="color-muted font-size-1">
                        Click to upload a new avatar (JPG, PNG, max 5MB)
                    </Container>
                </Container>
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
        </Container>
    );
};

export default AvatarUpload;
