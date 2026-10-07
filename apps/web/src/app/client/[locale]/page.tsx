import { ClientHome } from '@/components/pages/client-home';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

export default async function ClientHomePage({ params }: LocaleParams) {
  await resolveLocale(params);
  return <ClientHome />;
}
