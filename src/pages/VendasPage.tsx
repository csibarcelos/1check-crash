import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Sale, PaymentStatus, PaymentMethod, SaleProductItem } from '@/types';
import { salesService } from '@/services/salesService';
import { ShoppingCartIcon, WhatsAppIcon, generateWhatsAppLink } from '../constants.tsx';
import { useAuth } from '@/contexts/AuthContext';

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
    return `R$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
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


export const VendasPage: React.FC = () => {
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | ''>('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<PaymentMethod | ''>('');

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const { accessToken } = useAuth();

  const fetchSales = useCallback(async () => {
    if (!accessToken) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await salesService.getSales(accessToken);
      setAllSales(data.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setFilteredSales(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar vendas.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
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
    setFilteredSales(currentSales);
  }, [searchTerm, filterStatus, filterPaymentMethod, allSales]);

  const handleOpenDetailsModal = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedSale(null);
    setIsDetailsModalOpen(false);
  };

  if (isLoading) {
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
              className="block w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-150 ease-in-out bg-white/5 backdrop-blur-sm border-border-subtle focus:border-accent-blue-neon focus:ring-2 focus:ring-accent-blue-neon/70 text-text-strong placeholder-text-muted"
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
              className="block w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-150 ease-in-out bg-white/5 backdrop-blur-sm border-border-subtle focus:border-accent-blue-neon focus:ring-2 focus:ring-accent-blue-neon/70 text-text-strong placeholder-text-muted"
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

        {filteredSales.length === 0 ? (
           <div className="text-center py-16">
            <ShoppingCartIcon className="h-20 w-20 text-text-muted/50 mx-auto mb-6" />
            <p className="text-xl text-text-muted">
              {allSales.length === 0 ? "Nenhuma venda registrada ainda." : "Nenhuma venda encontrada com os filtros atuais."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle">
              <thead className="bg-transparent">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">ID Venda</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Cliente</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Valor</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Método</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Data</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-border-subtle">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-white/5 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{sale.id.split('_').pop()?.substring(0, 8)}...</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-text-strong">{sale.customer.name}</div>
                      <div className="text-xs text-text-muted">{sale.customer.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-accent-blue-neon font-semibold">{formatCurrency(sale.totalAmountInCents)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(sale.status)}`}>
                        {(sale.status as string).replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-default">{getPaymentMethodLabel(sale.paymentMethod as PaymentMethod)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{new Date(sale.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDetailsModal(sale)} className="text-accent-blue-neon hover:text-opacity-80">Ver Detalhes</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                        <InfoItem label="Data" value={new Date(selectedSale.createdAt).toLocaleString()} />
                        <InfoItem label="Valor Total" value={<span className="font-bold text-accent-blue-neon text-lg">{formatCurrency(selectedSale.totalAmountInCents)}</span>} />
                        <InfoItem label="Método de Pagamento" value={getPaymentMethodLabel(selectedSale.paymentMethod as PaymentMethod)} />
                        <InfoItem label="Status" value={<span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(selectedSale.status)}`}>{(selectedSale.status as string).replace(/_/g, ' ').toUpperCase()}</span>} />
                        {selectedSale.paidAt && <InfoItem label="Pago em" value={new Date(selectedSale.paidAt).toLocaleString()} />}
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
                            <p className="font-semibold text-text-default">{item.name} {item.isOrderBump ? <span className="text-xs text-accent-blue-neon">(Order Bump)</span> : item.isUpsell ? <span className="text-xs text-accent-blue-neon">(Upsell)</span> : ''}</p>
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