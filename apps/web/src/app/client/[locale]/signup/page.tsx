import { authPageMetadata, createSignupPage } from '@/components/auth/auth-pages';

export const generateMetadata = authPageMetadata('signup.client');

export default createSignupPage('client');
