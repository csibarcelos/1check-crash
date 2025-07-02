import { PaymentStatus } from '../types';

export const getTranslatedPaymentStatusLabel = (status: PaymentStatus | string): string => {
  switch (status) {
    case PaymentStatus.PAID:
      return 'PAGO';
    case PaymentStatus.WAITING_PAYMENT:
      return 'PENDENTE';
    case PaymentStatus.CANCELLED:
      return 'CANCELADO';
    case PaymentStatus.EXPIRED:
      return 'EXPIRADO';
    case PaymentStatus.FAILED:
      return 'FALHOU';
    default:
      return String(status).replace(/_/g, ' ').toUpperCase();
  }
};

export const getPaymentStatusOptions = () => {
  return [
    { value: PaymentStatus.PAID, label: getTranslatedPaymentStatusLabel(PaymentStatus.PAID) },
    { value: PaymentStatus.WAITING_PAYMENT, label: getTranslatedPaymentStatusLabel(PaymentStatus.WAITING_PAYMENT) },
    { value: PaymentStatus.CANCELLED, label: getTranslatedPaymentStatusLabel(PaymentStatus.CANCELLED) },
    { value: PaymentStatus.EXPIRED, label: getTranslatedPaymentStatusLabel(PaymentStatus.EXPIRED) },
    { value: PaymentStatus.FAILED, label: getTranslatedPaymentStatusLabel(PaymentStatus.FAILED) },
  ];
};