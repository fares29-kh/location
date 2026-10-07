import { BookingDetailView } from '@/components/agency/bookings/booking-detail-view';
import { agencyPageMetadata } from '@/lib/agency/page-metadata';

export const generateMetadata = agencyPageMetadata('bookings');

export default async function AgencyBookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  return <BookingDetailView bookingId={id} />;
}
