
import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Sale, PaymentStatus, PaymentMethod, SaleProductItem } from '@/types';
import {
  ShoppingCartIcon,
  WhatsAppIcon,
  generateWhatsAppLink,
} from '../constants.tsx';
import { useData } from '@/contexts/DataContext';
import { Table, TableHeader } from '@/components/ui/Table'; // Import Table


const ITEMS_PER_PAGE = 10;

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

const getPaymentMethodLabel = (method: PaymentMethod) => {
  const labels: Record<PaymentMethod, string> = {
    [PaymentMethod.PIX]: 'PIX',
    [PaymentMethod.CREDIT_CARD]: 'Cartão de Crédito',
    [PaymentMethod.BOLETO]: 'Boleto',
  };
  return labels[method] || 'Desconhecido';
};

const formatCurrency = (valueInCents: number) => {
    return `R\$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const InfoItem: React.FC<{ label: string; value: React.ReactNode; className?: string; isWhatsApp?: boolean; whatsAppUrl?: string }> = ({ label, value, className, isWhatsApp, whatsAppUrl }) => (
  <div className={`mb-2 ${className}`}>
    <span className="font-semibold text-text-muted">{label}: </span>
    <span className="text-text-default">{value}</span>
    {isWhatsApp && whatsAppUrl && (
      <a
        href={whatsAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Enviar mensagem via WhatsApp"
        className="ml-2 inline-flex items-center text-status-success hover:opacity-80"
        onClick={(e) => { if (!whatsAppUrl) e.preventDefault();}}
      >
        <WhatsAppIcon className="h-5 w-5" />
      </a>
    )}
  </div>
);


const VendasPage: React.FC = () => {
  const { sales: allSales, isLoading, error } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | ''>( '');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<PaymentMethod | ''>( '');
  
  const [currentPage, setCurrentPage] = useState(1);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  
  const filteredSales = useMemo(() => {
    let currentSales = [...allSales];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      currentSales = currentSales.filter(sale =>
        sale.customer.name?.toLowerCase().includes(term) ||
        sale.customer.email?.toLowerCase().includes(term) ||
        sale.id?.toLowerCase().includes(term) ||
        (Array.isArray(sale.products) && sale.products.some(p => p.name?.toLowerCase().includes(term)))
      );
    }
    if (filterStatus) { 
      currentSales = currentSales.filter(sale => sale.status === filterStatus);
    }
    if (filterPaymentMethod) {
      currentSales = currentSales.filter(sale => sale.paymentMethod === filterPaymentMethod);
    }
    return currentSales;
  }, [searchTerm, filterStatus, filterPaymentMethod, allSales]);
  
  const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSales.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSales, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1); 
  }, [searchTerm, filterStatus, filterPaymentMethod]);


  const handleOpenDetailsModal = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedSale(null);
    setIsDetailsModalOpen(false);
  };

  const selectClasses = "block w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-150 ease-in-out bg-bg-surface bg-opacity-60 backdrop-blur-sm border-border-subtle focus:border-accent-blue-neon focus:ring-1 focus:ring-accent-blue-neon text-text-strong placeholder-text-muted";

  const salesTableHeaders: TableHeader<Sale>[] = [
    { key: 'id', label: 'ID Venda', renderCell: (sale) => sale.id.split('_').pop()?.substring(0, 8) + '...' },
    {
      key: 'customer',
      label: 'Cliente',
      renderCell: (sale) => (
        <>
          <div className="text-sm font-medium text-text-strong">{sale.customer.name}</div>
          <div className="text-xs text-text-muted">{sale.customer.email}</div>
        </>
      ),
    },
    { key: 'totalAmountInCents', label: 'Valor', renderCell: (sale) => <span className="text-accent-blue-neon font-semibold">{formatCurrency(sale.totalAmountInCents)}</span> },
    {
      key: 'type',
      label: 'Tipo',
      renderCell: (sale) => (
        <span className={`px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full ${sale.upsellAmountInCents && sale.upsellAmountInCents > 0 && sale.upsellStatus === PaymentStatus.PAID ? 'bg-purple-500/20 text-purple-400' : 'bg-neutral-700 text-text-muted'}`}>
          {sale.upsellAmountInCents && sale.upsellAmountInCents > 0 && sale.upsellStatus === PaymentStatus.PAID ? 'Principal + Upsell' : 'Principal'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      renderCell: (sale) => (
        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(sale.status)}`}>
          {(sale.status as string).replace(/_/g, ' ').toUpperCase()}
        </span>
      ),
    },
    { key: 'paymentMethod', label: 'Método', renderCell: (sale) => getPaymentMethodLabel(sale.paymentMethod as PaymentMethod) },
    { key: 'createdAt', label: 'Data', renderCell: (sale) => formatDateTime(sale.createdAt) },
    {
      key: 'actions',
      label: 'Ações',
      renderCell: (sale) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenDetailsModal(sale); }} className="text-accent-blue-neon hover:text-opacity-80">
          Ver Detalhes
        </Button>
      ),
    },
  ];

  if (isLoading && allSales.length === 0) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /></div>;
  }
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-4xl font-bold text-text-strong">Minhas Vendas ({filteredSales.length})</h1>
      </div>

      {error && <p className="my-4 text-sm text-status-error p-3 bg-status-error/10 rounded-xl border border-status-error/30">{error}</p>}
      
      <Card className="p-0 sm:p-0"> 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 mb-6 p-6 border-b border-border-subtle">
          <Input 
            placeholder="Buscar por cliente, email, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:col-span-2 lg:col-span-1" 
          />
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-text-default mb-1.5">Status</label>
            <select 
              id="statusFilter" 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as PaymentStatus | '')}
              className={selectClasses}
            >
              <option value="">Todos Status</option>
              {Object.values(PaymentStatus).map((status: PaymentStatus) => (
                <option key={status} value={status}>{(status as string).replace(/_/g, ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="paymentMethodFilter" className="block text-sm font-medium text-text-default mb-1.5">Método</label>
            <select 
              id="paymentMethodFilter" 
              value={filterPaymentMethod}
              onChange={(e) => setFilterPaymentMethod(e.target.value as PaymentMethod | '')}
              className={selectClasses}
            >
              <option value="">Todos Métodos</option>
              {Object.values(PaymentMethod).map((method: PaymentMethod) => (
                <option key={method} value={method}>{getPaymentMethodLabel(method as PaymentMethod)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => {setSearchTerm(''); setFilterStatus(''); setFilterPaymentMethod('');}} className="w-full">Limpar Filtros</Button>
          </div>
        </div>

        <Table<Sale>
            headers={salesTableHeaders}
            data={paginatedSales}
            rowKey="id"
            isLoading={isLoading}
            onRowClick={handleOpenDetailsModal}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={ITEMS_PER_PAGE}
            totalItems={filteredSales.length}
            emptyStateMessage={
                 <div className="text-center py-16">
                    <ShoppingCartIcon className="h-20 w-20 text-text-muted/50 mx-auto mb-6" />
                    <p className="text-xl text-text-muted">
                    {allSales.length === 0 ? "Nenhuma venda registrada ainda." : "Nenhuma venda encontrada com os filtros atuais."}
                    </p>
                </div>
            }
        />
      </Card>

      {selectedSale && (
        <Modal 
            isOpen={isDetailsModalOpen} 
            onClose={handleCloseDetailsModal} 
            title={`Detalhes da Venda #${selectedSale.id.split('_').pop()?.substring(0, 8)}`}
            size="xl" 
        >
            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-3 text-sm"> 
                <section>
                    <h3 className="text-lg font-semibold text-accent-gold border-b border-border-subtle pb-2 mb-3">Informações Gerais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                        <InfoItem label="ID da Venda" value={selectedSale.id} />
                        <InfoItem label="Data" value={formatDateTime(selectedSale.createdAt)} />
                        <InfoItem label="Valor Total" value={<span className="font-bold text-accent-blue-neon text-lg">{formatCurrency(selectedSale.totalAmountInCents)}</span>} />
                        <InfoItem label="Método de Pagamento" value={getPaymentMethodLabel(selectedSale.paymentMethod as PaymentMethod)} />
                        <InfoItem label="Status" value={<span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(selectedSale.status)}`}>{(selectedSale.status as string).replace(/_/g, ' ').toUpperCase()}</span>} />
                        {selectedSale.upsellAmountInCents && selectedSale.upsellAmountInCents > 0 && selectedSale.upsellStatus === PaymentStatus.PAID && (
                          <InfoItem label="Tipo" value={<span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-400">Principal + Upsell</span>} />
                        )}
                        {selectedSale.paidAt && <InfoItem label="Pago em" value={formatDateTime(selectedSale.paidAt)} />}
                        {selectedSale.couponCodeUsed && <InfoItem label="Cupom Usado" value={selectedSale.couponCodeUsed} />}
                        {selectedSale.discountAppliedInCents && selectedSale.discountAppliedInCents > 0 && <InfoItem label="Desconto Aplicado" value={<span className="text-status-error">-{formatCurrency(selectedSale.discountAppliedInCents)}</span>} />}
                        {selectedSale.originalAmountBeforeDiscountInCents !== selectedSale.totalAmountInCents && <InfoItem label="Valor Original" value={formatCurrency(selectedSale.originalAmountBeforeDiscountInCents)} />}
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-accent-gold border-b border-border-subtle pb-2 mb-3">Informações do Cliente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                         <InfoItem label="Nome" value={selectedSale.customer.name} />
                         <InfoItem label="Email" value={selectedSale.customer.email} />
                         <InfoItem 
                            label="WhatsApp" 
                            value={selectedSale.customer.whatsapp} 
                            isWhatsApp={!!selectedSale.customer.whatsapp}
                            whatsAppUrl={selectedSale.customer.whatsapp ? generateWhatsAppLink(selectedSale.customer.whatsapp, `Olá ${selectedSale.customer.name}, sobre seu pedido...`) : undefined}
                          />
                         {selectedSale.customer.ip && <InfoItem label="IP" value={selectedSale.customer.ip} />}
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-accent-gold border-b border-border-subtle pb-2 mb-3">Produtos Adquiridos</h3>
                    {Array.isArray(selectedSale.products) && selectedSale.products.map((item: SaleProductItem, idx: number) => (
                        <div key={idx} className="mb-2 p-3 bg-neutral-700/30 rounded-md border border-border-subtle">
                            <p className="font-semibold text-text-default">{item.name} {item.isTraditionalOrderBump ? <span className="text-xs text-accent-blue-neon">(Order Bump)</span> : item.isUpsell ? <span className="text-xs text-accent-blue-neon">(Upsell)</span> : ''}</p>
                            <div className="grid grid-cols-2 gap-x-4 text-xs text-text-muted">
                                <span>Quantidade: {item.quantity}</span>
                                <span>Preço Unitário: {formatCurrency(item.originalPriceInCents)}</span>
                                {item.priceInCents !== item.originalPriceInCents && <span>Preço com Desconto: {formatCurrency(item.priceInCents)}</span>}
                                <span>Subtotal: {formatCurrency(item.priceInCents * item.quantity)}</span>
                            </div>
                        </div>
                    ))}
                </section>

                {selectedSale.trackingParameters && Object.keys(selectedSale.trackingParameters).length > 0 && (
                    <section>
                        <h3 className="text-lg font-semibold text-accent-gold border-b border-border-subtle pb-2 mb-3">Parâmetros de Rastreamento (UTMs)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                            {Object.entries(selectedSale.trackingParameters).map(([key, value]) => (
                                <InfoItem key={key} label={key} value={value as string} className="text-xs"/>
                            ))}
                        </div>
                    </section>
                )}

                {selectedSale.commission && (
                     <section>
                        <h3 className="text-lg font-semibold text-accent-gold border-b border-border-subtle pb-2 mb-3">Detalhes da Comissão</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                            <InfoItem label="Preço Total (Base Comissão)" value={formatCurrency(selectedSale.commission.totalPriceInCents)} />
                            <InfoItem label="Taxa do Gateway" value={formatCurrency(selectedSale.commission.gatewayFeeInCents)} />
                            <InfoItem label="Comissão do Usuário" value={formatCurrency(selectedSale.commission.userCommissionInCents)} />
                            <InfoItem label="Comissão da Plataforma" value={formatCurrency(selectedSale.platformCommissionInCents || 0)} />
                        </div>
                    </section>
                )}

            </div>
            <div className="mt-6 flex justify-end">
                <Button variant="outline" onClick={handleCloseDetailsModal}>Fechar</Button>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default VendasPage;
