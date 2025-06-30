
import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Sale, PaymentStatus } from '@/types';
import { dashboardService, DashboardData } from '@/services/dashboardService';
import {
  ShoppingCartIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ArrowTrendingUpIcon,
} from '../constants.tsx';
import { useData } from '@/contexts/DataContext';
import { motion, Variants } from "framer-motion";
import { Select as RadixSelect } from '@/components/ui/Select';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DayPicker, DateRange } from 'react-day-picker';
import { format as formatDate } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Button } from '@/components/ui/Button';
import { cn } from '../constants.tsx';


const formatCurrency = (valueInCents: number, showSymbol = true): string => {
  const value = (valueInCents / 100).toFixed(2).replace('.', ',');
  return showSymbol ? `R$ ${value}` : value;
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

const DashboardPage: React.FC = () => {
  const { sales: allSales, products: allProducts, customers: allCustomers, isLoading, error } = useData();
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [rechartsSalesData, setRechartsSalesData] = useState<Array<{name: string; Vendas: number}>>([]);
  const [recentActivity, setRecentActivity] = useState<Sale[]>([]);
  const [dateRangeFilter, setDateRangeFilter] = useState('today');
  const [productFilter, setProductFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [isCustomRangePopoverOpen, setIsCustomRangePopoverOpen] = useState(false);
  
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

  const productOptions = useMemo(() => [
    { value: 'all', label: 'Todos Produtos' },
    ...allProducts.map(prod => ({ value: prod.id, label: prod.name }))
  ], [allProducts]);

  const memoizedDashboardData = useMemo(() => {
    if (isLoading || allSales.length === 0) {
      return null;
    }

    try {
      const data = dashboardService.getDashboardData({
        sales: allSales,
        customers: allCustomers,
        products: allProducts,
        dateRange: dateRangeFilter,
        productId: productFilter,
        customRange: dateRangeFilter === 'custom' ? customDateRange : undefined,
      });
      return data;
    } catch (processingError: any) {
      console.error("Error processing dashboard data:", processingError);
      return null;
    }
  }, [allSales, allProducts, allCustomers, dateRangeFilter, productFilter, customDateRange, isLoading]);

  React.useEffect(() => {
    if (memoizedDashboardData) {
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
    } else if (!isLoading) {
      // Clear data if no dashboard data is generated (e.g., due to filters)
      setDashboardData({ totalRevenue: 0, numberOfSales: 0, averageTicket: 0, newCustomers: 0, salesTrend: [], topSellingProducts: [] });
      setRechartsSalesData([]);
      setRecentActivity([]);
    }
  }, [memoizedDashboardData, allSales, isLoading]);

  const handleDateRangeFilterChange = (value: string) => {
    setDateRangeFilter(value);
    if (value !== 'custom') {
      setCustomDateRange(undefined);
    } else {
      setIsCustomRangePopoverOpen(true);
    }
  };

  const handleCustomDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setCustomDateRange(range);
      setIsCustomRangePopoverOpen(false);
    } else if (range?.from && !range.to) {
      setCustomDateRange({ from: range.from, to: undefined });
    } else {
      setCustomDateRange(undefined);
    }
  };

  const getCustomDateRangeDisplay = () => {
    if (customDateRange?.from && customDateRange?.to) {
      return `${formatDate(customDateRange.from, 'dd/MM/yy', { locale: ptBR })} - ${formatDate(customDateRange.to, 'dd/MM/yy', { locale: ptBR })}`;
    }
    if (customDateRange?.from) {
      return `${formatDate(customDateRange.from, 'dd/MM/yy', { locale: ptBR })} - Selecione Fim`;
    }
    return "Selecionar Período";
  };

  const getMainChartTitle = () => {
    if (dateRangeFilter === 'custom' && customDateRange?.from && customDateRange?.to) {
      return `Tendência de Vendas (${getCustomDateRangeDisplay()})`;
    }
    const selectedOption = dateRangeOptions.find(opt => opt.value === dateRangeFilter);
    return `Tendência de Vendas (${selectedOption ? selectedOption.label.toLowerCase() : dateRangeFilter})`;
  };

  const getMainChartSubTitle = () => {
    if (!dashboardData || !dashboardData.salesTrend || dashboardData.salesTrend.length === 0) 
      return "Nenhum dado para o período selecionado.";

    if (dateRangeFilter === 'today') 
      return `Hoje, ${dashboardData.salesTrend[0].periodLabel} - ${dashboardData.salesTrend[dashboardData.salesTrend.length - 1].periodLabel}`;

    const firstPeriod = dashboardData.salesTrend[0].periodLabel;
    const lastPeriod = dashboardData.salesTrend[dashboardData.salesTrend.length - 1].periodLabel;

    if (dateRangeFilter === "thisMonth" || dateRangeFilter === "lastMonth") {
      const monthName = new Date(2000, parseInt(firstPeriod.split('/')[1]) -1, 1).toLocaleString('pt-BR', { month: 'long' });
      return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;
    }

    if (dateRangeFilter === "all") return "Todo o período";

    if (dateRangeFilter === 'custom' && customDateRange?.from && customDateRange?.to) {
      return `De ${formatDate(customDateRange.from, 'dd/MM/yyyy', { locale: ptBR })} até ${formatDate(customDateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`;
    }

    return `${firstPeriod} - ${lastPeriod}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)] text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-xl text-text-muted">Carregando dados do dashboard...</p>
        <p className="text-sm text-text-muted/70">Isso pode levar alguns segundos.</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-status-error p-6 bg-status-error/10 rounded-2xl shadow-lg border border-status-error/30">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-display font-bold text-text-strong">Dashboard</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <RadixSelect
            value={dateRangeFilter}
            onValueChange={handleDateRangeFilterChange}
            options={dateRangeOptions}
            placeholder="Filtrar por período"
            className="min-w-[180px]"
            aria-label="Filtrar por período"
          />
          {dateRangeFilter === 'custom' && (
            <PopoverPrimitive.Root open={isCustomRangePopoverOpen} onOpenChange={setIsCustomRangePopoverOpen}>
              <PopoverPrimitive.Trigger asChild>
                <Button
                  variant="outline"
                  className="min-w-[200px] justify-start text-left font-normal"
                >
                  <CalendarDaysIcon className="mr-2 h-4 w-4" />
                  {getCustomDateRangeDisplay()}
                </Button>
              </PopoverPrimitive.Trigger>
              <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                  align="start"
                  sideOffset={5}
                  className={cn(
                    "relative z-50 min-w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-2xl border border-border-subtle",
                    "bg-bg-surface bg-opacity-90 backdrop-blur-lg shadow-2xl p-0",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                  )}
                >
                  <DayPicker
                    mode="range"
                    selected={customDateRange}
                    onSelect={handleCustomDateRangeSelect}
                    locale={ptBR}
                    numberOfMonths={2}
                    showOutsideDays
                    fixedWeeks
                    defaultMonth={customDateRange?.from || new Date()}
                    disabled={{ after: new Date() }}
                    className="p-3"
                    classNames={{
                      months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
                      month: 'space-y-4',
                      caption: 'flex justify-center pt-1 relative items-center',
                      caption_label: 'text-sm font-medium text-text-strong',
                      nav: 'space-x-1 flex items-center',
                      nav_button: cn(
                        'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-text-muted hover:text-text-strong rounded-md',
                        'focus:outline-none focus:ring-1 focus:ring-accent-blue-neon'
                      ),
                      nav_button_previous: 'absolute left-1',
                      nav_button_next: 'absolute right-1',
                      table: 'w-full border-collapse space-y-1',
                      head_row: 'flex',
                      head_cell: 'text-text-muted rounded-md w-9 font-normal text-[0.8rem]',
                      row: 'flex w-full mt-2',
                      cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent-blue-neon/20 [&:has([aria-selected])]:bg-accent-blue-neon/30 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 text-text-default',
                      day: cn(
                        'h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md',
                        'hover:bg-accent-blue-neon/20 focus:outline-none focus:ring-1 focus:ring-accent-blue-neon'
                      ),
                      day_range_end: 'day-range-end',
                      day_selected: 'bg-accent-blue-neon text-primary-cta-text hover:bg-accent-blue-neon hover:text-primary-cta-text focus:bg-accent-blue-neon focus:text-primary-cta-text',
                      day_today: 'bg-accent-gold/20 text-accent-gold',
                      day_outside: 'day-outside text-text-muted opacity-50 aria-selected:bg-accent-blue-neon/20 aria-selected:text-text-muted aria-selected:opacity-30',
                      day_disabled: 'text-text-muted opacity-50',
                      day_range_middle: 'aria-selected:bg-accent-blue-neon/30 aria-selected:text-text-default',
                      day_hidden: 'invisible',
                    }}
                  />
                </PopoverPrimitive.Content>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
          )}
          <RadixSelect
            value={productFilter}
            onValueChange={setProductFilter}
            options={productOptions}
            placeholder="Filtrar por produto"
            className="min-w-[180px]"
            aria-label="Filtrar por produto"
          />
        </div>
      </div>

      <MotionDiv
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        variants={cardContainerVariants}
        initial="hidden"
        animate="show"
      >
        {[
          {
            title: 'Receita Total (Pago)',
            value: formatCurrency(dashboardData?.totalRevenue || 0),
            icon: CurrencyDollarIcon
          },
          {
            title: 'Vendas Realizadas (Pago)',
            value: dashboardData?.numberOfSales || 0,
            icon: ShoppingCartIcon
          },
          {
            title: 'Ticket Médio (Pago)',
            value: formatCurrency(dashboardData?.averageTicket || 0),
            icon: CurrencyDollarIcon
          },
          {
            title: 'Novos Clientes',
            value: dashboardData?.newCustomers || 0,
            icon: UserGroupIcon
          },
        ].map(stat => (
          <MotionDiv key={stat.title} variants={cardItemVariants}>
            <Card className="overflow-hidden">
              <div className="flex items-center p-5">
                <div className="p-3 bg-accent-blue-neon/10 rounded-full mr-4 border border-accent-blue-neon/30">
                  <stat.icon className="h-6 w-6 text-accent-blue-neon" />
                </div>
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider">{stat.title}</p>
                  <p className="text-2xl font-bold font-display text-text-strong">{stat.value}</p>
                </div>
              </div>
            </Card>
          </MotionDiv>
        ))}
      </MotionDiv>

      <Card title={getMainChartTitle()} className="shadow-xl">
        <p className="text-xs text-text-muted mb-4">{getMainChartSubTitle()}</p>
        {rechartsSalesData && rechartsSalesData.length > 0 ? (
          <div className="h-80 bg-bg-surface p-4 rounded-lg border border-border-subtle backdrop-blur-sm">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rechartsSalesData}
                margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="var(--color-border-subtle)" 
                  vertical={false} 
                />
                <XAxis
                  dataKey="name"
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 11 }}
                  axisLine={{ stroke: 'var(--color-border-subtle)' }}
                  tickLine={{ stroke: 'var(--color-border-subtle)' }}
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => `R$${value.toLocaleString('pt-BR')}`}
                  axisLine={{ stroke: 'var(--color-border-subtle)' }}
                  tickLine={{ stroke: 'var(--color-border-subtle)' }}
                  domain={['auto', 'auto']}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-bg-surface-opaque)',
                    borderColor: 'var(--color-border-interactive)',
                    borderRadius: '0.75rem',
                    color: 'var(--color-text-default)',
                    boxShadow: 'var(--shadow-hard)'
                  }}
                  itemStyle={{ color: 'var(--color-text-default)' }}
                  labelStyle={{
                    color: 'var(--color-accent-gold)',
                    fontWeight: 'bold',
                    marginBottom: '4px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    paddingBottom: '4px'
                  }}
                  formatter={(value: number) => [
                    `R$ ${value.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}`,
                    "Vendas"
                  ]}
                  cursor={{
                    stroke: 'var(--color-accent-blue-neon)',
                    strokeWidth: 1,
                    strokeDasharray: '3 3'
                  }}
                />
                <Legend
                  wrapperStyle={{
                    color: 'var(--color-text-muted)',
                    paddingTop: '10px',
                    fontSize: '12px'
                  }}
                  formatter={(value) => <span style={{ color: 'var(--color-text-default)' }}>{value}</span>}
                />
                <Line
                  type="monotone"
                  dataKey="Vendas"
                  stroke="var(--color-accent-blue-neon)"
                  strokeWidth={2.5}
                  dot={{
                    r: 4,
                    fill: 'var(--color-accent-blue-neon)',
                    stroke: 'var(--color-bg-main)',
                    strokeWidth: 2
                  }}
                  activeDot={{
                    r: 7,
                    fill: 'var(--color-accent-blue-neon)',
                    stroke: 'var(--color-bg-main)',
                    strokeWidth: 2,
                    filter: 'drop-shadow(0 0 5px var(--color-accent-blue-neon))'
                  }}
                  name="Vendas"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-text-muted bg-bg-surface p-4 rounded-lg border border-border-subtle backdrop-blur-sm">
            Nenhuma venda registrada no período para exibir o gráfico.
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                      <span className="text-sm font-semibold text-accent-blue-neon">
                        {formatCurrency(sale.totalAmountInCents)}
                      </span>
                      <span className={`ml-2 px-2 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-full ${getStatusClass(sale.status)}`}>
                        {(sale.status as string).replace(/_/g, ' ').toUpperCase()}
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
    </div>
  );
};

export default DashboardPage;
