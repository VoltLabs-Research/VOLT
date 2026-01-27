/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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
