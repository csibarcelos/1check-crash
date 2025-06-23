import { Sale, Customer, Product, PaymentStatus } from '@/types'; // Ajustado para alias @
import { DateRange } from 'react-day-picker';

export interface DashboardData {
  totalRevenue: number;
  numberOfSales: number;
  averageTicket: number;
  newCustomers: number;
  salesTrend: { periodLabel: string; amount: number }[];
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

const filterSalesByDateRange = (sales: Sale[], dateRange: string, customRange?: DateRange): Sale[] => {
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (dateRange === 'custom' && customRange?.from) {
    startDate = getStartOfDate(customRange.from);
    endDate = customRange.to ? getEndOfDate(customRange.to) : getEndOfDate(customRange.from); // Se 'to' não estiver definido, usa 'from' como fim também
  } else {
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
      case 'all':
      default:
        console.log(`[dashboardService] filterSalesByDateRange: Range 'all', returning all ${sales.length} sales.`);
        return sales; 
    }
  }
  console.log(`[dashboardService] filterSalesByDateRange: Range '${dateRange}', Start: ${startDate?.toISOString()}, End: ${endDate?.toISOString()}`);

  const filtered = sales.filter(sale => {
    const dateToFilter = (sale.status === PaymentStatus.PAID && sale.paidAt) ? sale.paidAt : sale.createdAt;
    
    if(!dateToFilter) {
        return false; 
    }
    const saleDate = new Date(dateToFilter);

    if (isNaN(saleDate.getTime())) {
      console.warn(`[dashboardService] Invalid date for sale ID ${sale.id}: dateToFilter=${dateToFilter}`);
      return false;
    }
    
    let include = true;
    if (startDate) include = include && saleDate >= startDate;
    if (endDate) include = include && saleDate <= endDate;
    return include;
  });
  console.log(`[dashboardService] filterSalesByDateRange: Filtered to ${filtered.length} sales.`);
  return filtered;
};

const filterSalesByProduct = (sales: Sale[], productId: string): Sale[] => {
  if (productId === 'all') {
    return sales;
  }
  return sales.filter(sale => Array.isArray(sale.products) && sale.products.some(p => p.productId === productId));
};


export const dashboardService = {
  getDashboardData: (params: {
    sales: Sale[];
    customers: Customer[];
    products: Product[]; 
    dateRange: string;
    productId: string;
    customRange?: DateRange; // Add customRange here
  }): DashboardData => {
    const { sales, customers, dateRange, productId, customRange } = params; // Destructure customRange
    console.log(`[dashboardService.getDashboardData] Called with dateRange: ${dateRange}, productId: ${productId}, customRange: ${customRange?.from}-${customRange?.to}, salesCount: ${sales.length}, customersCount: ${customers.length}`);

    let filteredSalesByDate = filterSalesByDateRange(sales, dateRange, customRange); // Pass customRange
    console.log(`[dashboardService.getDashboardData] Sales after date filter (${dateRange}): ${filteredSalesByDate.length}`);
    let filteredSalesByProductAndDate = filterSalesByProduct(filteredSalesByDate, productId);
    console.log(`[dashboardService.getDashboardData] Sales after product filter (${productId}): ${filteredSalesByProductAndDate.length}`);
    
    const paidSalesInPeriod = filteredSalesByProductAndDate.filter(sale => sale.status === PaymentStatus.PAID && sale.paidAt);
    console.log(`[dashboardService.getDashboardData] Paid sales in period (with paidAt): ${paidSalesInPeriod.length}. Sample:`, paidSalesInPeriod.slice(0,2).map(s => ({id: s.id, paidAt: s.paidAt, total: s.totalAmountInCents})));

    const totalRevenue = paidSalesInPeriod.reduce((sum, sale) => sum + Number(sale.totalAmountInCents || 0), 0);
    const numberOfSales = paidSalesInPeriod.length; 
    const averageTicket = numberOfSales > 0 ? totalRevenue / numberOfSales : 0;
    
    const newCustomersInPeriod = customers.filter(customer => {
        if (!customer.firstPurchaseDate) return false;
        const firstPurchaseDate = new Date(customer.firstPurchaseDate);
        if (isNaN(firstPurchaseDate.getTime())) return false;

        let isNewInSelectedPeriod = false;
        const now = new Date();
        let rangeStartDate: Date | null = null;
        let rangeEndDate: Date | null = null;

        if (dateRange === 'custom' && customRange?.from) {
            rangeStartDate = getStartOfDate(customRange.from);
            rangeEndDate = customRange.to ? getEndOfDate(customRange.to) : getEndOfDate(customRange.from);
        } else {
            switch (dateRange) {
                case 'today': rangeStartDate = getStartOfDate(now); rangeEndDate = getEndOfDate(now); break;
                case 'yesterday': const y = new Date(now); y.setDate(now.getDate() - 1); rangeStartDate = getStartOfDate(y); rangeEndDate = getEndOfDate(y); break;
                case 'last7days': rangeStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); rangeEndDate = getEndOfDate(now); break;
                case 'last30days': rangeStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)); rangeEndDate = getEndOfDate(now); break;
                case 'thisMonth': rangeStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), 1)); rangeEndDate = getEndOfDate(now); break;
                case 'lastMonth': rangeStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)); rangeEndDate = getEndOfDate(new Date(now.getFullYear(), now.getMonth(), 0)); break;
                case 'all': isNewInSelectedPeriod = true; break; 
                default: isNewInSelectedPeriod = true; 
            }
        }
        
        if (!isNewInSelectedPeriod && rangeStartDate && rangeEndDate) {
            isNewInSelectedPeriod = firstPurchaseDate >= rangeStartDate && firstPurchaseDate <= rangeEndDate;
        }

        if (!isNewInSelectedPeriod) return false;
        
        if (productId !== 'all') {
            const purchasedTargetProduct = customer.productsPurchased.includes(productId);
            return purchasedTargetProduct;
        }
        return true;
    });
    const newCustomers = newCustomersInPeriod.length;
    console.log(`[dashboardService.getDashboardData] Calculated newCustomers: ${newCustomers}`);


    const salesTrend: { periodLabel: string; amount: number }[] = [];
    const now = new Date();

    if (dateRange === 'today') {
      const hourlySales: { [hour: string]: number } = {};
      for (let i = 0; i < 24; i++) { 
        hourlySales[String(i).padStart(2, '0') + 'h'] = 0;
      }
      paidSalesInPeriod.forEach(sale => { 
        if (sale.paidAt) { 
            const saleDate = new Date(sale.paidAt);
            const startOfToday = getStartOfDate(now);
            const endOfToday = getEndOfDate(now);
            if (!isNaN(saleDate.getTime()) && saleDate >= startOfToday && saleDate <= endOfToday) { 
                const hour = String(saleDate.getHours()).padStart(2, '0') + 'h';
                hourlySales[hour] = (hourlySales[hour] || 0) + Number(sale.totalAmountInCents || 0);
            }
        }
      });
      console.log("[dashboardService] Hourly sales for today:", hourlySales);
      for (const hour in hourlySales) {
        salesTrend.push({ periodLabel: hour, amount: hourlySales[hour] });
      }
    } else { 
      const aggregatedSales: { [periodKey: string]: number } = {};
      let loopStartDate: Date;
      let loopEndDate = getEndOfDate(now); 
      // let periodFormat: 'DD/MM' | 'MMM/YY' = 'DD/MM'; // Removido, pois não era usado
      let granularity: 'day' | 'month' = 'day';

      if (dateRange === 'custom' && customRange?.from) {
        loopStartDate = getStartOfDate(customRange.from);
        loopEndDate = customRange.to ? getEndOfDate(customRange.to) : getEndOfDate(customRange.from);
        const diffTime = Math.abs(loopEndDate.getTime() - loopStartDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 90) { granularity = 'month'; /* periodFormat = 'MMM/YY'; */ }
      } else if (dateRange === 'all' && paidSalesInPeriod.length > 0) {
          const firstSaleDate = new Date(paidSalesInPeriod.reduce((min, s) => s.paidAt ? Math.min(min, new Date(s.paidAt).getTime()) : min, Date.now()));
          const lastSaleDate = new Date(paidSalesInPeriod.reduce((max, s) => s.paidAt ? Math.max(max, new Date(s.paidAt).getTime()) : max, 0));
          loopStartDate = getStartOfDate(firstSaleDate);
          loopEndDate = getEndOfDate(lastSaleDate);
          
          const diffTime = Math.abs(loopEndDate.getTime() - loopStartDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > 90) { 
              granularity = 'month';
              // periodFormat = 'MMM/YY'; // Removido
              loopStartDate = new Date(firstSaleDate.getFullYear(), firstSaleDate.getMonth(), 1); 
              loopEndDate = new Date(lastSaleDate.getFullYear(), lastSaleDate.getMonth() + 1, 0); 
          }
          console.log(`[dashboardService] 'all' range: ${diffDays} days. Granularity: ${granularity}. Start: ${loopStartDate.toISOString()}, End: ${loopEndDate.toISOString()}`);
      } else {
          switch(dateRange) {
              case 'yesterday':
                  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
                  loopStartDate = getStartOfDate(yesterday); loopEndDate = getEndOfDate(yesterday);
                  break;
              case 'last7days': loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); break;
              case 'last30days': loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)); break;
              case 'thisMonth': loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), 1)); break;
              case 'lastMonth':
                  loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
                  loopEndDate = getEndOfDate(new Date(now.getFullYear(), now.getMonth(), 0));
                  break;
              default: 
                  loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); 
          }
      }
      
      console.log(`[dashboardService.getDashboardData] Aggregation loop: Start=${loopStartDate.toISOString()}, End=${loopEndDate.toISOString()}, Granularity=${granularity}`);
      
      if (!isNaN(loopStartDate.getTime())) { 
        if (granularity === 'day') {
            for (let d = new Date(loopStartDate); d <= loopEndDate; d.setDate(d.getDate() + 1)) {
                const dayKey = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                aggregatedSales[dayKey] = 0; 
            }
        } else { 
            for (let m = new Date(loopStartDate.getFullYear(), loopStartDate.getMonth(), 1); m <= loopEndDate; m.setMonth(m.getMonth() + 1)) {
                 const monthKey = `${m.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}/${String(m.getFullYear()).slice(-2)}`;
                 aggregatedSales[monthKey] = 0;
            }
        }
      }

      paidSalesInPeriod.forEach(sale => { 
        if (sale.paidAt) { 
            const saleDate = new Date(sale.paidAt);
            if (!isNaN(saleDate.getTime()) && saleDate >= loopStartDate && saleDate <= loopEndDate) {
                let periodKey: string;
                if (granularity === 'day') {
                    periodKey = `${String(saleDate.getDate()).padStart(2, '0')}/${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
                } else { 
                    periodKey = `${saleDate.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}/${String(saleDate.getFullYear()).slice(-2)}`;
                }
                aggregatedSales[periodKey] = (aggregatedSales[periodKey] || 0) + Number(sale.totalAmountInCents || 0);
            }
        }
      });
      console.log(`[dashboardService] Aggregated sales for period (granularity: ${granularity}):`, aggregatedSales);

      for (const period in aggregatedSales) {
        salesTrend.push({ periodLabel: period, amount: aggregatedSales[period] });
      }
      
      if (dateRange !== 'today') {
        salesTrend.sort((a, b) => {
          let dateA: Date, dateB: Date;
          if (granularity === 'day') {
            const [dayA, monthA] = a.periodLabel.split('/').map(Number);
            const [dayB, monthB] = b.periodLabel.split('/').map(Number);
            const year = (dateRange === 'all' && loopEndDate.getFullYear() !== loopStartDate.getFullYear()) 
                         ? (monthA > monthB ? loopStartDate.getFullYear() : loopEndDate.getFullYear()) 
                         : now.getFullYear();
            dateA = new Date(year, monthA - 1, dayA); 
            dateB = new Date(year, monthB - 1, dayB);
          } else { 
            const [monthStrA, yearAbbrA] = a.periodLabel.split('/');
            const [monthStrB, yearAbbrB] = b.periodLabel.split('/');
            const monthMap: { [key: string]: number } = { 'Jan':0,'Fev':1,'Mar':2,'Abr':3,'Mai':4,'Jun':5,'Jul':6,'Ago':7,'Set':8,'Out':9,'Nov':10,'Dez':11 };
            dateA = new Date(parseInt(`20${yearAbbrA}`), monthMap[monthStrA.charAt(0).toUpperCase() + monthStrA.slice(1).toLowerCase()], 1);
            dateB = new Date(parseInt(`20${yearAbbrB}`), monthMap[monthStrB.charAt(0).toUpperCase() + monthStrB.slice(1).toLowerCase()], 1);
          }
          return dateA.getTime() - dateB.getTime();
        });
      }
    }
    console.log(`[dashboardService.getDashboardData] Final salesTrend length: ${salesTrend.length}, data (first 5):`, salesTrend.slice(0,5));

    return {
      totalRevenue,
      numberOfSales,
      averageTicket,
      newCustomers,
      salesTrend,
    };
  },
};