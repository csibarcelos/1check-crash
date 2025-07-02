
// User Authentication
export interface User {
  id: string;
  email?: string | null; // Made non-optional
  name?: string;
  isSuperAdmin?: boolean;
  isActive?: boolean; // Adicionado para status da conta
  createdAt?: string; // Added for tracking user creation date
}

// For authService internal use, not exposed to UI directly usually
export interface UserWithPassword extends User {
  passwordHash: string; // In a real backend, this would be a hash
  isActive: boolean; // Garante que UserWithPassword sempre tenha isActive
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface DecodedToken {
  userId: string;
  email: string;
  name?: string;
  isSuperAdmin?: boolean;
  isActive?: boolean; // Adicionado para status da conta
  iat: number;
  exp: number;
}

// Product related new types
export interface Coupon {
  id: string;
  code: string;
  description?: string; // Optional description for admin
  discountType: 'percentage' | 'fixed'; // Fixed is in cents
  discountValue: number;
  isActive: boolean;
  isAutomatic: boolean; // If true, applies automatically if no other coupon is used
  minPurchaseValueInCents?: number; // Optional: Minimum purchase value to apply coupon
  uses?: number; // How many times it has been used
  maxUses?: number; // Optional: Maximum number of uses
  expiresAt?: string; // Optional: ISO date string
  appliesToProductId?: string; // For product-specific coupons, null/undefined for general
}

export interface TraditionalOrderBumpOffer {
  id: string; // Unique ID for this offer instance in the array
  productId: string; 
  customPriceInCents?: number; 
  name: string; // Label for checkbox
  description?: string; // Short description below label
  imageUrl?: string; 
}

export interface PostClickOffer {
  productId: string; 
  customPriceInCents?: number; 
  name: string; // Name of the offer product (used as fallback for modal title if modalTitle is not set)
  description: string; // Detailed description for the modal
  imageUrl?: string; 
  modalTitle?: string; // Customizable title for the modal itself
  modalAcceptButtonText?: string; // Customizable text for accept button
  modalDeclineButtonText?: string; // Customizable text for decline button
}

export interface UpsellOffer { // Esta é a oferta na página de Obrigado
  productId: string; 
  customPriceInCents?: number; 
  name: string; 
  description: string; 
  imageUrl?: string; 
  redirectUrl?: string; // New: For custom upsell redirect
}

// This interface is for the instant email sent upon purchase confirmation.
export interface DeliveryEmailConfig {
  enabled: boolean;
  subject: string;
  bodyHtml: string;
}

// This is the interface for the delayed follow-up email.
export interface FollowUpEmailConfig {
  enabled: boolean;
  delayDays: number; // Delay in days after purchase
  subject: string;
  bodyHtml: string;
}

// This is the new container object for both email configurations.
export interface PostPurchaseEmails {
  delivery: DeliveryEmailConfig;
  followUp: FollowUpEmailConfig;
}


// Product
export interface ProductCheckoutCustomization {
  primaryColor?: string;
  logoUrl?: string;
  videoUrl?: string;
  salesCopy?: string; 
  testimonials?: { author: string; text: string }[];
  guaranteeBadges?: { id: string; imageUrl: string; altText: string }[];
  countdownTimer?: {
    enabled: boolean;
    durationMinutes?: number; 
    messageBefore?: string;
    messageAfter?: string; 
    backgroundColor?: string;
    textColor?: string;
  };
  theme?: 'light' | 'dark'; 
  showProductName?: boolean; // Se o nome do produto deve ser exibido no header do checkout
  animateTraditionalOrderBumps?: boolean; // Para controlar a animação dos order bumps tradicionais
  brandName?: string; // Adicionado brandName
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface Product {
  id: string;
  platformUserId: string;
  slug?: string; 
  name: string;
  description: string;
  priceInCents: number;
  imageUrl?: string; // Considered the 'banner' image
  productImageUrl?: string; // The main square 'thumbnail' for the product
  
  checkoutCustomization: ProductCheckoutCustomization | null; 
  deliveryUrl?: string;
  totalSales?: number;
  clicks?: number;
  checkoutViews?: number;
  conversionRate?: number;
  abandonmentRate?: number;
  orderBumps?: TraditionalOrderBumpOffer[]; // Array for checkbox-style bumps
  postClickOffer?: PostClickOffer;        // Single offer for post-click modal
  upsell?: UpsellOffer;                    // Oferta na página de Obrigado
  coupons?: Coupon[];
  utmParams?: UtmParams | null; 
  postPurchaseEmailConfig?: PostPurchaseEmails; // UPDATED
  whatsappTemplates?: WhatsappTemplates; // NEW: WhatsApp message templates
}
export interface Buyer {
  id: string;
  session_id?: string;
  auth_user_id?: string;
  email?: string;
  name?: string;
  whatsapp?: string;
  created_at?: string;
  updated_at?: string;
}

// Sale
export enum PaymentStatus {
  WAITING_PAYMENT = 'waiting_payment',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

export enum PaymentMethod {
  PIX = 'pix',
  CREDIT_CARD = 'credit_card',
  BOLETO = 'boleto',
}

export interface SaleProductItem {
  productId: string;
  name: string;
  quantity: number;
  priceInCents: number; 
  originalPriceInCents: number; 
  isTraditionalOrderBump?: boolean; // Flag for checkbox-style order bumps
  isPostClickOffer?: boolean;      // Flag for modal-style post-click offer
  isUpsell?: boolean;                // Usado para identificar se o item veio do Upsell da ThankYouPage
  deliveryUrl?: string;
  slug?: string; 
}

export interface Sale {
  id: string;
  buyerId?: string; 
  platformUserId: string;
  pushInPayTransactionId: string; 
  upsellPushInPayTransactionId?: string; 
  orderIdUrmify?: string;
  products: SaleProductItem[]; 
  customer: {
    name: string;
    email: string;
    ip?: string;
    whatsapp: string;
  };
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  upsellStatus?: PaymentStatus; 
  totalAmountInCents: number; 
  upsellAmountInCents?: number; 
  originalAmountBeforeDiscountInCents: number; 
  discountAppliedInCents?: number;
  couponCodeUsed?: string;
  createdAt: string;
  paidAt?: string;
  trackingParameters?: Record<string, string>; 
  commission?: { 
    totalPriceInCents: number; 
    gatewayFeeInCents: number;
    userCommissionInCents: number;
    currency: string;
  };
  platformCommissionInCents?: number; 
  pixQrCode?: string; // NEW
  pixQrCodeBase64?: string; // NEW
  pix_recovery_emails_sent?: Json | null; // NEW
}
    export interface SaleTransaction {
    id: string;
    platformUserId: string;
    valueInCents: number; 
    originalValueBeforeDiscountInCents: number; 
    couponCodeUsed?: string; 
    discountAppliedToTransactionInCents?: number;
    qrCode?: string;
    qrCodeBase64?: string;
    status: PaymentStatus;
    attempts: number;
    createdAt: string;
    paidAt?: string;
    webhookUrl: string;
    customerName: string;
    customerEmail: string;
    customerWhatsapp: string;
    products: SaleProductItem[]; 
    trackingParameters?: Record<string, string>;
    isUpsellTransaction?: boolean; 
    originalSaleId?: string; 
}


// Customer
export enum FunnelStage {
  LEAD = 'lead',
  PROSPECT = 'prospect',
  CUSTOMER = 'customer',
}

export interface Customer {
  id: string; 
  platformUserId: string;
  name: string;
  email: string;
  whatsapp: string;
  productsPurchased: string[]; 
  funnelStage: FunnelStage;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  totalOrders: number;
  totalSpentInCents: number;
  saleIds: string[]; 
}

// Abandoned Cart
export enum AbandonedCartStatus {
  NOT_CONTACTED = 'not_contacted',
  RECOVERY_EMAIL_SENT = 'recovery_email_sent', // Added new status
  RECOVERED = 'recovered',
  IGNORED = 'ignored',
}

export interface AbandonedCart {
  id: string;
  platformUserId: string;
  customerName: string | null;
  customerEmail: string;
  customerWhatsapp: string;
  productId: string;
  productName: string;
  potentialValueInCents: number;
  date: string; // Same as created_at
  lastInteractionAt: string;
  status: AbandonedCartStatus;
  trackingParameters?: Record<string, string>; 
  recoveryEmailSentAt?: string; // Added
}

// Finances
export interface FinancialSummary {
  balance: number;
  pending: number;
  availableForWithdrawal: number;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number; // in cents
  type: 'credit' | 'debit';
}

// Integrations
export type PixelType = 'Facebook Pixel' | 'Google Ads' | 'GTM' | 'TikTok Pixel';
export interface PixelIntegration {
  id: string; 
  type: PixelType; 
  settings: Record<string, string>; 
  enabled: boolean;
}

export interface AbandonedCartEmailConfig {
  enabled: boolean;
  delayMinutes: number; // Changed from delayHours
  subject: string;
  bodyHtml: string;
}

export interface PixGeneratedEmailConfig {
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  // New placeholders for email templates
  // {{all_product_names}}: comma-separated list of all product names in the sale
  // {{product_list_html}}: HTML unordered list of all products with their prices
}

export interface PixRecoveryEmail {
  enabled: boolean;
  delayMinutes: 15 | 30 | 60;
  subject: string;
  bodyHtml: string;
}

export interface PixRecoveryConfig {
  email1: PixRecoveryEmail;
  email2: PixRecoveryEmail;
  email3: PixRecoveryEmail;
}

export interface WhatsappMessageConfig {
  enabled: boolean;
  message: string;
  placeholders: string[]; // List of available placeholders for this message
}

export interface WhatsappTemplates {
  saleApproved: WhatsappMessageConfig;
  abandonedCart: WhatsappMessageConfig;
  // Add other WhatsApp message types here as needed
}

export interface NotificationSettings {
  notifyOnAbandonedCart: boolean;
  notifyOnOrderPlaced: boolean;
  notifyOnSaleApproved: boolean;
  playSaleSound: boolean;
}

export interface AppSettings {
  customDomain?: string;
  checkoutIdentity: {
    logoUrl?: string;
    faviconUrl?: string;
    brandColor?: string;
    brandName?: string; // Added brandName
  };
  smtpSettings?: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  apiTokens: {
    pushinPay: string; 
    utmify: string;
    pushinPayEnabled: boolean; 
    utmifyEnabled: boolean;
    pushinPayApiToken?: string; // Adicionado
    pushinPayWebhookToken?: string; // Adicionado
  };
  pixelIntegrations?: PixelIntegration[]; 
  abandonedCartRecoveryConfig?: AbandonedCartEmailConfig;
  pixGeneratedEmailConfig?: PixGeneratedEmailConfig; // NEW
  pixRecoveryConfig?: PixRecoveryConfig; // NEW
  whatsappTemplates?: WhatsappTemplates; // NEW: WhatsApp message templates
  notificationSettings?: NotificationSettings;
}
  export interface PlatformSettings {
  id: 'global'; 
  platformCommissionPercentage: number; 
  platformFixedFeeInCents: number; 
  platformAccountIdPushInPay: string; 
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; 
  actorUserId: string;
  actorEmail: string;
  actionType: string; 
  targetEntityType?: string; 
  targetEntityId?: string;
  description: string; 
  details?: Record<string, any>; 
}


// For dashboard metric cards
export interface MetricData {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ElementType;
  bgColorClass: string;
  textColorClass: string;
}

export interface DashboardData {
  totalRevenue: number;
  numberOfSales: number;
  averageTicket: number;
  newCustomers: number;
  salesTrend: { periodLabel: string; amount: number }[];
  topSellingProducts?: { id: string; name: string; quantitySold: number; revenueGenerated: number; }[];
}


// PushInPay API Types
export interface PushInPayPixRequest {
  value: number; 
  originalValueBeforeDiscount: number; 
  webhook_url: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  products: SaleProductItem[]; 
  trackingParameters?: Record<string, string>;
  couponCodeUsed?: string;
  discountAppliedInCents?: number;
  isUpsellTransaction?: boolean; 
  originalSaleId?: string;      
  buyerId?: string; 
}

export interface PushInPayPixResponseData {
  id: string;
  qr_code: string;
  qr_code_base64: string;
  status: string; 
  value: number; 
}
export interface PushInPayPixResponse {
  data?: PushInPayPixResponseData; 
  success: boolean;
  message?: string;
}

export interface PushInPayTransactionStatusData {
    id: string;
    status: string; 
    value: number;
    paid_at?: string;
}

export interface PushInPayTransactionStatusResponse {
    data?: PushInPayTransactionStatusData; 
    success: boolean;
    message?: string;
}


// UTMify API Types
export interface UtmifyCustomer {
  name: string;
  email: string;
  whatsapp: string;
  phone: string | null; 
  document: string | null; 
  ip?: string;
}

export interface UtmifyProduct {
  id: string; 
  name: string;
  quantity: number;
  priceInCents: number; 
  planId: string; 
  planName: string; 
}

export interface UtmifyCommission {
  totalPriceInCents: number; 
  gatewayFeeInCents: number;
  userCommissionInCents: number;
  currency: string;
}

export interface UtmifyTrackingParameters {
  utm_campaign: string | null;
  utm_content: string | null;
  utm_medium: string | null;
  utm_source: string | null;
  utm_term: string | null;
}

export interface UtmifyOrderPayload {
  orderId: string; 
  platform: string;
  paymentMethod: "pix" | "credit_card" | "boleto";
  status: string; // PaymentStatus
  createdAt: string; 
  approvedDate: string | null; 
  customer: UtmifyCustomer;
  products: UtmifyProduct[]; 
  trackingParameters: UtmifyTrackingParameters; 
  commission?: UtmifyCommission; 
  refundedAt?: string | null; 
  isTest?: boolean;
  couponCodeUsed?: string;
  discountAppliedInCents?: number;
  originalAmountBeforeDiscountInCents?: number; 
  isUpsellTransaction?: boolean; 
  originalSaleId?: string; 
}

export interface UtmifyResponse {
  success: boolean;
  message?: string;
  data?: any; 
  utmifyResponse?: any; 
}

// For navigation items
export interface NavItemConfig {
  name: string;
  href: string;
  icon: React.ElementType;
  soon?: boolean;
}

// API Client related types
export interface ApiError {
  message: string;
  status?: number;
}

export interface ApiErrorResponse {
  error: ApiError;
}

// Live View Event Type
export interface LiveViewEvent {
  type: 'checkout_enter' | 'checkout_leave' | 'pix_pending_enter' | 'pix_pending_leave' | 'sale_confirmed_recent';
  payload?: {
    timestamp?: number;
    userId?: string;
    checkoutSessionId?: string;
  };
}

// Sent Follow-Up Email Tracking
export interface SentFollowUpEmail {
  id: string;
  sale_id: string;
  product_id: string;
  platform_user_id: string;
  sent_at: string;
}
