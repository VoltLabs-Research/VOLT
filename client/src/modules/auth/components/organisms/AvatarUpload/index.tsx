import './AvatarUpload.css';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Title from '@/shared/presentation/components/Title';
import { Camera, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(avatarUrl);

    useEffect(() => {
        setPreview(avatarUrl);
    }, [avatarUrl]);

    const handleAvatarClick = () => {
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
        }catch (error){
            setPreview(avatarUrl);
        }
    };

    let avatarContent = (
        <Container className="wh-max d-flex items-center content-center avatar-placeholder">
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
            <Container
                className="avatar-upload radius-full p-relative overflow-hidden cursor-pointer f-shrink-0"
                onClick={handleAvatarClick}
            >
                {avatarContent}
                <Container className="avatar-overlay p-absolute inset-0 d-flex items-center content-center">
                    {overlayContent}
                </Container>
            </Container>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="avatar-file-input"
            />
            
            <Container className="d-flex column gap-025">
                <Title className="font-size-2 font-weight-6">
                    Profile Picture
                </Title>
                <Container className="color-muted font-size-1">
                    Click to upload a new avatar (JPG, PNG, max 5MB)
                </Container>
            </Container>
        </Container>
    );
};

export default AvatarUpload;
