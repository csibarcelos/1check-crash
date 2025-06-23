
import React from 'react';
import { NavItemConfig } from '@/types'; // Corrected path
export const SUPER_ADMIN_EMAIL = 'usedonjuan@gmail.com'; 

import {
  AdjustmentsHorizontalIcon,
  ShieldCheckIcon,
  TableCellsIcon,
  BanknotesIcon,
  ChartPieIcon as HeroIconsChartPieIcon,
  CurrencyDollarIcon as HeroIconsCurrencyDollarIcon,
  UserGroupIcon as HeroIconsUserGroupIcon,
  DocumentDuplicateIcon as HeroIconsDocumentDuplicateIcon,
  TrashIcon as HeroIconsTrashIcon,
  PlusIcon as HeroIconsPlusIcon,
  CheckIcon as HeroIconsCheckIcon, // Renamed to avoid conflict
  ChevronDownIcon as HeroIconsChevronDownIcon, // Added
  XMarkIcon as HeroIconsXMarkIcon,
  KeyIcon as HeroIconsKeyIcon,
  InformationCircleIcon as HeroIconsInformationCircleIcon,
  PencilIcon as HeroIconsPencilIcon,
  EyeIcon as HeroIconsEyeIcon, // Added EyeIcon import
  TagIcon as HeroIconsTagIcon,
  Bars3Icon,
  LockClosedIcon as HeroIconsLockClosedIcon,
  CloudArrowUpIcon as HeroIconsCloudArrowUpIcon, // Added for UploadIcon
  CalendarDaysIcon as HeroIconsCalendarDaysIcon, // Added CalendarDaysIcon
  Square2StackIcon as HeroIconsSquare2StackIcon, // Added Square2StackIcon for clone
  EllipsisVerticalIcon as HeroIconsEllipsisVerticalIcon, // Added for three-dots menu
  ArrowDownTrayIcon as HeroIconsArrowDownTrayIcon, // Added for Save action
  CheckCircleIcon as HeroIconsCheckCircleIcon, // Added for Save and Continue or success states
  LinkIcon as HeroIconsLinkIcon, // Added for generic link actions
  ArrowUturnLeftIcon as HeroIconsArrowUturnLeftIcon, // Added for Back/Return action
  ArrowTopRightOnSquareIcon as HeroIconsArrowTopRightOnSquareIcon, // Added for External Link indication
  ExclamationCircleIcon as HeroIconsExclamationCircleIcon, // Added for error indication
} from '@heroicons/react/24/outline';

// Add explicit types to re-exported const icon components
export const AdjustmentsHorizontalIconReact: React.FC<React.SVGProps<SVGSVGElement>> = AdjustmentsHorizontalIcon;
export const ShieldCheckIconReact: React.FC<React.SVGProps<SVGSVGElement>> = ShieldCheckIcon;
export const TableCellsIconReact: React.FC<React.SVGProps<SVGSVGElement>> = TableCellsIcon;
export const BanknotesIconReact: React.FC<React.SVGProps<SVGSVGElement>> = BanknotesIcon;

export const HomeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.5 1.5 0 012.122 0l8.954 8.955M11.25 12.75V21m0-8.25H2.25m9 0h9M3.75 21h16.5M12 3.75l-9 9h18l-9-9z" />
    </svg>
  );
};

export const PresentationChartLineIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v16.5h16.5M3.75 19.5L7.5 15.75l3 3L15 12l5.25 5.25" />
    </svg>
  );
};

export const CubeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
};

export const ShoppingCartIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  );
};

export const UsersIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
};

export const ArchiveBoxXMarkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h6M9 11.25h6m-6 4.5h6M6.75 21H2.25a.75.75 0 01-.75-.75V4.5c0-.414.336-.75.75-.75h19.5c.414 0 .75.336.75.75v15.75a.75.75 0 01-.75-.75H17.25m-3.75-12l-3 3m0 0l-3-3m3 3v9.75M16.5 6.75l3 3m0 0l3-3m-3 3V3" />
    </svg>
  );
};

export const CreditCardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3M3.75 15h16.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
};

export const LinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = HeroIconsLinkIcon; // Changed to use HeroIcon

export const CogIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m18 0h-1.5m-15 0a7.5 7.5 0 1115 0m-15 0H3m18 0h-1.5m-15 0a7.5 7.5 0 1115 0m-15 0H3m18 0h-1.5M12 4.5v.01M12 8.25v.01M12 12v.01M12 15.75v.01M12 19.5v.01M6.375 6.375L6.375 6.375m11.25 11.25l.001.001M4.5 12H3m1.5 0a7.5 7.5 0 1115 0m-15 0H3m1.5 0a7.5 7.5 0 1115 0M3 12h1.5M21 12h-1.5m-15 0H3m1.5 0H21" />
    </svg>
  );
};

export const LogoutIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
};

export const BoldIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5c1.036 0 1.875.84 1.875 1.875v1.5c0 1.035-.84 1.875-1.875 1.875h-7.5c-1.036 0-1.875-.84-1.875-1.875v-1.5C6.375 7.59 7.214 6.75 8.25 6.75zm0 6h7.5c1.036 0 1.875.84 1.875 1.875v1.5c0 1.035-.84 1.875-1.875 1.875h-7.5c-1.036 0-1.875-.84-1.875-1.875v-1.5c0-1.035.84-1.875 1.875-1.875z" transform="matrix(0.8 0 0 1 1.5 0.75)"/>
    </svg>
  );
};

export const ItalicIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5l3 15m0 0l3-15M12 19.5h.01" />
    </svg>
  );
};

export const UnderlineIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 19.5h12M9 4.5v10.5a3 3 0 003 3h0a3 3 0 003-3V4.5" />
    </svg>
  );
};

export const ListOrderedIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12" />
      <text x="2.5" y="7.75" fontSize="4" fill="currentColor" fontFamily="sans-serif" fontWeight="bold">1.</text>
      <text x="2.5" y="13" fontSize="4" fill="currentColor" fontFamily="sans-serif" fontWeight="bold">2.</text>
      <text x="2.5" y="18.25" fontSize="4" fill="currentColor" fontFamily="sans-serif" fontWeight="bold">3.</text>
    </svg>
  );
};

export const ListUnorderedIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12" />
      <circle cx="4.5" cy="6.75" r={1.125} fill="currentColor"/>
      <circle cx="4.5" cy="12" r={1.125} fill="currentColor"/>
      <circle cx="4.5" cy="17.25" r={1.125} fill="currentColor"/>
    </svg>
  );
};

export const ParagraphIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => ( 
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
  </svg>
);

export const AlignLeftIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5M3.75 17.25h16.5" />
  </svg>
);

export const AlignCenterIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M6.75 12h10.5M3.75 17.25h16.5" />
  </svg>
);

export const AlignRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M9.75 12h10.5M3.75 17.25h16.5" />
  </svg>
);

export const AlignJustifyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
  </svg>
);

export const UnlinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244M10.445 10.445L13.555 13.555M8.25 3.007L3.007 8.25m5.243 5.243l-5.243 5.243" />
  </svg>
);

export const ClearFormatIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => ( 
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

export const UploadIcon: React.FC<React.SVGProps<SVGSVGElement>> = HeroIconsCloudArrowUpIcon;
export const ArrowUturnLeftIconHero: React.FC<React.SVGProps<SVGSVGElement>> = HeroIconsArrowUturnLeftIcon;
export const ExternalLinkIconHero: React.FC<React.SVGProps<SVGSVGElement>> = HeroIconsArrowTopRightOnSquareIcon;


export const ChartPieIcon = HeroIconsChartPieIcon;
export const CurrencyDollarIcon = HeroIconsCurrencyDollarIcon;
export const UserGroupIcon = HeroIconsUserGroupIcon;
export const DocumentDuplicateIcon = HeroIconsDocumentDuplicateIcon;
export const TrashIcon = HeroIconsTrashIcon;
export const PlusIcon = HeroIconsPlusIcon;
export const CheckIcon = HeroIconsCheckIcon; 
export const ChevronDownIcon = HeroIconsChevronDownIcon; 
export const XMarkIcon = HeroIconsXMarkIcon;
export const KeyIcon = HeroIconsKeyIcon;
export const InformationCircleIcon = HeroIconsInformationCircleIcon;
export const EyeIcon = HeroIconsEyeIcon; 
export const PencilIcon = HeroIconsPencilIcon;
export const TagIcon = HeroIconsTagIcon;
export const Bars3IconHero = Bars3Icon;
export const LockClosedIcon = HeroIconsLockClosedIcon; 
export const CalendarDaysIcon = HeroIconsCalendarDaysIcon; 
export const Square2StackIconHero = HeroIconsSquare2StackIcon;
export const EllipsisVerticalIcon = HeroIconsEllipsisVerticalIcon;
export const ArrowDownTrayIcon = HeroIconsArrowDownTrayIcon;
export const CheckCircleIcon = HeroIconsCheckCircleIcon;
export const ExclamationCircleIcon = HeroIconsExclamationCircleIcon;


export const AppLogoIcon: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => {
  const { className: incomingClassName,alt, ...otherProps } = props;
  const finalClassName = `object-contain ${incomingClassName || 'h-10 w-auto'}`;
  return (
    <img
      src="https://i.imgur.com/kdm9n4P.png"
      alt={alt || "1Checkout Logo"}
      className={finalClassName}
      {...otherProps}
    />
  );
};

export const WhatsAppIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.31 3.43 16.76L2 22L7.33 20.59C8.75 21.37 10.35 21.82 12.04 21.82C17.5 21.82 21.95 17.37 21.95 11.91C21.95 9.24 20.92 6.78 19.05 4.91C17.18 3.03 14.72 2 12.04 2M12.04 3.67C14.22 3.67 16.22 4.5 17.73 6.01C19.24 7.52 20.08 9.52 20.08 11.91C20.08 16.41 16.44 20.15 12.04 20.15C10.56 20.15 9.16 19.76 7.97 19.05L7.53 18.81L5.23 19.46L5.9 17.21L5.64 16.76C4.84 15.46 4.39 13.97 4.39 11.91C4.39 7.41 8 3.67 12.04 3.67M9.04 7.62C8.87 7.62 8.64 7.67 8.46 7.95C8.27 8.22 7.66 8.83 7.66 9.93C7.66 11.03 8.48 12.08 8.62 12.25C8.77 12.42 10.03 14.54 12.22 15.44C14.03 16.18 14.49 16.02 14.88 15.97C15.48 15.89 16.42 15.31 16.66 14.73C16.91 14.15 16.91 13.68 16.82 13.57C16.74 13.46 16.57 13.38 16.32 13.24C16.08 13.11 14.97 12.57 14.75 12.48C14.52 12.38 14.36 12.33 14.19 12.61C14.02 12.88 13.53 13.46 13.39 13.64C13.24 13.81 13.1 13.83 12.85 13.7C12.61 13.57 11.82 13.31 10.87 12.45C10.12 11.78 9.62 10.94 9.47 10.72C9.32 10.5 9.46 10.36 9.59 10.23C9.7 10.11 9.85 9.91 10 9.76C10.15 9.61 10.21 9.49 10.33 9.27C10.46 9.06 10.38 8.88 10.3 8.75C10.23 8.62 9.57 7.8 9.34 7.7C9.12 7.64 9.04 7.62 9.04 7.62Z" />
    </svg>
  );
};

export const NAV_ITEMS: NavItemConfig[] = [
  { name: 'Dashboard', href: '/dashboard', icon: PresentationChartLineIcon },
  { name: 'Produtos', href: '/produtos', icon: CubeIcon },
  { name: 'Vendas', href: '/vendas', icon: ShoppingCartIcon, soon: false },
  { name: 'Clientes', href: '/clientes', icon: UsersIcon, soon: false },
  { name: 'Carrinhos Abandonados', href: '/carrinhos-abandonados', icon: ArchiveBoxXMarkIcon, soon: false },
  { name: 'Integrações', href: '/integracoes', icon: LinkIcon, soon: false },
  { name: 'Configurações', href: '/configuracoes', icon: CogIcon, soon: false },
];

export const NAV_ITEMS_SUPER_ADMIN: NavItemConfig[] = [
  { name: 'Dashboard Admin', href: '/superadmin/dashboard', icon: ShieldCheckIconReact },
  { name: 'Config. Plataforma', href: '/superadmin/configuracoes-plataforma', icon: AdjustmentsHorizontalIconReact },
  { name: 'Todos Usuários', href: '/superadmin/usuarios', icon: UserGroupIcon },
  { name: 'Todas Vendas', href: '/superadmin/vendas-gerais', icon: BanknotesIconReact },
  { name: 'Log de Auditoria', href: '/superadmin/audit-log', icon: TableCellsIconReact },
  { name: 'Todos os Produtos', href: '/superadmin/todos-produtos', icon: ChartPieIcon },
];

export const LOCALSTORAGE_KEYS = {
  USERS: 'plataformaCheckoutUsers_mock',
  PRODUCTS: 'plataformaCheckoutProducts_mock',
  SALES: 'plataformaCheckoutSales_mock',
  CUSTOMERS: 'plataformaCheckoutCustomers_mock',
  ABANDONED_CARTS: 'plataformaCheckoutAbandonedCarts_mock',
  PIX_TRANSACTIONS: 'plataformaCheckoutPixTransactions_mock',
  APP_SETTINGS: 'plataformaCheckoutAppSettings_mock',
  PLATFORM_SETTINGS: 'plataformaCheckoutPlatformSettings_mock',
  AUDIT_LOGS: 'plataformaCheckoutAuditLogs_mock',
};

export const PUSHINPAY_API_BASE = 'https://api.pushinpay.com.br/api';
export const UTMIFY_API_BASE = 'https://api.utmify.com.br/api-credentials';

export const MOCK_WEBHOOK_URL = 'https://webhook.site/mock-platform-checkout';
export const PLATFORM_NAME = "Pushin Pay";
export const DEFAULT_CURRENCY = "BRL";

export const COLOR_PALETTE_OPTIONS = [
  { name: 'Verde Padrão', value: '#0D9488' },
  { name: 'Laranja Shopee', value: '#EE4D2D' },
  { name: 'Amarelo M. Livre', value: '#FFF159' },
  { name: 'Laranja Amazon', value: '#FF9900' },
  { name: 'Vermelho YouTube', value: '#FF0000' },
  { name: 'Verde WhatsApp', value: '#25D366' },
  { name: 'Azul Facebook', value: '#1877F2' },
  { name: 'Azul Clássico', value: '#007BFF' },
  { name: 'Roxo Twitch', value: '#9146FF' },
  { name: 'Cinza Grafite', value: '#343A40' },
];

interface PhoneCountryCode {
  name: string;
  value: string;
  countryShort: string;
  emoji: string;
}

export const PHONE_COUNTRY_CODES: PhoneCountryCode[] = [
  { name: 'Brasil (+55)', value: '+55', countryShort: 'BR', emoji: '🇧🇷' },
  { name: 'EUA (+1)', value: '+1', countryShort: 'US', emoji: '🇺🇸' },
  { name: 'Portugal (+351)', value: '+351', countryShort: 'PT', emoji: '🇵🇹' },
  { name: 'Reino Unido (+44)', value: '+44', countryShort: 'GB', emoji: '🇬🇧' },
];

const cleanPhoneNumberForWhatsApp = (phoneNumber: string): string => {
  return phoneNumber.replace(/\D/g, '');
};

export const generateWhatsAppLink = (rawPhoneNumber: string, message: string): string => {
  const cleanedPhone = cleanPhoneNumberForWhatsApp(rawPhoneNumber);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
};
// Utility function for combining class names, useful for conditional styling.
// You can create a `src/utils/cn.ts` file for this.
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};
