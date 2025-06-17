
import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { User, Sale, PaymentStatus, PlatformSettings } from '@/types';
import { settingsService } from '@/services/settingsService';
import { superAdminService } from '@/services/superAdminService';
import { useAuth } from '@/contexts/AuthContext';
import { UsersIcon, ShoppingCartIcon, CurrencyDollarIcon as CurrencyDollarHeroIcon, PresentationChartLineIcon as ChartBarIcon } from '@heroicons/react/24/outline';

const formatCurrency = (valueInCents: number): string => {
    return `R$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

interface DashboardStat {
    title: string;
    value: string | number;
    icon: React.ElementType;
}

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

const filterDataByDateRange = <T extends { createdAt?: string; paidAt?: string }>(
  data: T[],
  dateRange: string,
  dateField: 'createdAt' | 'paidAt' = 'createdAt'
): T[] => {
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  switch (dateRange) {
    case 'today':
      startDate = getStartOfDate(now);
      endDate = getEndOfDate(now);
      break;
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = getStartOfDate(yesterday);
      endDate = getEndOfDate(yesterday);
      break;
    case 'last7days':
      startDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
      endDate = getEndOfDate(now);
      break;
    case 'last30days':
      startDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
      endDate = getEndOfDate(now);
      break;
    case 'thisMonth':
      startDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), 1));
      endDate = getEndOfDate(now);
      break;
    case 'lastMonth':
      startDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      endDate = getEndOfDate(new Date(now.getFullYear(), now.getMonth(), 0));
      break;
    case 'allTime':
    default:
      return data;
  }

  return data.filter(item => {
    const itemDateStr = dateField === 'paidAt' ? item.paidAt : item.createdAt;
    if (!itemDateStr) return dateField === 'paidAt' ? false : true;
    const itemDate = new Date(itemDateStr);
    if (isNaN(itemDate.getTime())) return false;
    
    let include = true;
    if (startDate) include = include && itemDate >= startDate;
    if (endDate) include = include && itemDate <= endDate;
    return include;
  });
};

export const SuperAdminDashboardPage: React.FC = () => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [newUsersInPeriod, setNewUsersInPeriod] = useState(0);
  const [salesInPeriodCount, setSalesInPeriodCount] = useState(0);
  const [salesValueInPeriod, setSalesValueInPeriod] = useState(0);
  const [platformCommissionsInPeriod, setPlatformCommissionsInPeriod] = useState(0);
  const [averageTicketInPeriod, setAverageTicketInPeriod] = useState(0);
  
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);

  const [dateRangeFilter, setDateRangeFilter] = useState('thisMonth');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuth();

  const dateRangeOptions = [
    { label: 'Hoje', value: 'today' },
    { label: 'Ontem', value: 'yesterday' },
    { label: 'Últimos 7 dias', value: 'last7days' },
    { label: 'Últimos 30 dias', value: 'last30days' },
    { label: 'Este Mês', value: 'thisMonth' },
    { label: 'Mês Anterior', value: 'lastMonth' },
    { label: 'Todo o Período', value: 'allTime' },
  ];

  const fetchData = useCallback(async () => {
    if (!accessToken) {
      setError("Autenticação de super admin necessária.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [usersData, salesData, platSettings] = await Promise.all([
        superAdminService.getAllPlatformUsers(accessToken),
        superAdminService.getAllPlatformSales(accessToken),
        settingsService.getPlatformSettings(accessToken)
      ]);
      
      setAllUsers(usersData);
      setAllSales(salesData);
      setPlatformSettings(platSettings);
      setTotalUsersCount(usersData.length); 

      setRecentSales(salesData.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0,5));
      setRecentUsers(usersData.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0,5));
      
      if(usersData.length === 0 && salesData.length === 0) {
        setError("Nenhum dado de usuário ou venda encontrado na plataforma.");
      }

    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados do dashboard de super admin.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isLoading || !platformSettings) return; 

    const currentFilteredUsers = filterDataByDateRange(allUsers, dateRangeFilter, 'createdAt');
    setNewUsersInPeriod(currentFilteredUsers.length);

    const salesForPeriodMetrics = filterDataByDateRange(allSales, dateRangeFilter, 'paidAt')
                                 .filter(s => s.status === PaymentStatus.PAID);
    
    const allSalesCreatedInPeriod = filterDataByDateRange(allSales, dateRangeFilter, 'createdAt');
    setSalesInPeriodCount(allSalesCreatedInPeriod.length);

    const currentSalesValue = salesForPeriodMetrics.reduce((sum, sale) => sum + sale.totalAmountInCents, 0);
    setSalesValueInPeriod(currentSalesValue);

    let calculatedCommissions = 0;
    salesForPeriodMetrics.forEach(sale => {
      if (sale.platformCommissionInCents !== undefined) {
          calculatedCommissions += sale.platformCommissionInCents;
      } else {
          const commissionForSale = Math.round(sale.totalAmountInCents * platformSettings.platformCommissionPercentage) + platformSettings.platformFixedFeeInCents;
          calculatedCommissions += commissionForSale;
      }
    });
    setPlatformCommissionsInPeriod(calculatedCommissions);

    const paidSalesCountInPeriod = salesForPeriodMetrics.length;
    setAverageTicketInPeriod(paidSalesCountInPeriod > 0 ? currentSalesValue / paidSalesCountInPeriod : 0);

  }, [allUsers, allSales, dateRangeFilter, platformSettings, isLoading]);
  
  const stats: DashboardStat[] = [
    { title: "Total de Usuários", value: totalUsersCount, icon: UsersIcon },
    { title: "Novos Usuários (Período)", value: newUsersInPeriod, icon: UsersIcon },
    { title: "Vendas (Período)", value: salesInPeriodCount, icon: ShoppingCartIcon },
    { title: "Valor Vendido (Período)", value: formatCurrency(salesValueInPeriod), icon: CurrencyDollarHeroIcon },
    { title: "Comissão Plataforma (Período)", value: formatCurrency(platformCommissionsInPeriod), icon: ChartBarIcon },
    { title: "Ticket Médio (Período)", value: formatCurrency(averageTicketInPeriod), icon: CurrencyDollarHeroIcon },
  ];


  if (isLoading && totalUsersCount === 0 && allSales.length === 0) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-neutral-800">Dashboard Super Admin</h1>
        <select 
          value={dateRangeFilter}
          onChange={(e) => setDateRangeFilter(e.target.value)}
          className="p-2 border rounded-md bg-white shadow-sm focus:ring-primary focus:border-primary"
        >
          {dateRangeOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-500 bg-red-50 p-3 rounded-md">{error}</p>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map(stat => (
              <Card key={stat.title} className="p-5 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-medium text-neutral-500 uppercase">{stat.title}</h3>
                    <stat.icon className="h-6 w-6 text-neutral-400" />
                  </div>
                  <p className="text-3xl font-semibold text-neutral-800 mt-2">{stat.value}</p>
              </Card>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Vendas Recentes</h3>
          {recentSales.length > 0 ? (
            <ul className="divide-y divide-neutral-200">
              {recentSales.map(sale => (
                <li key={sale.id} className="py-2 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{sale.customer.name}</p>
                    <p className="text-sm text-neutral-500">{sale.products[0]?.name || 'Produto(s) Indisponível(is)'}</p>
                  </div>
                  <span className="font-semibold">{formatCurrency(sale.totalAmountInCents)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-neutral-500">Nenhuma venda recente.</p>}
        </Card>
        <Card>
          <h3 className="text-lg font-semibold mb-4">Novos Usuários</h3>
          {recentUsers.length > 0 ? (
            <ul className="divide-y divide-neutral-200">
              {recentUsers.map(user => (
                <li key={user.id} className="py-2 flex justify-between items-center">
                  <span>{user.email}</span>
                  <span className="text-sm text-neutral-500">{new Date(user.createdAt || 0).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
           ) : <p className="text-neutral-500">Nenhum usuário recente.</p>}
        </Card>
      </div>
    </div>
  );
};