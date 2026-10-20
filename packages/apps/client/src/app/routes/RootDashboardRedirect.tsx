import { Navigate } from 'react-router-dom';

const RootDashboardRedirect = () => {
    return <Navigate to='/dashboard' replace />;
};

export default RootDashboardRedirect;
