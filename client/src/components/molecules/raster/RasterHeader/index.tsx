import React from 'react';
import type { HeaderProps } from '@/types/raster';
import { BsArrowLeft } from 'react-icons/bs';
import { IoLogInOutline, IoSearchOutline } from 'react-icons/io5';
import { RxEyeOpen } from 'react-icons/rx';
import { motion } from 'framer-motion';
import { TbCube3dSphere } from 'react-icons/tb';
import RasterTrajectoryDetailsSkeleton from '@/components/atoms/raster/RasterTrajectoryDetailsSkeleton';

const Header: React.FC<HeaderProps> = ({ trajectory, isLoading, onGoBack, onView3D, onSignIn }) => {
    return (
        <div className='raster-scene-header-container'>
            <div className='raster-scene-header-left-container'>
                <i className='raster-scene-header-go-back-icon-container' onClick={onGoBack}>
                    <BsArrowLeft />
                </i>

                <div className='raster-scene-header-team-container'>
                    {isLoading ? (
                        <RasterTrajectoryDetailsSkeleton />
                    ) : (
                        <>
                            <h3 className='raster-scene-header-title'>
                                {trajectory?.name || 'Loading...'}
                            </h3>

                            <p className='raster-scene-header-last-edited'>Last Edited by Rodolfo H</p>
                        </>
                    )}
                </div>
            </div>

            <div className='raster-scene-header-search-container'>
                <div className='dashboard-search-container'>
                    <div className='search-container'>
                        <i className='search-icon-container'>
                            <IoSearchOutline />
                        </i>

                        <input
                            placeholder='Search uploaded team trajectories'
                            className='search-input' />
                    </div>
                </div>

                <div className='raster-scene-header-views-container'>
                    <i className='raster-scene-header-views-icon-container'>
                        <RxEyeOpen />
                    </i>

                    <p className='raster-scene-header-views'>48 views</p>
                </div>
            </div>

            <div className='raster-scene-header-nav-container'>
                <motion.button
                    className='btn-3d'
                    aria-label='View in 3D'
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onView3D}
                >
                    <span className='btn-3d-glow' />
                    <TbCube3dSphere size={18} />
                    <span>View in 3D</span>
                </motion.button>

                <motion.button
                    className='btn-signin'
                    aria-label='Sign in'
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onSignIn}
                >
                    <span className='btn-signin-glow' />
                    <IoLogInOutline size={18} />
                    <span>Sign In</span>
                </motion.button>
            </div>
        </div>
    );
};

export default Header;