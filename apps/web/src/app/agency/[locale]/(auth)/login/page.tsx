import { authPageMetadata, createLoginPage } from '@/components/auth/auth-pages';

export const generateMetadata = authPageMetadata('login');

export default createLoginPage('agency');
