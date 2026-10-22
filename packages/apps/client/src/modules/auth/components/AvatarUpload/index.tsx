import Loader from '@/shared/ui/components/Loader';
import SettingsRow from '@/modules/auth/components/SettingsRow';
import { Button } from '@heroui/react';
import { Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

interface AvatarUploadProps {
    avatarUrl: string | null;
    initials: string;
    isUploading: boolean;
    onUpload: (file: File) => Promise<void>;
}

const AvatarUpload = ({
    avatarUrl,
    initials,
    isUploading,
    onUpload
}: AvatarUploadProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(avatarUrl);

    useEffect(() => {
        setPreview(avatarUrl);
    }, [avatarUrl]);

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

    const avatar = (
        <span className='flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-default text-2xl font-medium text-foreground'>
            {preview
                ? <img src={preview} alt='Profile picture' className='size-full object-cover' />
                : initials}
        </span>
    );

    return (
        <>
            <SettingsRow
                leading={avatar}
                title='Profile Picture'
                description='Click to upload a new avatar (JPG, PNG, max 5MB)'
                rightContent={(
                    <Button
                        variant='secondary'
                        size='sm'
                        isPending={isUploading}
                        onPress={() => fileInputRef.current?.click()}
                        aria-label={preview ? 'Upload a new profile picture' : 'Upload profile picture'}
                    >
                        {isUploading ? <Loader size='sm' color='current' /> : <Upload size={16} aria-hidden='true' />}
                        Upload
                    </Button>
                )} />
            <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                onChange={handleFileChange}
                className='hidden'
                tabIndex={-1}
                aria-hidden='true'
            />
        </>
    );
};

export default AvatarUpload;
