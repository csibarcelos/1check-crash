
import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Sale, PaymentStatus, SaleProductItem } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { BanknotesIcon } from '@heroicons/react/24/outline';
import { superAdminService } from '@/services/superAdminService';
import { Table, TableHeader } from '@/components/ui/Table'; // Import Table
import { getTranslatedPaymentStatusLabel } from '../../utils/paymentStatusUtils';

const formatCurrency = (valueInCents: number): string => {
    return `R\$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

const getStatusClass = (status: PaymentStatus) => {
  switch (status) {
    case PaymentStatus.PAID: return 'bg-status-success/20 text-status-success';
    case PaymentStatus.WAITING_PAYMENT: return 'bg-status-warning/20 text-status-warning';
    default: return 'bg-status-error/20 text-status-error';
  }
};

const InfoItem: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
  <div className={`mb-2 ${className}`}>
    <span className="font-semibold text-text-muted">{label}: </span>
    <span className="text-text-default">{value}</span>
  </div>
);

const SuperAdminSalesPage: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuth();

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isSaleDetailsModalOpen, setIsSaleDetailsModalOpen] = useState(false);

  const fetchSales = useCallback(async () => {
    if (!accessToken) {
      setError("Autenticação de super admin necessária.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const salesData = await superAdminService.getAllPlatformSales(accessToken);
      setSales(salesData.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar vendas.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const handleOpenSaleDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setIsSaleDetailsModalOpen(true);
  };

  const handleCloseSaleDetails = () => {
    setSelectedSale(null);
    setIsSaleDetailsModalOpen(false);
  };

  const salesTableHeaders: TableHeader<Sale>[] = [
    { key: 'id', label: 'ID Venda', renderCell: (sale) => sale.id.split('_').pop()?.substring(0,8) + '...' },
    { key: 'platformUserId', label: 'ID Usuário', renderCell: (sale) => sale.platformUserId.substring(0,10) + '...' },
    { key: 'customer.email', label: 'Cliente Email', renderCell: (sale) => sale.customer.email },
    { key: 'totalAmountInCents', label: 'Valor Total', renderCell: (sale) => formatCurrency(sale.totalAmountInCents) },
    { key: 'platformCommissionInCents', label: 'Comissão Plataforma', renderCell: (sale) => <span className="text-accent-blue-neon">{formatCurrency(sale.platformCommissionInCents || 0)}</span> },
    {
      key: 'status',
      label: 'Status',
      renderCell: (sale) => (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(sale.status)}`}>
          {getTranslatedPaymentStatusLabel(sale.status)}
        </span>
      ),
    },
    { key: 'createdAt', label: 'Data', renderCell: (sale) => new Date(sale.createdAt).toLocaleDateString() },
    {
      key: 'actions',
      label: 'Ações',
      renderCell: (sale) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenSaleDetails(sale); }} className="text-accent-blue-neon hover:text-opacity-80">
          Detalhes
        </Button>
      ),
    },
  ];

  if (isLoading && sales.length === 0) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /><p className="ml-2 text-text-muted">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <BanknotesIcon className="h-8 w-8 text-accent-blue-neon" />
        <h1 className="text-3xl font-display font-bold text-text-strong">Todas as Vendas ({sales.length})</h1>
      </div>

      {error && !isLoading && <p className="text-status-error bg-status-error/10 p-3 rounded-xl border border-status-error/30">{error}</p>}

      <Card className="p-0 sm:p-0">
        <Table<Sale>
            headers={salesTableHeaders}
            data={sales}
            rowKey="id"
            isLoading={isLoading}
            onRowClick={handleOpenSaleDetails}
            emptyStateMessage="Nenhuma venda encontrada na plataforma."
        />
      </Card>

      {selectedSale && (
        <Modal isOpen={isSaleDetailsModalOpen} onClose={handleCloseSaleDetails} title={`Detalhes da Venda ${selectedSale.id.split('_').pop()?.substring(0,8)}...`} size="lg">
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
             <section>
              <h3 className="text-md font-semibold text-accent-gold border-b border-border-subtle pb-1 mb-2">Informações Gerais</h3>
              <InfoItem label="ID Venda Completo" value={selectedSale.id} />
              <InfoItem label="ID Usuário Dono" value={selectedSale.platformUserId} />
              <InfoItem label="ID Transação PushInPay" value={selectedSale.pushInPayTransactionId} />
              {selectedSale.upsellPushInPayTransactionId && <InfoItem label="ID Transação Upsell" value={selectedSale.upsellPushInPayTransactionId} />}
              <InfoItem label="Valor Total" value={<span className="font-bold text-accent-blue-neon">{formatCurrency(selectedSale.totalAmountInCents)}</span>} />
              {selectedSale.upsellAmountInCents && <InfoItem label="Valor Upsell" value={formatCurrency(selectedSale.upsellAmountInCents)} />}
               <InfoItem label="Comissão da Plataforma" value={<span className="text-accent-blue-neon">{formatCurrency(selectedSale.platformCommissionInCents || 0)}</span>} />
              <InfoItem label="Data" value={new Date(selectedSale.createdAt).toLocaleString()} />
              <InfoItem label="Status" value={<span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusClass(selectedSale.status)}`}>{getTranslatedPaymentStatusLabel(selectedSale.status)}</span>} />
             </section>
             <section>
                <h3 className="text-md font-semibold text-accent-gold border-b border-border-subtle pb-1 mb-2">Cliente</h3>
                <InfoItem label="Nome" value={selectedSale.customer.name} />
                <InfoItem label="Email" value={selectedSale.customer.email} />
                <InfoItem label="WhatsApp" value={selectedSale.customer.whatsapp} />
             </section>
             <section>
                <h3 className="text-md font-semibold text-accent-gold border-b border-border-subtle pb-1 mb-2">Produtos</h3>
                {Array.isArray(selectedSale.products) && selectedSale.products.map((item: SaleProductItem, idx: number) => (
                    <div key={idx} className="mb-1 p-2 bg-bg-surface/50 rounded-sm text-sm border border-border-subtle">
                        <p className="font-medium text-text-default">{item.name} {item.isTraditionalOrderBump ? '(Order Bump)' : item.isUpsell ? '(Upsell)' : ''}</p>
                        <p className="text-xs text-text-muted">Qtd: {item.quantity} | Preço Unit.: {formatCurrency(item.priceInCents / item.quantity)} | Total: {formatCurrency(item.priceInCents)}</p>
                    </div>
                ))}
             </section>
             {selectedSale.trackingParameters && Object.keys(selectedSale.trackingParameters).length > 0 && (
                <section>
                    <h3 className="text-md font-semibold text-accent-gold border-b border-border-subtle pb-1 mb-2">UTMs</h3>
                    {Object.entries(selectedSale.trackingParameters).map(([key, value]) => (
                        <InfoItem key={key} label={key} value={value as string} />
                    ))}
                </section>
             )}
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={handleCloseSaleDetails}>Fechar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SuperAdminSalesPage;
