
import { Sale, Customer, Product, PaymentStatus } from '@/types'; // Ajustado para alias @
import { DateRange } from 'react-day-picker';

export interface DashboardData {
  totalRevenue: number;
  numberOfSales: number;
  averageTicket: number;
  newCustomers: number;
  salesTrend: { periodLabel: string; amount: number }[];
  topSellingProducts: { id: string; name: string; quantitySold: number; revenueGenerated: number }[];
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

// Helper to filter sales or customers based on a date field and range
const filterItemsByDateRange = <T extends { createdAt?: string; paidAt?: string; firstPurchaseDate?: string }>(
  items: T[],
  dateRange: string,
  dateField: 'createdAt' | 'paidAt' | 'firstPurchaseDate',
  customRange?: DateRange
): T[] => {
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (dateRange === 'custom' && customRange?.from) {
    startDate = getStartOfDate(customRange.from);
    endDate = customRange.to ? getEndOfDate(customRange.to) : getEndOfDate(customRange.from);
  } else {
    switch (dateRange) {
      case 'today': startDate = getStartOfDate(now); endDate = getEndOfDate(now); break;
      case 'yesterday': const y = new Date(now); y.setDate(now.getDate() - 1); startDate = getStartOfDate(y); endDate = getEndOfDate(y); break;
      case 'last7days': startDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); endDate = getEndOfDate(now); break;
      case 'last30days': startDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)); endDate = getEndOfDate(now); break;
      case 'thisMonth': startDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), 1)); endDate = getEndOfDate(now); break;
      case 'lastMonth': startDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)); endDate = getEndOfDate(new Date(now.getFullYear(), now.getMonth(), 0)); break;
      case 'all': default: return items;
    }
  }

  return items.filter(item => {
    const itemDateStr = item[dateField];
    if (!itemDateStr) return false;
    const itemDate = new Date(itemDateStr);
    if (isNaN(itemDate.getTime())) return false;
    
    let include = true;
    if (startDate) include = include && itemDate >= startDate;
    if (endDate) include = include && itemDate <= endDate;
    return include;
  });
};


const filterSalesByProduct = (sales: Sale[], productId: string): Sale[] => {
  if (productId === 'all') {
    return sales;
  }
  return sales.filter(sale => Array.isArray(sale.products) && sale.products.some(p => p.productId === productId));
};


export const dashboardService = {
  getSalesByStatus: (
    sales: Sale[],
    dateRange: string,
    productId: string,
    customRange?: DateRange
  ): Record<PaymentStatus, number> => {
    const productFilteredSales = filterSalesByProduct(sales, productId);
    const salesInPeriod = filterItemsByDateRange(productFilteredSales, dateRange, 'createdAt', customRange);
    
    const statusCounts = salesInPeriod.reduce((acc, sale) => {
        const status = sale.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as Record<PaymentStatus, number>);

    return statusCounts;
  },

  getDashboardData: (params: {
    sales: Sale[];
    customers: Customer[];
    products: Product[]; 
    dateRange: string;
    productId: string;
    customRange?: DateRange;
  }): DashboardData => {
    const { sales, customers, products, dateRange, productId, customRange } = params;

    // 1. Filter sales by product first (applies to all subsequent calculations)
    const productFilteredSales = filterSalesByProduct(sales, productId);

    // 2. Filter PAID sales by date range using 'paid_at'
    const paidSalesInPeriod = filterItemsByDateRange(
        productFilteredSales.filter(s => s.status === PaymentStatus.PAID && s.paidAt), 
        dateRange, 
        'paidAt', 
        customRange
    );

    const totalRevenue = paidSalesInPeriod.reduce((sum, sale) => sum + Number(sale.totalAmountInCents || 0), 0);
    const numberOfSales = paidSalesInPeriod.length; 
    const averageTicket = numberOfSales > 0 ? totalRevenue / numberOfSales : 0;
    
    // 3. Filter new customers by date range using 'firstPurchaseDate'
    // And also ensure they bought the selected product (if not 'all')
    const newCustomersInPeriod = filterItemsByDateRange(customers, dateRange, 'firstPurchaseDate', customRange)
      .filter(customer => {
        if (productId === 'all') return true;
        // Check if one of the customer's sale IDs corresponds to a sale of the selected product
        return customer.saleIds.some(saleId => {
          const sale = productFilteredSales.find(s => s.id === saleId);
          return sale && sale.status === PaymentStatus.PAID; // Ensure it's a paid sale for the product
        });
      });
    const newCustomers = newCustomersInPeriod.length;

    // 4. Calculate Top Selling Products
    const productPerformance: { [key: string]: { quantitySold: number; revenueGenerated: number } } = {};

    paidSalesInPeriod.forEach(sale => {
      if (Array.isArray(sale.products)) {
        sale.products.forEach(item => {
          if (!productPerformance[item.productId]) {
            productPerformance[item.productId] = { quantitySold: 0, revenueGenerated: 0 };
          }
          productPerformance[item.productId].quantitySold += item.quantity;
          productPerformance[item.productId].revenueGenerated += item.priceInCents;
        });
      }
    });

    const topSellingProducts = Object.entries(productPerformance)
      .map(([id, performance]) => {
        const productInfo = products.find(p => p.id === id);
        return {
          id,
          name: productInfo?.name || 'Produto Desconhecido',
          ...performance,
        };
      })
      .sort((a, b) => b.revenueGenerated - a.revenueGenerated)
      .slice(0, 5); // Top 5

    // 5. Sales Trend (based on PAID sales in period)
    const salesTrend: { periodLabel: string; amount: number }[] = [];
    const now = new Date();

    if (dateRange === 'today') {
      const hourlySales: { [hour: string]: number } = {};
      for (let i = 0; i < 24; i++) { hourlySales[String(i).padStart(2, '0') + 'h'] = 0; }
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
      for (const hour in hourlySales) { salesTrend.push({ periodLabel: hour, amount: hourlySales[hour] }); }
    } else { 
      const aggregatedSales: { [periodKey: string]: number } = {};
      let loopStartDate: Date;
      let loopEndDate = getEndOfDate(now); 
      let granularity: 'day' | 'month' = 'day';

      if (dateRange === 'custom' && customRange?.from) {
        loopStartDate = getStartOfDate(customRange.from);
        loopEndDate = customRange.to ? getEndOfDate(customRange.to) : getEndOfDate(customRange.from);
        const diffTime = Math.abs(loopEndDate.getTime() - loopStartDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 90) { granularity = 'month'; }
      } else if (dateRange === 'all' && paidSalesInPeriod.length > 0) {
          const firstSaleDate = new Date(paidSalesInPeriod.reduce((min, s) => s.paidAt ? Math.min(min, new Date(s.paidAt).getTime()) : min, Date.now()));
          const lastSaleDate = new Date(paidSalesInPeriod.reduce((max, s) => s.paidAt ? Math.max(max, new Date(s.paidAt).getTime()) : max, 0));
          loopStartDate = getStartOfDate(firstSaleDate);
          loopEndDate = getEndOfDate(lastSaleDate);
          
          const diffTime = Math.abs(loopEndDate.getTime() - loopStartDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 0 && paidSalesInPeriod.length > 0) { // Handle all sales on a single day
              granularity = 'day'; // Default to day, will be overridden by 'today' logic if dateRange is today
              loopStartDate = getStartOfDate(firstSaleDate);
              loopEndDate = getEndOfDate(firstSaleDate);
          } else if (diffDays > 90) { 
              granularity = 'month';
              loopStartDate = new Date(firstSaleDate.getFullYear(), firstSaleDate.getMonth(), 1); 
              loopEndDate = new Date(lastSaleDate.getFullYear(), lastSaleDate.getMonth() + 1, 0); 
          }
      } else {
          switch(dateRange) {
              case 'yesterday': const y = new Date(now); y.setDate(now.getDate() - 1); loopStartDate = getStartOfDate(y); loopEndDate = getEndOfDate(y); break;
              case 'last7days': loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); break;
              case 'last30days': loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)); break;
              case 'thisMonth': loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), 1)); break;
              case 'lastMonth': loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)); loopEndDate = getEndOfDate(new Date(now.getFullYear(), now.getMonth(), 0)); break;
              default: loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); // Default to last 7 days if range not 'all' or 'custom'
          }
      }
      
      if (!isNaN(loopStartDate.getTime()) && paidSalesInPeriod.length > 0) { 
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

      for (const period in aggregatedSales) { salesTrend.push({ periodLabel: period, amount: aggregatedSales[period] }); }
      
      if (dateRange !== 'today' && salesTrend.length > 0) { // Keep original order for 'today' (hourly)
        salesTrend.sort((a, b) => {
          let dateA: Date, dateB: Date;
          if (granularity === 'day') {
            const [dayA, monthA] = a.periodLabel.split('/').map(Number);
            const [dayB, monthB] = b.periodLabel.split('/').map(Number);
            const year = (dateRange === 'all' && loopEndDate.getFullYear() !== loopStartDate.getFullYear()) 
                         ? (monthA > monthB ? loopStartDate.getFullYear() : loopEndDate.getFullYear()) 
                         : now.getFullYear(); // Assume current year if not 'all' with year span
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

    return { totalRevenue, numberOfSales, averageTicket, newCustomers, salesTrend, topSellingProducts };
  },
};
