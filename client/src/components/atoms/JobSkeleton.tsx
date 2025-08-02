import { Box, Skeleton, Stack } from '@mui/material';

const JobSkeleton: React.FC = ({ n = 10 }) => (
    <Stack spacing={0}>
        {Array.from({ length: n }, (_, index) => (
            <Box
                key={index}
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 1.5,
                    px: 0,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                    <Skeleton 
                        variant="circular" 
                        width={30} 
                        height={30}
                        sx={{ flexShrink: 0 }}
                    />
                    
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Skeleton 
                            variant="text" 
                            width="70%" 
                            height={20}
                            sx={{ mb: 0.5 }}
                        />
                        <Skeleton 
                            variant="text" 
                            width="100px" 
                            height={16}
                        />
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Skeleton 
                        variant="rounded" 
                        width={60} 
                        height={18}
                        sx={{ borderRadius: '12px' }}
                    />
                </Box>
            </Box>
        ))}
    </Stack>
);

export default JobSkeleton;