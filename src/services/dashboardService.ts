
import { Sale, Customer, Product, PaymentStatus } from '@/types'; // Ajustado para alias @

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

const filterSalesByDateRange = (sales: Sale[], dateRange: string): Sale[] => {
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
    case 'all':
    default:
      return sales; 
  }
  console.log(`[dashboardService] filterSalesByDateRange: Range '${dateRange}', Start: ${startDate?.toISOString()}, End: ${endDate?.toISOString()}`);

  return sales.filter(sale => {
    const saleDate = new Date(sale.paidAt || sale.createdAt);
    if (isNaN(saleDate.getTime())) {
      console.warn(`[dashboardService] Invalid date for sale ID ${sale.id}: paidAt=${sale.paidAt}, createdAt=${sale.createdAt}`);
      return false;
    }
    
    let include = true;
    if (startDate) include = include && saleDate >= startDate;
    if (endDate) include = include && saleDate <= endDate;
    // console.log(`[dashboardService] Sale ID ${sale.id} date ${saleDate.toISOString()} included: ${include}`);
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
  getDashboardData: (params: {
    sales: Sale[];
    customers: Customer[];
    products: Product[]; 
    dateRange: string;
    productId: string;
  }): DashboardData => {
    const { sales, customers, products: allProducts, dateRange, productId } = params;
    console.log(`[dashboardService.getDashboardData] Called with dateRange: ${dateRange}, productId: ${productId}, salesCount: ${sales.length}, customersCount: ${customers.length}`);

    let filteredSales = filterSalesByDateRange(sales, dateRange);
    console.log(`[dashboardService.getDashboardData] Sales after date filter (${dateRange}): ${filteredSales.length}`);
    filteredSales = filterSalesByProduct(filteredSales, productId);
    console.log(`[dashboardService.getDashboardData] Sales after product filter (${productId}): ${filteredSales.length}`);
    
    const paidSales = filteredSales.filter(sale => sale.status === PaymentStatus.PAID);
    console.log(`[dashboardService.getDashboardData] Paid sales in period: ${paidSales.length}`);

    const totalRevenue = paidSales.reduce((sum, sale) => sum + Number(sale.totalAmountInCents || 0), 0);
    const numberOfSales = paidSales.length;
    const averageTicket = numberOfSales > 0 ? totalRevenue / numberOfSales : 0;
    
    const newCustomersInPeriod = customers.filter(customer => {
        if (!customer.firstPurchaseDate) return false;
        const firstPurchaseDate = new Date(customer.firstPurchaseDate);
        if (isNaN(firstPurchaseDate.getTime())) return false;

        let isNewInSelectedPeriod = false;
        const now = new Date();
        let rangeStartDate: Date | null = null;
        let rangeEndDate: Date | null = null;

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
        
        if (!isNewInSelectedPeriod && rangeStartDate && rangeEndDate) {
            isNewInSelectedPeriod = firstPurchaseDate >= rangeStartDate && firstPurchaseDate <= rangeEndDate;
        }

        if (!isNewInSelectedPeriod) return false;
        // console.log(`[dashboardService.getDashboardData] Customer ${customer.email} firstPurchaseDate ${customer.firstPurchaseDate} is new in period ${dateRange}`);

        if (productId !== 'all') {
            const purchasedTargetProduct = customer.productsPurchased.includes(productId);
            // console.log(`[dashboardService.getDashboardData] Customer ${customer.email} purchased product ${productId}: ${purchasedTargetProduct}`);
            return purchasedTargetProduct;
        }
        return true;
    });
    const newCustomers = newCustomersInPeriod.length;
    console.log(`[dashboardService.getDashboardData] Calculated newCustomers: ${newCustomers}`);


    const salesTrend: { periodLabel: string; amount: number }[] = [];
    if (dateRange === 'today') {
      const hourlySales: { [hour: string]: number } = {};
      for (let i = 0; i < 24; i++) {
        hourlySales[String(i).padStart(2, '0') + 'h'] = 0;
      }
      paidSales.forEach(sale => {
        const saleDate = new Date(sale.paidAt || sale.createdAt); // Prioritize paidAt for accuracy
        if (!isNaN(saleDate.getTime())) {
            const hour = String(saleDate.getHours()).padStart(2, '0') + 'h';
            hourlySales[hour] = (hourlySales[hour] || 0) + Number(sale.totalAmountInCents || 0);
            // console.log(`[dashboardService.getDashboardData] Today Trend: Sale ${sale.id} at ${hour}, amount ${sale.totalAmountInCents}. hourlySales[${hour}]=${hourlySales[hour]}`);
        }
      });
      for (const hour in hourlySales) {
        salesTrend.push({ periodLabel: hour, amount: hourlySales[hour] });
      }
    } else { // Daily trend for other ranges
      const dailySales: { [day: string]: number } = {};
      let loopStartDate: Date;
      const now = new Date();
      // Determine the start and end date for the trend line labels
      if (dateRange === 'last7days') loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
      else if (dateRange === 'last30days') loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
      else if (dateRange === 'thisMonth') loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth(), 1));
      else if (dateRange === 'lastMonth') loopStartDate = getStartOfDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      else { // 'all' or 'yesterday' - determine dynamically or from first sale
          loopStartDate = paidSales.length > 0 
            ? getStartOfDate(new Date(paidSales.reduce((min, s) => Math.min(min, new Date(s.paidAt || s.createdAt).getTime()), Date.now())))
            : getStartOfDate(now); // Default to today if no sales
      }
      
      let loopEndDate = getEndOfDate(now); // Default end is today
      if(dateRange === 'lastMonth') loopEndDate = getEndOfDate(new Date(now.getFullYear(), now.getMonth(), 0));
      if(dateRange === 'yesterday') loopEndDate = getEndOfDate(new Date(new Date().setDate(new Date().getDate() -1)));
      
      console.log(`[dashboardService.getDashboardData] Trend loop: Start=${loopStartDate.toISOString()}, End=${loopEndDate.toISOString()}`);
      
      if (!isNaN(loopStartDate.getTime())) { 
        for (let d = new Date(loopStartDate); d <= loopEndDate; d.setDate(d.getDate() + 1)) {
            const dayKey = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            dailySales[dayKey] = 0;
        }
      }

      paidSales.forEach(sale => {
        const saleDate = new Date(sale.paidAt || sale.createdAt); // Prioritize paidAt
        if (!isNaN(saleDate.getTime())) {
            const dayKey = `${String(saleDate.getDate()).padStart(2, '0')}/${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
            // Ensure the sale falls within the loop's intended date range if not 'all'
             if (saleDate >= loopStartDate && saleDate <= loopEndDate) {
                dailySales[dayKey] = (dailySales[dayKey] || 0) + Number(sale.totalAmountInCents || 0);
                // console.log(`[dashboardService.getDashboardData] Daily Trend: Sale ${sale.id} on ${dayKey}, amount ${sale.totalAmountInCents}. dailySales[${dayKey}]=${dailySales[dayKey]}`);
            }
        }
      });
      for (const day in dailySales) {
        salesTrend.push({ periodLabel: day, amount: dailySales[day] });
      }
      salesTrend.sort((a, b) => { // Sort by date for consistent chart display
        const [dayA, monthA] = a.periodLabel.split('/').map(Number);
        const [dayB, monthB] = b.periodLabel.split('/').map(Number);
        if (monthA !== monthB) return monthA - monthB;
        return dayA - dayB;
      });
    }
    console.log(`[dashboardService.getDashboardData] Final salesTrend:`, salesTrend);

    return {
      totalRevenue,
      numberOfSales,
      averageTicket,
      newCustomers,
      salesTrend,
    };
  },
};
