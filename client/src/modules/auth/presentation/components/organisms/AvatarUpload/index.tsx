import React, { useRef, useState, useEffect } from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import { User, Camera } from 'lucide-react';
import Loader from '@/shared/presentation/components/Loader';
import './AvatarUpload.css';

interface AvatarUploadProps {
    avatarUrl: string | null;
    isUploading: boolean;
    onUpload: (file: File) => Promise<void>;
};

const AvatarUpload: React.FC<AvatarUploadProps> = ({
    avatarUrl,
    isUploading,
    onUpload
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(avatarUrl);

    useEffect(() => {
        setPreview(avatarUrl);
    }, [avatarUrl]);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file){
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        try{
            await onUpload(file);
        }catch (error){
            setPreview(avatarUrl);
        }
    };

    return (
        <Container className="d-flex items-center gap-1">
            <Container
                className="avatar-upload radius-full p-relative overflow-hidden cursor-pointer f-shrink-0"
                onClick={handleAvatarClick}
            >
                {preview ? (
                    <img src={preview} alt="Avatar" className="avatar-image" />
                ) : (
                    <Container className="wh-max d-flex items-center content-center avatar-placeholder">
                        <User size={32} />
                    </Container>
                )}
                <Container className="avatar-overlay p-absolute inset-0 d-flex items-center content-center">
                    {isUploading ? (
                        <Loader scale={0.6} isFixed={false} />
                    ) : (
                        <Camera size={24} />
                    )}
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
