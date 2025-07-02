import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaymentStatus, Sale } from '@/types';
import { dashboardService, DashboardData, AchievementId } from '@/services/dashboardService';
import {
  ShoppingCartIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ArrowTrendingUpIcon,
  TrophyIcon,
  StarIcon,
  FireIcon,
  PencilIcon,
  SparklesIcon,
  TagIcon,
  RocketLaunchIcon,
  CubeIcon,
  BoltIcon,
  CalendarIcon,
} from '../constants.tsx';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/contexts/ToastContext';
import { motion, Variants, AnimatePresence } from "framer-motion";
import { Select as RadixSelect } from '@/components/ui/Select';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DayPicker, DateRange } from 'react-day-picker';
import { format as formatDate } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import confetti from 'canvas-confetti';


import { cn } from '../constants.tsx';

const formatCurrency = (valueInCents: number, showSymbol = true): string => {
  const valueInReais = valueInCents / 100;
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valueInReais);

  return showSymbol ? `R$ ${formattedValue}` : formattedValue;
};



const getStartOfDate = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const getEndOfDate = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

const formatPaymentStatus = (status: PaymentStatus): string => {
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
      return (status as string).replace(/_/g, ' ').toUpperCase();
  }
};

const getStatusClass = (status: PaymentStatus) => {
  switch (status) {
    case PaymentStatus.PAID:
      return 'bg-status-success/20 text-status-success';
    case PaymentStatus.WAITING_PAYMENT:
      return 'bg-status-warning/20 text-status-warning';
    case PaymentStatus.CANCELLED:
    case PaymentStatus.EXPIRED:
    case PaymentStatus.FAILED:
      return 'bg-status-error/20 text-status-error';
    default:
      return 'bg-neutral-700 text-text-muted';
  }
};

const cardContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'circOut' }
  },
};

const MotionDiv = motion.div;
const MotionCard = motion(Card);

const GlassCard: React.FC<{children: React.ReactNode, className?: string, variants?: Variants}> = ({ children, className, variants }) => (
  <MotionCard variants={variants} className={cn("bg-bg-surface-opaque border border-border-subtle shadow-xl rounded-2xl backdrop-filter backdrop-blur-lg", className)}>
    {children}
  </MotionCard>
);

const PersonalBestCard: React.FC<{ icon: React.ElementType, title: string, value: string, subtitle: string, color: string }> = ({ icon: Icon, title, value, subtitle, color }) => (
  <div className="p-4 flex-1">
    <div className="flex items-center">
      <div className="p-3 rounded-full mr-4 border border-opacity-30" style={{ backgroundColor: color, borderColor: color }}>
        <Icon className="h-6 w-6" style={{ color: color }} />
      </div>
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider">{title}</p>
        <p className="text-xl font-bold font-display text-text-strong">{value}</p>
        <p className="text-xs text-text-muted">{subtitle}</p>
      </div>
    </div>
  </div>
);

const achievementsList: { id: AchievementId; icon: React.ElementType; title: string; description: string; color: string }[] = [
    { id: 'first_sale', icon: SparklesIcon, title: '✨ Primeira Venda', description: 'Realize sua primeira venda', color: '#22c55e' },
    { id: 'revenue_1k', icon: ArrowTrendingUpIcon, title: '📈 Empreendedor', description: 'Atinja R$ 1.000 em vendas', color: '#3b82f6' },
    { id: 'first_order_bump', icon: ShoppingCartIcon, title: '🛒 Mão na Roda', description: 'Venda seu primeiro Order Bump', color: '#8b5cf6' },
    { id: 'first_upsell', icon: RocketLaunchIcon, title: '🚀 Rei do Upsell', description: 'Venda seu primeiro Upsell', color: '#ec4899' },
    { id: 'first_coupon', icon: TagIcon, title: '🏷️ Estrategista', description: 'Faça uma venda com cupom', color: '#f97316' },
    { id: 'five_sales_one_day', icon: BoltIcon, title: '⚡️ Dia de Fúria', description: 'Faça 5 vendas em um único dia', color: '#f59e0b' },
    { id: 'ten_products', icon: CubeIcon, title: '📦 Estoque Pronto', description: 'Cadastre 10 produtos na plataforma', color: '#10b981' },
    { id: 'perfect_week', icon: CalendarIcon, title: '🗓️ Semana Perfeita', description: 'Venda todos os dias por 7 dias seguidos', color: '#6366f1' },
    { id: 'revenue_10k', icon: FireIcon, title: '🔥 Negócio de Sucesso', description: 'Atinja R$ 10.000 em vendas', color: '#ef4444' },
    { id: 'revenue_100k', icon: TrophyIcon, title: '🏆 Magnata', description: 'Atinja R$ 100.000 em vendas', color: '#f59e0b' },
];

const AchievementCard: React.FC<{ achievement: typeof achievementsList[0], isUnlocked: boolean }> = ({ achievement, isUnlocked }) => (
    <GlassCard className={cn("p-4 flex items-center gap-4 transition-all duration-300", isUnlocked ? 'opacity-100' : 'opacity-50 grayscale')}>
        <div className="p-3 rounded-full" style={{ backgroundColor: isUnlocked ? achievement.color : 'var(--color-neutral-200)', border: `1px solid ${isUnlocked ? achievement.color : 'var(--color-neutral-300)'}`}}>
            <achievement.icon className="h-7 w-7 text-white"/>
        </div>
        <div>
            <h4 className="font-bold text-text-strong">{achievement.title}</h4>
            <p className="text-sm text-text-muted">{achievement.description}</p>
        </div>
    </GlassCard>
);

const DashboardPage: React.FC = () => {
  const { sales: allSales, products: allProducts, customers: allCustomers, isLoading, error } = useData();
  const { showToast: addToast } = useToast();
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [rechartsSalesData, setRechartsSalesData] = useState<Array<{name: string; Vendas: number}>>([]);
  const [recentActivity, setRecentActivity] = useState<Sale[]>([]);
  const [dateRangeFilter, setDateRangeFilter] = useState('today');
  const [productFilter, ] = useState('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [isCustomRangePopoverOpen, setIsCustomRangePopoverOpen] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState(1000000);
  const [dailyRecordBreaks, setDailyRecordBreaks] = useState(0);
  const [showNewRecord, setShowNewRecord] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const prevAchievementsRef = useRef<AchievementId[]>([]);

  const dateRangeOptions = [
    { label: 'Hoje', value: 'today' },
    { label: 'Ontem', value: 'yesterday' },
    { label: 'Últimos 7 dias', value: 'last7days' },
    { label: 'Últimos 30 dias', value: 'last30days' },
    { label: 'Este Mês', value: 'thisMonth' },
    { label: 'Mês Anterior', value: 'lastMonth' },
    { label: 'Todo o período', value: 'all' },
    { label: 'Período Personalizado', value: 'custom' },
  ];

  useEffect(() => {
    const savedGoal = localStorage.getItem('monthlyGoal');
    if (savedGoal) setMonthlyGoal(Number(savedGoal));
    
    const savedRecordBreaks = localStorage.getItem('dailyRecordBreaks');
    if (savedRecordBreaks) setDailyRecordBreaks(Number(savedRecordBreaks));
  }, []);

  const memoizedDashboardData = useMemo(() => {
    if (isLoading) return null;
    try {
      return dashboardService.getDashboardData({
        sales: allSales,
        customers: allCustomers,
        products: allProducts,
        dateRange: dateRangeFilter,
        productId: productFilter,
        customRange: dateRangeFilter === 'custom' ? customDateRange : undefined,
        dailyRecordBreaks,
      });
    } catch (processingError: any) {
      console.error("Error processing dashboard data:", processingError);
      return null;
    }
  }, [allSales, allProducts, allCustomers, dateRangeFilter, productFilter, customDateRange, isLoading, dailyRecordBreaks]);

  useEffect(() => {
    if (memoizedDashboardData) {
      const previousAchievements = prevAchievementsRef.current;
      const currentAchievements = memoizedDashboardData.unlockedAchievements;

      setDashboardData(memoizedDashboardData);
      const transformedSalesTrend = memoizedDashboardData.salesTrend.map(item => ({
        name: item.periodLabel,
        Vendas: item.amount / 100,
      }));
      setRechartsSalesData(transformedSalesTrend);

      const sortedSalesForActivity = [...allSales]
        .filter(s => s.status === PaymentStatus.PAID || s.status === PaymentStatus.WAITING_PAYMENT)
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setRecentActivity(sortedSalesForActivity.slice(0, 5));

      if (memoizedDashboardData.todayRevenue > (memoizedDashboardData.personalBests.bestDay.amount || 0)) {
        if (!showNewRecord) {
          setShowNewRecord(true);
          const newBreakCount = dailyRecordBreaks + 1;
          setDailyRecordBreaks(newBreakCount);
          localStorage.setItem('dailyRecordBreaks', String(newBreakCount));
          
          confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
          
          setTimeout(() => setShowNewRecord(false), 5000);
        }
      }

      if (currentAchievements.length > previousAchievements.length) {
        const newAchievementId = currentAchievements.find(ach => !previousAchievements.includes(ach));
        if (newAchievementId && !localStorage.getItem(`achievement-${newAchievementId}-notified`)) {
          const achievementData = achievementsList.find(a => a.id === newAchievementId);
          if (achievementData) {
            addToast({
              title: 'Conquista Desbloqueada!',
              description: `Você desbloqueou: ${achievementData.title}`,
              variant: 'success',
              duration: 5000,
            });
            localStorage.setItem(`achievement-${newAchievementId}-notified`, 'true');
          }
        }
      }
      prevAchievementsRef.current = currentAchievements;
    }
  }, [memoizedDashboardData, showNewRecord, addToast, dailyRecordBreaks]);

  const handleDateRangeFilterChange = (value: string) => setDateRangeFilter(value);
  const handleCustomDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setCustomDateRange(range);
      setIsCustomRangePopoverOpen(false);
    } else {
      setCustomDateRange(range);
    }
  };

  const getCustomDateRangeDisplay = () => {
    if (customDateRange?.from && customDateRange?.to) return `${formatDate(customDateRange.from, 'dd/MM/yy', { locale: ptBR })} - ${formatDate(customDateRange.to, 'dd/MM/yy', { locale: ptBR })}`;
    if (customDateRange?.from) return `${formatDate(customDateRange.from, 'dd/MM/yy', { locale: ptBR })} - Selecione Fim`;
    return "Selecionar Período";
  };

  const { currentMonthRevenue } = useMemo(() => {
    const now = new Date();
    const startOfMonth = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const endOfMonth = getEndOfDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const revenue = allSales.filter(s => s.status === PaymentStatus.PAID && s.paidAt && new Date(s.paidAt) >= startOfMonth && new Date(s.paidAt) <= endOfMonth).reduce((sum, sale) => sum + sale.totalAmountInCents, 0);
    return { currentMonthRevenue: revenue };
  }, [allSales]);

  const goalProgress = Math.min((currentMonthRevenue / monthlyGoal) * 100, 100);
  const dailyRecordProgress = Math.min(((dashboardData?.todayRevenue || 0) / (dashboardData?.personalBests.bestDay.amount || 1)) * 100, 100);

  const handleGoalSave = () => {
    const newGoalInCents = Number(newGoal) * 100;
    if (!isNaN(newGoalInCents) && newGoalInCents > 0) {
      setMonthlyGoal(newGoalInCents);
      localStorage.setItem('monthlyGoal', String(newGoalInCents));
      setIsGoalModalOpen(false);
      setNewGoal('');
    }
  };

  if (isLoading) return <div className="flex flex-col justify-center items-center h-screen"><LoadingSpinner size="lg" /><p className="mt-4 text-xl text-auth-text-secondary">Carregando seu painel...</p></div>;
  if (error) return <div className="text-center text-status-error p-6 bg-status-error/10 rounded-2xl shadow-lg border border-status-error/30">{error}</div>;

  return (
    <>
      <div className="space-y-8">
        
        <section>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <h1 className="text-3xl font-display font-bold text-text-strong">Dashboard</h1>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <RadixSelect value={dateRangeFilter} onValueChange={handleDateRangeFilterChange} options={dateRangeOptions} placeholder="Filtrar por período" className="min-w-[180px]" aria-label="Filtrar por período" />
              {dateRangeFilter === 'custom' && (
                <PopoverPrimitive.Root open={isCustomRangePopoverOpen} onOpenChange={setIsCustomRangePopoverOpen}>
                  <PopoverPrimitive.Trigger asChild><Button variant="outline" className="min-w-[200px] justify-start text-left font-normal"><CalendarDaysIcon className="mr-2 h-4 w-4" />{getCustomDateRangeDisplay()}</Button></PopoverPrimitive.Trigger>
                  <PopoverPrimitive.Portal><PopoverPrimitive.Content align="start" sideOffset={5} className="rdp-popover-content"><DayPicker mode="range" selected={customDateRange} onSelect={handleCustomDateRangeSelect} locale={ptBR} numberOfMonths={2} showOutsideDays fixedWeeks defaultMonth={customDateRange?.from || new Date()} disabled={{ after: new Date() }} /></PopoverPrimitive.Content></PopoverPrimitive.Portal>
                </PopoverPrimitive.Root>
              )}
            </div>
          </div>
          <MotionDiv className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8" variants={cardContainerVariants} initial="hidden" animate="show">
              {[ { title: 'Receita Total', value: formatCurrency(dashboardData?.totalRevenue || 0), icon: CurrencyDollarIcon }, { title: 'Vendas Realizadas', value: dashboardData?.numberOfSales || 0, icon: ShoppingCartIcon }, { title: 'Ticket Médio', value: formatCurrency(dashboardData?.averageTicket || 0), icon: CurrencyDollarIcon }, { title: 'Novos Clientes', value: dashboardData?.newCustomers || 0, icon: UserGroupIcon }, ].map(stat => (
                <GlassCard key={stat.title} className="p-5 h-full flex flex-col justify-between" variants={cardItemVariants}>
                  <div className="flex items-center">
                    <div className="p-3 bg-accent-blue-neon/10 rounded-full mr-4 border border-accent-blue-neon/30"><stat.icon className="h-6 w-6 text-accent-blue-neon" /></div>
                    <div><p className="text-xs text-text-muted uppercase tracking-wider">{stat.title}</p><p className="text-2xl font-bold font-display text-text-strong">{stat.value}</p></div>
                  </div>
                </GlassCard>
              ))}
            </MotionDiv>
            <GlassCard className="p-4 sm:p-6" variants={cardItemVariants}>
              <h2 className="text-lg font-semibold text-text-strong mb-2">Tendência de Vendas</h2>
              <p className="text-xs text-text-muted mb-4">{dateRangeOptions.find(o => o.value === dateRangeFilter)?.label}</p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rechartsSalesData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--color-text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 11 }} tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} axisLine={false} tickLine={false} width={70} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-surface-opaque)', borderColor: 'var(--color-border-interactive)', borderRadius: '0.75rem', color: 'var(--color-text-default)' }} cursor={{ stroke: 'var(--color-accent-blue-neon)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend wrapperStyle={{ color: 'var(--color-text-muted)', paddingTop: '10px', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="Vendas" stroke="var(--color-accent-blue-neon)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--color-accent-blue-neon)', stroke: 'var(--color-bg-main)', strokeWidth: 2 }} activeDot={{ r: 7, fill: 'var(--color-accent-blue-neon)', stroke: 'var(--color-bg-main)', strokeWidth: 2, filter: 'drop-shadow(0 0 8px var(--color-accent-blue-neon))' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
        </section>

        

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <Card title="Atividade Recente (Últimas 5 vendas pagas ou aguardando)" className="shadow-xl">
            {recentActivity.length > 0 ? (
              <ul className="divide-y divide-border-subtle">
                {recentActivity.map(sale => (
                  <li key={sale.id} className="py-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-text-strong">
                          {sale.customer.name} <span className="text-text-muted">({sale.customer.email})</span>
                        </p>
                        <p className="text-xs text-text-muted">
                          {sale.products.map(p => p.name).join(', ')} - {new Date(sale.createdAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-accent-blue-neon">
                          {formatCurrency(sale.totalAmountInCents)}
                        </p>
                        <span className={`mt-1 px-2 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-full ${getStatusClass(sale.status)}`}>
                          {formatPaymentStatus(sale.status)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted py-4">Nenhuma atividade recente para exibir.</p>
            )}
          </Card>

          <Card title="Produtos Mais Vendidos" className="shadow-xl">
            {dashboardData?.topSellingProducts && dashboardData.topSellingProducts.length > 0 ? (
              <ul className="divide-y divide-border-subtle">
                {dashboardData.topSellingProducts.map(product => (
                  <li key={product.id} className="py-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <ArrowTrendingUpIcon className="h-6 w-6 text-status-success" />
                        <div>
                          <p className="text-sm font-medium text-text-strong">{product.name}</p>
                          <p className="text-xs text-text-muted">{product.quantitySold} vendido(s)</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-status-success">
                        {formatCurrency(product.revenueGenerated)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted py-4">Nenhum produto vendido no período.</p>
            )}
          </Card>
        </div>

        





















        <hr className="border-t border-border-subtle my-12" />

        <section>
          <h1 className="text-3xl font-display font-bold text-text-strong mb-6 flex items-center gap-2">
            🎯 Metas
          </h1>
          <MotionDiv className="grid grid-cols-1 lg:grid-cols-3 gap-8" variants={cardContainerVariants} initial="hidden" animate="show">
            <GlassCard className="lg:col-span-2 p-6 relative overflow-hidden" variants={cardItemVariants}>
              <div className="relative z-10">
                <div className="flex justify-between items-start">
                  <div><p className="text-lg font-semibold text-text-muted">Sua Meta do Mês</p><h2 className="text-4xl font-bold font-display text-text-strong tracking-tight">{formatCurrency(monthlyGoal)}</h2></div>
                  <Button variant="ghost" size="sm" className="p-1.5 text-text-muted hover:text-accent-blue-neon" onClick={() => setIsGoalModalOpen(true)}><PencilIcon className="h-4 w-4" /></Button>
                </div>
                <div className="mt-6">
                  <div className="flex justify-between items-end mb-1"><p className="text-lg font-bold text-text-strong">{formatCurrency(currentMonthRevenue)}</p><p className="text-sm text-text-muted">{goalProgress.toFixed(1)}%</p></div>
                  <div className="w-full bg-neutral-200 rounded-full h-3 overflow-hidden"><motion.div className="bg-gradient-to-r from-status-success to-status-success h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${goalProgress}%` }} transition={{ duration: 1, ease: 'easeOut' }} /></div>
                  <p className="text-xs text-right text-text-muted mt-1">Faltam {formatCurrency(Math.max(0, monthlyGoal - currentMonthRevenue))} para atingir sua meta!</p>
                </div>
              </div>
              <FireIcon className="absolute -right-12 -bottom-12 text-status-error w-48 h-48 transform-gpu" />
            </GlassCard>
            <div className="space-y-4 flex flex-col">
              <GlassCard className="flex-1" variants={cardItemVariants}><PersonalBestCard icon={StarIcon} title="🌟 Melhor Dia" value={formatCurrency(dashboardData?.personalBests.bestDay.amount || 0)} subtitle={dashboardData?.personalBests.bestDay.date || 'N/A'} color="#FFD700" /></GlassCard>
              <GlassCard className="flex-1" variants={cardItemVariants}><PersonalBestCard icon={TrophyIcon} title="🏆 Melhor Mês" value={formatCurrency(dashboardData?.personalBests.bestMonth.amount || 0)} subtitle={dashboardData?.personalBests.bestMonth.date || 'N/A'} color="#C0C0C0" /></GlassCard>
              <GlassCard className="flex-1" variants={cardItemVariants}><PersonalBestCard icon={CurrencyDollarIcon} title="💰 Maior Venda" value={formatCurrency(dashboardData?.personalBests.biggestSale.amount || 0)} subtitle={`#${dashboardData?.personalBests.biggestSale.id.substring(0, 6)}...`} color="#22C55E" /></GlassCard>
            </div>
          </MotionDiv>
          <GlassCard className="mt-8 p-6" variants={cardItemVariants}>
            <div className="flex justify-between items-center mb-1">
                <h3 className="text-lg font-semibold text-text-strong">Rumo ao Recorde Diário</h3>
                {dailyRecordBreaks > 0 && <p className="text-sm font-bold text-accent-gold">{`🎉 Recorde batido ${dailyRecordBreaks}x!`}</p>}
            </div>
            <p className="text-xs text-text-muted mb-4">Sua meta é bater seu recorde de {formatCurrency(dashboardData?.personalBests.bestDay.amount || 0)} em um único dia.</p>
            <div className="w-full bg-neutral-200 rounded-full h-4 overflow-hidden relative">
              <motion.div className="bg-gradient-to-r from-status-success to-status-success h-full rounded-full flex items-center justify-center" initial={{ width: 0 }} animate={{ width: `${dailyRecordProgress}%` }} transition={{ duration: 1, ease: 'easeOut' }}><span className="text-xs font-bold text-black">{formatCurrency(dashboardData?.todayRevenue || 0)}</span></motion.div>
              <AnimatePresence>{showNewRecord && (<motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-accent-gold to-accent-gold"><p className="font-bold text-lg text-white animate-pulse">NOVO RECORDE DIÁRIO!</p></motion.div>)}</AnimatePresence>
            </div>
          </GlassCard>
        </section>

        <hr className="border-t border-border-subtle my-12" />

        <section>
          <h1 className="text-3xl font-display font-bold text-text-strong mb-6">🏆 Suas Conquistas</h1>
          <MotionDiv className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={cardContainerVariants} initial="hidden" animate="show">
              {achievementsList.map(ach => (
                  <AchievementCard key={ach.id} achievement={ach} isUnlocked={dashboardData?.unlockedAchievements.includes(ach.id) ?? false} />
              ))}
          </MotionDiv>
        </section>
      </div>

      <Modal isOpen={isGoalModalOpen} onClose={() => setIsGoalModalOpen(false)} title="Definir Nova Meta Mensal">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Digite o valor total que você deseja alcançar este mês.</p>
          <div>
            <label htmlFor="goal" className="sr-only">Nova meta</label>
            <Input id="goal" type="number" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Ex: 25000" className="bg-bg-surface-opaque border-border-subtle" />
          </div>
          <Button onClick={handleGoalSave} className="w-full" variant="primary">Salvar Meta</Button>
        </div>
      </Modal>
    </>
  );
};

export default DashboardPage;