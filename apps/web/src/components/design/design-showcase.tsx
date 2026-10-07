'use client';

import {
  BOOKING_STATUSES,
  type BookingStatus,
  isValidTunisianPhone,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Badge } from '@drivetn/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@drivetn/ui/breadcrumb';
import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { Checkbox } from '@drivetn/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@drivetn/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@drivetn/ui/dropdown-menu';
import { EmptyState } from '@drivetn/ui/empty-state';
import { ErrorState } from '@drivetn/ui/error-state';
import { Field, fieldDescribedBy } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { Label } from '@drivetn/ui/label';
import { Money } from '@drivetn/ui/money';
import { OtpInput } from '@drivetn/ui/otp-input';
import { Pagination } from '@drivetn/ui/pagination';
import { PaymentMethodBadges } from '@drivetn/ui/payment-method-badges';
import { PhoneInput } from '@drivetn/ui/phone-input';
import { RadioGroup, RadioGroupItem } from '@drivetn/ui/radio-group';
import { Rating } from '@drivetn/ui/rating';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@drivetn/ui/sheet';
import { Skeleton } from '@drivetn/ui/skeleton';
import { StatCard } from '@drivetn/ui/stat-card';
import { BookingStatusBadge, PaymentStatusBadge } from '@drivetn/ui/status-badges';
import { Stepper } from '@drivetn/ui/stepper';
import { Switch } from '@drivetn/ui/switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@drivetn/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@drivetn/ui/tabs';
import { Textarea } from '@drivetn/ui/textarea';
import { toast } from '@drivetn/ui/toaster';
import { Tooltip, TooltipContent, TooltipTrigger } from '@drivetn/ui/tooltip';
import { WhatsAppButton } from '@drivetn/ui/whatsapp-button';
import {
  CalendarCheck,
  CalendarX,
  CarFront,
  Eye,
  HandCoins,
  MoreHorizontal,
  Pencil,
  Plane,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

const GOVERNORATES = ['tunis', 'sousse', 'sfax', 'medenine'] as const;

const COLOR_SWATCHES = [
  { id: 'primary', className: 'bg-primary' },
  { id: 'cta', className: 'bg-cta' },
  { id: 'success', className: 'bg-success' },
  { id: 'warning', className: 'bg-warning' },
  { id: 'danger', className: 'bg-danger' },
  { id: 'info', className: 'bg-info' },
  { id: 'tunisia', className: 'bg-tn-red' },
] as const;

interface SampleBooking {
  reference: string;
  customer: string;
  start: Date;
  end: Date;
  totalMillimes: number;
  status: BookingStatus;
  payment: PaymentStatus;
}

const SAMPLE_BOOKINGS: SampleBooking[] = [
  {
    reference: 'DTN-2K4F9Q',
    customer: 'Amira Ben Salah',
    start: new Date('2026-10-12T09:00:00Z'),
    end: new Date('2026-10-15T09:00:00Z'),
    totalMillimes: 255_000,
    status: 'CONFIRMED',
    payment: 'DEPOSIT_PAID',
  },
  {
    reference: 'DTN-7H2M1X',
    customer: 'Youssef Trabelsi',
    start: new Date('2026-10-08T14:00:00Z'),
    end: new Date('2026-10-14T10:00:00Z'),
    totalMillimes: 480_500,
    status: 'PICKED_UP',
    payment: 'PAID',
  },
  {
    reference: 'DTN-9C5T3B',
    customer: 'Sarra Gharbi',
    start: new Date('2026-10-20T08:00:00Z'),
    end: new Date('2026-10-22T08:00:00Z'),
    totalMillimes: 132_000,
    status: 'PENDING',
    payment: 'UNPAID',
  },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="grid min-w-0 gap-3">
      <h2 id={`${id}-title`} className="text-lg font-bold">
        {title}
      </h2>
      <Card className="grid gap-6 p-4 sm:p-6">{children}</Card>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export function DesignShowcase() {
  const t = useTranslations('design');
  const tStatus = useTranslations('status');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [page, setPage] = useState(3);
  const [retrying, setRetrying] = useState(false);

  const phoneError =
    phone.length === 8 && !isValidTunisianPhone(phone) ? t('forms.phoneError') : undefined;
  const steps = [
    { id: 'vehicle', label: t('navigation.stepVehicle') },
    { id: 'options', label: t('navigation.stepOptions') },
    { id: 'driver', label: t('navigation.stepDriver') },
    { id: 'confirm', label: t('navigation.stepConfirm') },
  ];
  const formatDay = (date: Date) =>
    format.dateTime(date, { day: '2-digit', month: 'short', numberingSystem: 'latn' });

  return (
    <div className="grid gap-10">
      <Section id="colors" title={t('sections.colors')}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {COLOR_SWATCHES.map((swatch) => (
            <div key={swatch.id} className="grid gap-2">
              <div className={`h-16 rounded-card shadow-soft ${swatch.className}`} />
              <p className="text-sm font-medium">{t(`colors.${swatch.id}`)}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="typography" title={t('sections.typography')}>
        <div className="grid gap-3">
          <p className="font-heading text-3xl font-extrabold tracking-tight">
            {t('typography.heading')}
          </p>
          <p className="font-heading text-xl font-bold">{t('typography.heading')}</p>
          <p className="text-base">{t('typography.body')}</p>
          <p className="text-sm text-muted-foreground">{t('typography.small')}</p>
        </div>
      </Section>

      <Section id="buttons" title={t('sections.buttons')}>
        <Row>
          <Button>{t('buttons.primary')}</Button>
          <Button variant="cta">{t('buttons.cta')}</Button>
          <Button variant="secondary">{t('buttons.secondary')}</Button>
          <Button variant="soft">{t('buttons.soft')}</Button>
          <Button variant="ghost">{t('buttons.ghost')}</Button>
          <Button variant="danger">
            <Trash2 aria-hidden="true" />
            {t('buttons.danger')}
          </Button>
          <Button variant="link">{t('buttons.link')}</Button>
        </Row>
        <Row>
          <Button size="sm">{t('buttons.primary')}</Button>
          <Button size="md">{t('buttons.primary')}</Button>
          <Button size="lg" variant="cta">
            {t('buttons.cta')}
          </Button>
          <Button loading>{t('buttons.loading')}</Button>
          <Button disabled>{t('buttons.disabled')}</Button>
          <Button size="icon" variant="secondary" aria-label={t('buttons.icon')}>
            <Plus aria-hidden="true" />
          </Button>
        </Row>
      </Section>

      <Section id="forms" title={t('sections.forms')}>
        <div className="grid gap-6 md:grid-cols-2">
          <Field id="demo-name" label={t('forms.fullName')} requiredIndicator={t('forms.required')}>
            <Input
              id="demo-name"
              autoComplete="name"
              placeholder={t('forms.fullNamePlaceholder')}
              required
            />
          </Field>
          <Field
            id="demo-phone"
            label={t('forms.phone')}
            hint={t('forms.phoneHint')}
            error={phoneError}
          >
            <PhoneInput
              id="demo-phone"
              value={phone}
              onValueChange={setPhone}
              aria-invalid={phoneError !== undefined}
              aria-describedby={fieldDescribedBy('demo-phone', {
                hint: t('forms.phoneHint'),
                error: phoneError,
              })}
            />
          </Field>
          <Field id="demo-governorate" label={t('forms.governorate')}>
            <Select>
              <SelectTrigger id="demo-governorate">
                <SelectValue placeholder={t('forms.governoratePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {GOVERNORATES.map((governorate) => (
                  <SelectItem key={governorate} value={governorate}>
                    {t(`forms.governorates.${governorate}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div role="group" aria-labelledby="demo-otp-label" className="grid gap-2">
            <p id="demo-otp-label" className="text-sm font-medium">
              {t('forms.otp')}
            </p>
            <OtpInput
              value={otp}
              onValueChange={setOtp}
              getInputLabel={(index, length) =>
                t('forms.otpDigit', { index: String(index + 1), length: String(length) })
              }
            />
            <p className="text-sm text-muted-foreground">{t('forms.otpHint')}</p>
          </div>
          <Field id="demo-notes" label={t('forms.notes')} className="md:col-span-2">
            <Textarea id="demo-notes" placeholder={t('forms.notesPlaceholder')} />
          </Field>
          <div className="grid gap-3">
            <p id="demo-gearbox-label" className="text-sm font-medium">
              {t('forms.transmission')}
            </p>
            <RadioGroup defaultValue="manual" aria-labelledby="demo-gearbox-label">
              <div className="flex items-center gap-3">
                <RadioGroupItem id="demo-manual" value="manual" />
                <Label htmlFor="demo-manual">{t('forms.manual')}</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem id="demo-automatic" value="automatic" />
                <Label htmlFor="demo-automatic">{t('forms.automatic')}</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid content-start gap-4">
            <div className="flex items-center gap-3">
              <Checkbox id="demo-terms" />
              <Label htmlFor="demo-terms">{t('forms.terms')}</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="demo-notifications" defaultChecked />
              <Label htmlFor="demo-notifications">{t('forms.notifications')}</Label>
            </div>
          </div>
        </div>
      </Section>

      <Section id="badges" title={t('sections.badges')}>
        <Row>
          <Badge>{t('badges.neutral')}</Badge>
          <Badge tone="primary">{t('badges.primary')}</Badge>
          <Badge tone="info">
            <Sparkles aria-hidden="true" />
            {t('badges.new')}
          </Badge>
          <Badge tone="outline">
            <Plane aria-hidden="true" />
            {t('badges.airport')}
          </Badge>
          <Badge tone="tunisia">TN</Badge>
        </Row>
        <Row>
          {BOOKING_STATUSES.map((status) => (
            <BookingStatusBadge key={status} status={status}>
              {tStatus(`booking.${status}`)}
            </BookingStatusBadge>
          ))}
        </Row>
        <Row>
          {PAYMENT_STATUSES.map((status) => (
            <PaymentStatusBadge key={status} status={status}>
              {tStatus(`payment.${status}`)}
            </PaymentStatusBadge>
          ))}
        </Row>
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t('badges.paymentMethods')}</p>
          <PaymentMethodBadges
            methods={PAYMENT_METHODS}
            getLabel={(method) => tStatus(`paymentMethod.${method}`)}
          />
        </div>
      </Section>

      <Section id="feedback" title={t('sections.feedback')}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Alert tone="info" title={t('feedback.infoTitle')}>
            {t('feedback.infoText')}
          </Alert>
          <Alert tone="success" title={t('feedback.successTitle')}>
            {t('feedback.successText')}
          </Alert>
          <Alert tone="warning" title={t('feedback.warningTitle')}>
            {t('feedback.warningText')}
          </Alert>
          <Alert tone="danger" title={t('feedback.dangerTitle')}>
            {t('feedback.dangerText')}
          </Alert>
        </div>
        <Row>
          <Button
            variant="secondary"
            onClick={() => {
              toast.success(t('feedback.toastTitle'), { description: t('feedback.toastText') });
            }}
          >
            {t('feedback.toastButton')}
          </Button>
        </Row>
      </Section>

      <Section id="states" title={t('sections.states')}>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card
            className="grid content-start gap-4 p-4"
            role="status"
            aria-label={t('states.loading')}
          >
            <Skeleton className="aspect-[16/10] w-full rounded-card" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-11 w-28" />
            </div>
          </Card>
          <EmptyState
            icon={CalendarX}
            title={t('states.emptyTitle')}
            description={t('states.emptyText')}
            action={<Button variant="cta">{t('states.emptyAction')}</Button>}
          />
          <ErrorState
            title={t('states.errorTitle')}
            description={t('states.errorText')}
            retryLabel={tCommon('retry')}
            retrying={retrying}
            onRetry={() => {
              setRetrying(true);
              window.setTimeout(() => {
                setRetrying(false);
              }, 1200);
            }}
          />
        </div>
      </Section>

      <Section id="overlays" title={t('sections.overlays')}>
        <Row>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">{t('overlays.openDialog')}</Button>
            </DialogTrigger>
            <DialogContent closeLabel={t('overlays.dialogCancel')}>
              <DialogHeader>
                <DialogTitle>{t('overlays.dialogTitle')}</DialogTitle>
                <DialogDescription>{t('overlays.dialogText')}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">{t('overlays.dialogCancel')}</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger">{t('overlays.dialogConfirm')}</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {(['start', 'end', 'bottom'] as const).map((side) => (
            <Sheet key={side}>
              <SheetTrigger asChild>
                <Button variant="secondary">
                  {side === 'start'
                    ? t('overlays.openSheetStart')
                    : side === 'end'
                      ? t('overlays.openSheetEnd')
                      : t('overlays.openSheetBottom')}
                </Button>
              </SheetTrigger>
              <SheetContent side={side} closeLabel={t('overlays.dialogCancel')}>
                <SheetHeader>
                  <SheetTitle>{t('overlays.sheetTitle')}</SheetTitle>
                  <SheetDescription>{t('overlays.sheetText')}</SheetDescription>
                </SheetHeader>
                <div className="grid gap-3">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-2/3" />
                </div>
              </SheetContent>
            </Sheet>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('overlays.menu')}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>
                <Eye aria-hidden="true" />
                {t('overlays.menuView')}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Pencil aria-hidden="true" />
                {t('overlays.menuEdit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive>
                <Trash2 aria-hidden="true" />
                {t('overlays.menuDelete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost">{t('overlays.tooltip')}</Button>
            </TooltipTrigger>
            <TooltipContent>{t('overlays.tooltipText')}</TooltipContent>
          </Tooltip>
        </Row>
      </Section>

      <Section id="navigation" title={t('sections.navigation')}>
        <Breadcrumb aria-label={t('navigation.breadcrumbLabel')}>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#navigation-title">
                {t('navigation.breadcrumbHome')}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#navigation-title">
                {t('navigation.breadcrumbCity')}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('navigation.breadcrumbCar')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">{t('navigation.tabsDetails')}</TabsTrigger>
            <TabsTrigger value="conditions">{t('navigation.tabsConditions')}</TabsTrigger>
            <TabsTrigger value="reviews">{t('navigation.tabsReviews')}</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="text-sm text-muted-foreground">
            {t('navigation.tabsDetailsText')}
          </TabsContent>
          <TabsContent value="conditions" className="text-sm text-muted-foreground">
            {t('navigation.tabsConditionsText')}
          </TabsContent>
          <TabsContent value="reviews" className="text-sm text-muted-foreground">
            {t('navigation.tabsReviewsText')}
          </TabsContent>
        </Tabs>

        <div className="grid gap-4">
          <Stepper steps={steps} currentStep={step} />
          <Row>
            <Button
              variant="secondary"
              disabled={step === 0}
              onClick={() => {
                setStep((value) => Math.max(0, value - 1));
              }}
            >
              {t('navigation.previous')}
            </Button>
            <Button
              disabled={step === steps.length - 1}
              onClick={() => {
                setStep((value) => Math.min(steps.length - 1, value + 1));
              }}
            >
              {t('navigation.next')}
            </Button>
          </Row>
        </div>

        <Pagination
          page={page}
          pageCount={12}
          onPageChange={setPage}
          labels={{
            navigation: t('navigation.paginationLabel'),
            previous: t('navigation.paginationPrevious'),
            next: t('navigation.paginationNext'),
            page: (value) => t('navigation.paginationPage', { page: String(value) }),
          }}
        />
      </Section>

      <Section id="data" title={t('sections.data')}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label={t('data.statBookings')}
            value="48"
            icon={CalendarCheck}
            trend={t('data.statTrendUp')}
            trendDirection="up"
          />
          <StatCard
            label={t('data.statRevenue')}
            value={<Money millimes={12_450_000} locale={locale} />}
            icon={HandCoins}
          />
          <StatCard
            label={t('data.statFleet')}
            value="23"
            icon={CarFront}
            trend={t('data.statTrendDown')}
            trendDirection="down"
          />
        </div>

        <Table>
          <TableCaption>{t('data.tableCaption')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t('data.reference')}</TableHead>
              <TableHead>{t('data.customer')}</TableHead>
              <TableHead>{t('data.dates')}</TableHead>
              <TableHead className="text-end">{t('data.total')}</TableHead>
              <TableHead>{t('data.status')}</TableHead>
              <TableHead>{t('data.payment')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_BOOKINGS.map((booking) => (
              <TableRow key={booking.reference}>
                <TableCell className="font-mono text-xs" dir="ltr">
                  {booking.reference}
                </TableCell>
                <TableCell className="whitespace-nowrap font-medium">{booking.customer}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDay(booking.start)} – {formatDay(booking.end)}
                </TableCell>
                <TableCell className="text-end font-semibold">
                  <Money millimes={booking.totalMillimes} locale={locale} />
                </TableCell>
                <TableCell>
                  <BookingStatusBadge status={booking.status}>
                    {tStatus(`booking.${booking.status}`)}
                  </BookingStatusBadge>
                </TableCell>
                <TableCell>
                  <PaymentStatusBadge status={booking.payment}>
                    {tStatus(`payment.${booking.payment}`)}
                  </PaymentStatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Row>
          <Rating
            value={4.6}
            size="md"
            label={t('data.rating', {
              value: format.number(4.6, { numberingSystem: 'latn', maximumFractionDigits: 1 }),
            })}
          />
          <WhatsAppButton phone="20123456" message={t('data.whatsappMessage')}>
            {t('data.whatsapp')}
          </WhatsAppButton>
        </Row>
      </Section>
    </div>
  );
}
