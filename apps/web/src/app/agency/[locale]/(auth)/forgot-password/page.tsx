import { authPageMetadata, createForgotPasswordPage } from '@/components/auth/auth-pages';

export const generateMetadata = authPageMetadata('forgot');

export default createForgotPasswordPage('agency');
