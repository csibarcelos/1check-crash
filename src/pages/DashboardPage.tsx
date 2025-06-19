
import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Sale, Product, Customer, PaymentStatus } from '@/types';
import { salesService } from '@/services/salesService';
import { productService } from '@/services/productService';
import { customerService } from '@/services/customerService';
import { dashboardService, DashboardData } from '@/services/dashboardService';
import { 
    ShoppingCartIcon, 
    UserGroupIcon, 
    CurrencyDollarIcon,
} from '@/constants'; 
import { useAuth } from '@/contexts/AuthContext';

const formatCurrency = (valueInCents: number, showSymbol = true): string => {
    const value = (valueInCents / 100).toFixed(2).replace('.', ',');
    return showSymbol ? `R$ ${value}` : value;
};

const getStatusClass = (status: PaymentStatus) => {
  switch (status) {
    case PaymentStatus.PAID: return 'bg-status-success/20 text-status-success';
    case PaymentStatus.WAITING_PAYMENT: return 'bg-status-warning/20 text-status-warning';
    case PaymentStatus.CANCELLED:
    case PaymentStatus.EXPIRED:
    case PaymentStatus.FAILED:
      return 'bg-status-error/20 text-status-error';
    default: return 'bg-neutral-700 text-text-muted';
  }
};

export const DashboardPage: React.FC = () => {
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [recentActivity, setRecentActivity] = useState<Sale[]>([]);

  const [dateRangeFilter, setDateRangeFilter] = useState('today');
  const [productFilter, setProductFilter] = useState('all');
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken, isLoading: authLoading } = useAuth();

  const dateRangeOptions = [
    { label: 'Hoje', value: 'today' },
    { label: 'Ontem', value: 'yesterday' },
    { label: 'Últimos 7 dias', value: 'last7days' },
    { label: 'Últimos 30 dias', value: 'last30days' },
    { label: 'Este Mês', value: 'thisMonth' },
    { label: 'Mês Anterior', value: 'lastMonth' },
    { label: 'Todo o período', value: 'all' },
  ];

  const fetchInitialData = useCallback(async () => {
    if (authLoading) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const [salesRes, productsRes, customersRes] = await Promise.all([
        salesService.getSales(accessToken), 
        productService.getProducts(accessToken), 
        customerService.getCustomers(accessToken) 
      ]);
      setAllSales(salesRes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setAllProducts(productsRes);
      setAllCustomers(customersRes);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados do dashboard.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, accessToken]); 

  useEffect(() => {
    if (!authLoading) { 
        fetchInitialData();
    }
  }, [fetchInitialData, authLoading]);

  useEffect(() => {
    if (!isLoading && allSales.length >= 0) { 
      try {
        const data = dashboardService.getDashboardData({
          sales: allSales, customers: allCustomers, products: allProducts,
          dateRange: dateRangeFilter, productId: productFilter,
        });
        setDashboardData(data);
        
        const sortedSalesForActivity = [...allSales]
          .filter(s => s.status === PaymentStatus.PAID || s.status === PaymentStatus.WAITING_PAYMENT)
          .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRecentActivity(sortedSalesForActivity.slice(0, 5));

      } catch (processingError: any) {
        console.error("Error processing dashboard data:", processingError);
        setError("Erro ao processar dados para o dashboard.");
        setDashboardData(null);
      }
    } else if (!isLoading && allSales.length === 0) {
        setDashboardData({
            totalRevenue: 0, numberOfSales: 0, averageTicket: 0, newCustomers: 0, salesTrend: []
        });
        setRecentActivity([]);
    }
  }, [allSales, allProducts, allCustomers, dateRangeFilter, productFilter, isLoading]);

  const getMainChartTitle = () => {
    const selectedOption = dateRangeOptions.find(opt => opt.value === dateRangeFilter);
    return `Tendência de Vendas (${selectedOption ? selectedOption.label.toLowerCase() : dateRangeFilter})`;
  };
  
  const getMainChartSubTitle = () => {
    if (!dashboardData || !dashboardData.salesTrend || dashboardData.salesTrend.length === 0) return "Nenhum dado para o período selecionado.";
    if (dateRangeFilter === 'today') return `Hoje, ${dashboardData.salesTrend[0].periodLabel} - ${dashboardData.salesTrend[dashboardData.salesTrend.length - 1].periodLabel}`;
    
    const firstPeriod = dashboardData.salesTrend[0].periodLabel;
    const lastPeriod = dashboardData.salesTrend[dashboardData.salesTrend.length - 1].periodLabel;
    
    if (dateRangeFilter === "thisMonth" || dateRangeFilter === "lastMonth") {
        const monthName = new Date(2000, parseInt(firstPeriod.split('/')[1]) -1, 1).toLocaleString('pt-BR', { month: 'long' });
        return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;
    }
    if (dateRangeFilter === "all") return "Todo o período";
    return `${firstPeriod} - ${lastPeriod}`;
  };

  if (authLoading || (isLoading && !dashboardData)) { 
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

  const maxSalesTrendValue = dashboardData?.salesTrend.reduce((max, item) => Math.max(max, Number(item.amount || 0)), 0) || 0;
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-neutral-100">Dashboard</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value)}
            className="p-2 border border-neutral-700 rounded-xl shadow-sm focus:ring-primary focus:border-primary text-sm w-full bg-neutral-800 text-neutral-300"
          >
            {dateRangeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="p-2 border border-neutral-700 rounded-xl shadow-sm focus:ring-primary focus:border-primary text-sm w-full bg-neutral-800 text-neutral-300"
          >
            <option value="all">Todos Produtos</option>
            {allProducts.map(prod => <option key={prod.id} value={prod.id}>{prod.name}</option>)}
          </select>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Receita Total (Pago)', value: formatCurrency(dashboardData?.totalRevenue || 0), icon: CurrencyDollarIcon },
          { title: 'Vendas Realizadas (Pago)', value: dashboardData?.numberOfSales || 0, icon: ShoppingCartIcon },
          { title: 'Ticket Médio (Pago)', value: formatCurrency(dashboardData?.averageTicket || 0), icon: CurrencyDollarIcon },
          { title: 'Novos Clientes', value: dashboardData?.newCustomers || 0, icon: UserGroupIcon },
        ].map(stat => (
          <Card key={stat.title} className="shadow-xl">
            <div className="flex items-center">
              <div className="p-3.5 bg-accent-blue-neon/10 rounded-full mr-4 border border-accent-blue-neon/30">
                <stat.icon className="h-7 w-7 text-accent-blue-neon" />
              </div>
              <div>
                <p className="text-sm text-text-muted">{stat.title}</p>
                <p className="text-2xl font-bold text-text-strong">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Gráfico de Tendência de Vendas */}
      <Card title={getMainChartTitle()} className="shadow-xl">
         <p className="text-xs text-text-muted mb-4">{getMainChartSubTitle()}</p>
        {dashboardData && dashboardData.salesTrend.length > 0 ? (
          <div className="h-72 bg-neutral-700/30 p-4 rounded-lg border border-border-subtle">
            <div className="flex items-end h-full space-x-2">
              {dashboardData.salesTrend.map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center justify-end group">
                  <div
                    className="w-full bg-accent-blue-neon rounded-t-md transition-all duration-300 ease-in-out group-hover:bg-opacity-80"
                    style={{ height: `${maxSalesTrendValue > 0 ? (Number(item.amount || 0) / maxSalesTrendValue) * 100 : 0}%` }}
                    title={`${item.periodLabel}: ${formatCurrency(Number(item.amount || 0))}`}
                  ></div>
                  <span className="mt-1.5 text-[10px] text-text-muted">{item.periodLabel}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-72 flex items-center justify-center text-text-muted bg-neutral-700/30 p-4 rounded-lg border border-border-subtle">
            Nenhuma venda registrada no período para exibir o gráfico.
          </div>
        )}
      </Card>

      {/* Atividade Recente */}
      <Card title="Atividade Recente (Últimas 5 vendas pagas ou aguardando)" className="shadow-xl">
        {recentActivity.length > 0 ? (
          <ul className="divide-y divide-border-subtle">
            {recentActivity.map(sale => (
              <li key={sale.id} className="py-3.5">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-text-strong">
                      {sale.customer.name} ({sale.customer.email})
                    </p>
                    <p className="text-xs text-text-muted">
                      {sale.products.map(p => p.name).join(', ')} - {new Date(sale.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                     <span className="text-sm font-semibold text-accent-blue-neon">{formatCurrency(sale.totalAmountInCents)}</span>
                     <span className={`ml-2 px-2 py-0.5 inline-flex text-[11px] leading-4 font-semibold rounded-full ${getStatusClass(sale.status)}`}>
                        {(sale.status as string).replace(/_/g, ' ').toUpperCase()}
                     </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted">Nenhuma atividade recente para exibir.</p>
        )}
      </Card>
    </div>
  );
};
