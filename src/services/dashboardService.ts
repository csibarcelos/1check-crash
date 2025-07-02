
import { Sale, Customer, Product, PaymentStatus } from '@/types';
import { DateRange } from 'react-day-picker';

export type AchievementId = 
  | 'first_sale' 
  | 'revenue_1k' 
  | 'revenue_10k' 
  | 'revenue_100k' 
  | 'first_order_bump' 
  | 'first_upsell' 
  | 'first_coupon'
  | 'five_sales_one_day'
  | 'ten_products'
  | 'perfect_week';

export interface PersonalBests {
  bestDay: { date: string; amount: number };
  bestMonth: { date: string; amount: number };
  biggestSale: { id: string; amount: number };
}

export interface DashboardData {
  totalRevenue: number;
  numberOfSales: number;
  averageTicket: number;
  newCustomers: number;
  salesTrend: { periodLabel: string; amount: number }[];
  topSellingProducts: { id: string; name: string; quantitySold: number; revenueGenerated: number }[];
  personalBests: PersonalBests;
  todayRevenue: number;
  unlockedAchievements: AchievementId[];
  dailyRecordBreaks: number;
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

const filterItemsByDateRange = <T extends { createdAt?: string | null; paidAt?: string | null; firstPurchaseDate?: string | null }>(
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

const calculatePersonalBests = (allPaidSales: Sale[]): PersonalBests => {
  const initialBests: PersonalBests = {
    bestDay: { date: 'N/A', amount: 0 },
    bestMonth: { date: 'N/A', amount: 0 },
    biggestSale: { id: 'N/A', amount: 0 },
  };

  if (allPaidSales.length === 0) {
    return initialBests;
  }

  const biggestSale = allPaidSales.reduce((max, sale) => 
    sale.totalAmountInCents > max.totalAmountInCents ? sale : max, 
    allPaidSales[0]
  );

  const salesByDay: { [key: string]: number } = {};
  allPaidSales.forEach(sale => {
    if (sale.paidAt) {
      const dayKey = new Date(sale.paidAt).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' });
      salesByDay[dayKey] = (salesByDay[dayKey] || 0) + sale.totalAmountInCents;
    }
  });

  const bestDayEntry = Object.entries(salesByDay).reduce((max, entry) => 
    entry[1] > max[1] ? entry : max, 
    ['N/A', 0]
  );

  const salesByMonth: { [key: string]: number } = {};
  allPaidSales.forEach(sale => {
    if (sale.paidAt) {
      const monthKey = new Date(sale.paidAt).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });
      salesByMonth[monthKey] = (salesByMonth[monthKey] || 0) + sale.totalAmountInCents;
    }
  });

  const bestMonthEntry = Object.entries(salesByMonth).reduce((max, entry) => 
    entry[1] > max[1] ? entry : max, 
    ['N/A', 0]
  );

  return {
    bestDay: { date: bestDayEntry[0], amount: bestDayEntry[1] },
    bestMonth: { date: bestMonthEntry[0].charAt(0).toUpperCase() + bestMonthEntry[0].slice(1), amount: bestMonthEntry[1] },
    biggestSale: { id: biggestSale.id, amount: biggestSale.totalAmountInCents },
  };
};

const calculateAchievements = (allPaidSales: Sale[], allProducts: Product[]): AchievementId[] => {
  const unlocked: AchievementId[] = [];
  if (allPaidSales.length > 0) {
    unlocked.push('first_sale');
  }

  const totalRevenue = allPaidSales.reduce((sum, sale) => sum + sale.totalAmountInCents, 0);
  if (totalRevenue >= 100000) unlocked.push('revenue_1k');
  if (totalRevenue >= 1000000) unlocked.push('revenue_10k');
  if (totalRevenue >= 10000000) unlocked.push('revenue_100k');

  if (allPaidSales.some(sale => sale.products.some(p => p.isTraditionalOrderBump))) {
    unlocked.push('first_order_bump');
  }
  if (allPaidSales.some(sale => sale.products.some(p => p.isUpsell))) {
    unlocked.push('first_upsell');
  }
  if (allPaidSales.some(sale => sale.couponCodeUsed)) {
    unlocked.push('first_coupon');
  }
  
  const salesByDay: { [key: string]: number } = {};
  allPaidSales.forEach(sale => {
    if (sale.paidAt) {
      const dayKey = new Date(sale.paidAt).toISOString().split('T')[0];
      salesByDay[dayKey] = (salesByDay[dayKey] || 0) + 1;
    }
  });
  if (Object.values(salesByDay).some(count => count >= 5)) {
    unlocked.push('five_sales_one_day');
  }

  if (allProducts.length >= 10) {
    unlocked.push('ten_products');
  }

  const saleDays = new Set(Object.keys(salesByDay));
  if (saleDays.size > 0) {
    const sortedSaleDays = Array.from(saleDays).sort();
    let consecutiveDays = 1;
    for (let i = 1; i < sortedSaleDays.length; i++) {
      const prevDate = new Date(sortedSaleDays[i-1]);
      const currDate = new Date(sortedSaleDays[i]);
      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        consecutiveDays++;
      } else {
        consecutiveDays = 1;
      }
      if (consecutiveDays >= 7) {
        unlocked.push('perfect_week');
        break;
      }
    }
  }

  return unlocked;
};

export const dashboardService = {
  getDashboardData: (params: {
    sales: Sale[];
    customers: Customer[];
    products: Product[]; 
    dateRange: string;
    productId: string;
    customRange?: DateRange;
    dailyRecordBreaks?: number;
  }): DashboardData => {
    const { sales, customers, products, dateRange, productId, customRange, dailyRecordBreaks = 0 } = params;

    const allPaidSales = sales.filter(s => s.status === PaymentStatus.PAID && s.paidAt);
    const personalBests = calculatePersonalBests(allPaidSales);
    const unlockedAchievements = calculateAchievements(allPaidSales, products);

    const productFilteredSales = filterSalesByProduct(sales, productId);

    const paidSalesInPeriod = filterItemsByDateRange(
        productFilteredSales.filter(s => s.status === PaymentStatus.PAID && s.paidAt), 
        dateRange, 
        'paidAt', 
        customRange
    );

    const totalRevenue = paidSalesInPeriod.reduce((sum, sale) => sum + Number(sale.totalAmountInCents || 0), 0);
    const numberOfSales = paidSalesInPeriod.length; 
    const averageTicket = numberOfSales > 0 ? totalRevenue / numberOfSales : 0;
    
    const newCustomersInPeriod = filterItemsByDateRange(customers, dateRange, 'firstPurchaseDate', customRange)
      .filter(customer => {
        if (productId === 'all') return true;
        return customer.saleIds.some((saleId: string) => {
          const sale = productFilteredSales.find(s => s.id === saleId);
          return sale && sale.status === PaymentStatus.PAID;
        });
      });
    const newCustomers = newCustomersInPeriod.length;

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
      .slice(0, 5);

    const salesTrend: { periodLabel: string; amount: number }[] = [];
    const now = new Date();

    if (dateRange === 'today' || dateRange === 'yesterday') {
      const hourlySales: { [hour: string]: number } = {};
      for (let i = 0; i < 24; i++) { hourlySales[String(i).padStart(2, '0') + 'h'] = 0; }
      
      const targetDate = new Date(now);
      if (dateRange === 'yesterday') {
        targetDate.setDate(now.getDate() - 1);
      }
      const startOfTargetDate = getStartOfDate(targetDate);
      const endOfTargetDate = getEndOfDate(targetDate);

      paidSalesInPeriod.forEach(sale => { 
        if (sale.paidAt) { 
            const saleDate = new Date(sale.paidAt);
            if (!isNaN(saleDate.getTime()) && saleDate >= startOfTargetDate && saleDate <= endOfTargetDate) { 
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

          if (diffDays === 0 && paidSalesInPeriod.length > 0) {
              granularity = 'day';
              loopStartDate = getStartOfDate(firstSaleDate);
              loopEndDate = getEndOfDate(firstSaleDate);
          } else if (diffDays > 90) { 
              granularity = 'month';
              loopStartDate = new Date(firstSaleDate.getFullYear(), firstSaleDate.getMonth(), 1); 
              loopEndDate = new Date(lastSaleDate.getFullYear(), lastSaleDate.getMonth() + 1, 0); 
          }
      } else {
          switch(dateRange) {
              case 'last7days': loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); break;
              case 'last30days': loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)); break;
              case 'thisMonth': loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), 1)); break;
              case 'lastMonth': loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)); loopEndDate = getEndOfDate(new Date(now.getFullYear(), now.getMonth(), 0)); break;
              default: loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
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
      
      if (dateRange !== 'today' && salesTrend.length > 0) {
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

    const todayRevenue = filterItemsByDateRange(allPaidSales, 'today', 'paidAt').reduce((sum, sale) => sum + Number(sale.totalAmountInCents || 0), 0);

    return { totalRevenue, numberOfSales, averageTicket, newCustomers, salesTrend, topSellingProducts, personalBests, todayRevenue, unlockedAchievements, dailyRecordBreaks };
  },
};
