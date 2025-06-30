
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
    }

    return data.filter(item => {
      const itemDateStr = dateField === 'paidAt' ? item.paidAt : item.createdAt;
      if (!itemDateStr) return dateField === 'paidAt' ? false : true; // if paidAt field is used and it's null, exclude
      const itemDate = new Date(itemDateStr);
      if (isNaN(itemDate.getTime())) return false; // Invalid date string
      
      let include = true;
      if (startDate) include = include && itemDate >= startDate;
      if (endDate) include = include && itemDate <= endDate;
      return include;
    });
};

const SuperAdminDashboardPage: React.FC = () => {
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
        settingsService.getPlatformSettings()
      ]);
      
      setAllUsers(usersData);
      setAllSales(salesData); // Salva todas as vendas para filtragem posterior
      setPlatformSettings(platSettings);
      setTotalUsersCount(usersData.length); // Define o total de usuários

      // Define vendas e usuários recentes sem filtrar por período ainda
      setRecentSales(salesData.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0,5));
      setRecentUsers(usersData.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0,5));
      
      if(usersData.length === 0 && salesData.length === 0) {
        // setError("Nenhum dado de usuário ou venda encontrado na plataforma."); // Comentado para não mostrar erro se não houver dados
      }

    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados do dashboard de super admin.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Calcula métricas baseadas no filtro de data
  useEffect(() => {
    if (isLoading || !platformSettings) return; // Não processa se estiver carregando ou sem configurações da plataforma

    // Filtra usuários para "Novos Usuários (Período)"
    const currentFilteredUsers = filterDataByDateRange(allUsers, dateRangeFilter, 'createdAt');
    setNewUsersInPeriod(currentFilteredUsers.length);

    // Filtra vendas pagas para métricas financeiras
    const salesForPeriodMetrics = filterDataByDateRange(allSales, dateRangeFilter, 'paidAt')
                                 .filter(s => s.status === PaymentStatus.PAID);
    
    // Filtra todas as vendas (independente do status) criadas no período para a contagem de "Vendas (Período)"
    const allSalesCreatedInPeriod = filterDataByDateRange(allSales, dateRangeFilter, 'createdAt');
    setSalesInPeriodCount(allSalesCreatedInPeriod.length);

    const currentSalesValue = salesForPeriodMetrics.reduce((sum, sale) => sum + sale.totalAmountInCents, 0);
    setSalesValueInPeriod(currentSalesValue);

    // Calcula comissões da plataforma baseadas nas vendas pagas no período
    let calculatedCommissions = 0;
    salesForPeriodMetrics.forEach(sale => {
      // Usa a comissão já registrada na venda se existir, caso contrário, calcula.
      if (sale.platformCommissionInCents !== undefined) {
          calculatedCommissions += sale.platformCommissionInCents;
      } else {
          // Cálculo de fallback se platformCommissionInCents não estiver na venda (improvável se as vendas são bem formadas)
          const commissionForSale = Math.round(sale.totalAmountInCents * platformSettings.platformCommissionPercentage) + platformSettings.platformFixedFeeInCents;
          calculatedCommissions += commissionForSale;
      }
    });
    setPlatformCommissionsInPeriod(calculatedCommissions);

    const paidSalesCountInPeriod = salesForPeriodMetrics.length;
    setAverageTicketInPeriod(paidSalesCountInPeriod > 0 ? currentSalesValue / paidSalesCountInPeriod : 0);

  }, [allUsers, allSales, dateRangeFilter, platformSettings, isLoading]); // Dependências para recalcular métricas
  
  const stats: DashboardStat[] = [
    { title: "Total de Usuários", value: totalUsersCount, icon: UsersIcon },
    { title: "Novos Usuários (Período)", value: newUsersInPeriod, icon: UsersIcon },
    { title: "Vendas (Período)", value: salesInPeriodCount, icon: ShoppingCartIcon },
    { title: "Valor Vendido (Período)", value: formatCurrency(salesValueInPeriod), icon: CurrencyDollarHeroIcon },
    { title: "Comissão Plataforma (Período)", value: formatCurrency(platformCommissionsInPeriod), icon: ChartBarIcon },
    { title: "Ticket Médio (Período)", value: formatCurrency(averageTicketInPeriod), icon: CurrencyDollarHeroIcon },
  ];

  const selectClasses = "block w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-150 ease-in-out bg-bg-surface bg-opacity-60 backdrop-blur-sm border-border-subtle focus:border-accent-blue-neon focus:ring-1 focus:ring-accent-blue-neon text-text-strong placeholder-text-muted";


  // Renderização de Loading e Erro
  if (isLoading && totalUsersCount === 0 && allSales.length === 0) { // Mostra loading se estiver carregando e não houver dados ainda
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /> <p className="ml-2 text-text-muted">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-display font-bold text-text-strong">Dashboard Super Admin</h1>
        <select 
          value={dateRangeFilter}
          onChange={(e) => setDateRangeFilter(e.target.value)}
          className={`${selectClasses} max-w-xs`} // Adicionado max-width para não esticar demais
        >
          {dateRangeOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-status-error bg-status-error/10 p-3 rounded-xl border border-status-error/30">{error}</p>}
      
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map(stat => (
              <Card key={stat.title} className="p-5 flex flex-col justify-between shadow-lg">
                  <div className="flex items-start justify-between">
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{stat.title}</h3>
                    <div className="p-2 bg-accent-blue-neon/10 rounded-full border border-accent-blue-neon/30">
                        <stat.icon className="h-5 w-5 text-accent-blue-neon" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold font-display text-text-strong mt-2">{stat.value}</p>
              </Card>
          ))}
      </div>

      {/* Seções de Vendas Recentes e Novos Usuários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-accent-gold mb-4">Vendas Recentes</h3>
          {recentSales.length > 0 ? (
            <ul className="divide-y divide-border-subtle">
              {recentSales.map(sale => (
                <li key={sale.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-text-default">{sale.customer.name}</p>
                    <p className="text-xs text-text-muted">{sale.products[0]?.name || 'Produto(s) Indisponível(is)'} - {new Date(sale.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className="font-semibold text-accent-blue-neon">{formatCurrency(sale.totalAmountInCents)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-text-muted">Nenhuma venda recente.</p>}
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-accent-gold mb-4">Novos Usuários</h3>
          {recentUsers.length > 0 ? (
            <ul className="divide-y divide-border-subtle">
              {recentUsers.map(user => (
                <li key={user.id} className="py-3 flex justify-between items-center">
                  <span className="text-text-default">{user.email}</span>
                  <span className="text-xs text-text-muted">{new Date(user.createdAt || 0).toLocaleDateString('pt-BR')}</span>
                </li>
              ))}
            </ul>
           ) : <p className="text-text-muted">Nenhum usuário recente.</p>}
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminDashboardPage;
