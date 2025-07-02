
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
  DocumentDuplicateIcon,
  ClipboardDocumentIcon,
} from '../constants.tsx';
import { useData } from '@/contexts/DataContext';
import { Table, TableHeader } from '@/components/ui/Table';
import { useToast } from '@/contexts/ToastContext';

const ITEMS_PER_PAGE = 10;

// --- Funções de formatação e utilitários ---

const getStatusClass = (status: PaymentStatus) => {
  switch (status) {
    case PaymentStatus.PAID: return 'bg-status-success/20 text-status-success';
    case PaymentStatus.WAITING_PAYMENT: return 'bg-status-warning/20 text-status-warning';
    default: return 'bg-status-error/20 text-status-error';
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

const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// --- Novas Funções de Mensagem do WhatsApp ---

const generatePixReminderMessage = (sale: Sale): string => {
    const customerName = sale.customer.name?.split(' ')[0] || 'cliente';
    const productName = sale.products[0]?.name || 'seu produto';
    const message = `
Olá, *${customerName}*! 👋

Vi que você gerou um PIX para o produto *${productName}*, mas o pagamento ainda não foi confirmado.

Para facilitar, segue abaixo seu código PIX:
    `;
    return message.trim();
};

const generateThankYouMessage = (sale: Sale): string => {
    const customerName = sale.customer.name?.split(' ')[0] || 'cliente';
    const deliveryLinks = sale.products.filter(p => p.deliveryUrl).map(p => `  - *${p.name}*: ${p.deliveryUrl}`).join('\n');

    const deliverySection = deliveryLinks ? `
You já pode acessar seu produto através do(s) link(s) abaixo:
${deliveryLinks}
` : `Em breve você receberá mais informações sobre a entrega.`;

    const message = `
🎉 Olá, *${customerName}*! Seu pagamento foi aprovado com sucesso!

Obrigado por comprar conosco. Estamos muito felizes em ter você como cliente.

*Detalhes do seu pedido:*
  - *Produto(s):* ${sale.products.map(p => p.name).join(', ')}
  - *Valor:* ${formatCurrency(sale.totalAmountInCents)}

${deliverySection}

Qualquer dúvida, é só chamar!
    `;
    return message.trim();
};

// --- Componentes Auxiliares ---

const InfoItem: React.FC<{ label: string; value: React.ReactNode; className?: string; }> = ({ label, value, className }) => (
  <div className={`mb-2 ${className}`}>
    <span className="font-semibold text-text-muted">{label}: </span>
    <span className="text-text-default">{value}</span>
  </div>
);

// --- Componente Principal da Página ---

const VendasPage: React.FC = () => {
  const { sales: allSales, isLoading, error } = useData();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | ''>('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<PaymentMethod | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const filteredSales = useMemo(() => {
    return allSales.filter(sale => {
        const term = searchTerm.toLowerCase();
        const matchesTerm = !term || 
            sale.customer.name?.toLowerCase().includes(term) ||
            sale.customer.email?.toLowerCase().includes(term) ||
            sale.id?.toLowerCase().includes(term) ||
            (Array.isArray(sale.products) && sale.products.some(p => p.name?.toLowerCase().includes(term)));
        
        const matchesStatus = !filterStatus || sale.status === filterStatus;
        const matchesMethod = !filterPaymentMethod || sale.paymentMethod === filterPaymentMethod;

        return matchesTerm && matchesStatus && matchesMethod;
    });
  }, [searchTerm, filterStatus, filterPaymentMethod, allSales]);

  const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSales.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSales, currentPage]);

  React.useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterPaymentMethod]);

  const handleOpenDetailsModal = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedSale(null);
    setIsDetailsModalOpen(false);
  };

  const handleCopyPixCode = (pixCode: string) => {
    navigator.clipboard.writeText(pixCode);
    showToast({ title: "Copiado!", description: "Código PIX copiado para a área de transferência.", variant: "success" });
  };

  const selectClasses = "block w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-150 ease-in-out bg-bg-surface bg-opacity-60 backdrop-blur-sm border-border-subtle focus:border-accent-blue-neon focus:ring-1 focus:ring-accent-blue-neon text-text-strong placeholder-text-muted";

  const salesTableHeaders: TableHeader<Sale>[] = [
    {
      key: 'customer', label: 'Cliente',
      renderCell: (sale) => (
        <>
          <div className="text-sm font-medium text-text-strong">{sale.customer.name}</div>
          <div className="text-xs text-text-muted">{sale.customer.email}</div>
        </>
      ),
    },
    { key: 'totalAmountInCents', label: 'Valor', renderCell: (sale) => <span className="text-accent-blue-neon font-semibold">{formatCurrency(sale.totalAmountInCents)}</span> },
    {
      key: 'status', label: 'Status',
      renderCell: (sale) => <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(sale.status)}`}>{(sale.status as string).replace(/_/g, ' ').toUpperCase()}</span>,
    },
    { key: 'paymentMethod', label: 'Método', renderCell: (sale) => getPaymentMethodLabel(sale.paymentMethod as PaymentMethod) },
    { key: 'createdAt', label: 'Data', renderCell: (sale) => formatDateTime(sale.createdAt) },
    {
      key: 'actions', label: 'Ações',
      renderCell: (sale) => (
        <div className="flex items-center space-x-1 justify-end"> {/* Adicionado justify-end aqui */}
          {sale.customer.whatsapp && (
            <Button
              variant="ghost" size="sm"
              onClick={(e) => {
                e.stopPropagation();
                const message = sale.status === PaymentStatus.PAID ? generateThankYouMessage(sale) : generatePixReminderMessage(sale);
                window.open(generateWhatsAppLink(sale.customer.whatsapp, message), '_blank');
              }}
              className={sale.status === PaymentStatus.PAID ? "text-status-success hover:text-opacity-80" : "text-yellow-400 hover:text-opacity-80"}
              title={sale.status === PaymentStatus.PAID ? "Enviar agradecimento" : "Enviar lembrete de pagamento"}
            >
              <WhatsAppIcon className="h-5 w-5" />
            </Button>
          )}
          {sale.status === PaymentStatus.WAITING_PAYMENT && sale.paymentMethod === PaymentMethod.PIX && sale.pixQrCode && (
            <Button
              variant="ghost" size="sm"
              onClick={(e) => { e.stopPropagation(); handleCopyPixCode(sale.pixQrCode!); }}
              className="text-gray-400 hover:text-white"
              title="Copiar código PIX"
            >
              <ClipboardDocumentIcon className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenDetailsModal(sale); }} className="text-accent-blue-neon hover:text-opacity-80">
            Ver Detalhes
          </Button>
        </div>
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
            <Input placeholder="Buscar por cliente, email, ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="md:col-span-2 lg:col-span-1" />
            <div>
                <label htmlFor="statusFilter" className="block text-sm font-medium text-text-default mb-1.5">Status</label>
                <select id="statusFilter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as PaymentStatus | '')} className={selectClasses}>
                    <option value="">Todos Status</option>
                    {Object.values(PaymentStatus).map((status) => <option key={status} value={status}>{(status as string).replace(/_/g, ' ').toUpperCase()}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="paymentMethodFilter" className="block text-sm font-medium text-text-default mb-1.5">Método</label>
                <select id="paymentMethodFilter" value={filterPaymentMethod} onChange={(e) => setFilterPaymentMethod(e.target.value as PaymentMethod | '')} className={selectClasses}>
                    <option value="">Todos Métodos</option>
                    {Object.values(PaymentMethod).map((method) => <option key={method} value={method}>{getPaymentMethodLabel(method)}</option>)}
                </select>
            </div>
            <div className="flex items-end">
                <Button variant="outline" onClick={() => {setSearchTerm(''); setFilterStatus(''); setFilterPaymentMethod('');}} className="w-full">Limpar Filtros</Button>
            </div>
        </div>

        <Table<Sale> headers={salesTableHeaders} data={paginatedSales} rowKey="id" isLoading={isLoading} onRowClick={handleOpenDetailsModal} currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={ITEMS_PER_PAGE} totalItems={filteredSales.length}
            emptyStateMessage={
                 <div className="text-center py-16">
                    <ShoppingCartIcon className="h-20 w-20 text-text-muted/50 mx-auto mb-6" />
                    <p className="text-xl text-text-muted">{allSales.length === 0 ? "Nenhuma venda registrada ainda." : "Nenhuma venda encontrada com os filtros atuais."}</p>
                </div>
            }
        />
      </Card>

      {selectedSale && (
        <Modal isOpen={isDetailsModalOpen} onClose={handleCloseDetailsModal} title={`Detalhes da Venda #${selectedSale.id.substring(0, 8)}`} size="xl">
            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-3 text-sm"> 
                <section>
                    <h3 className="text-lg font-semibold text-accent-gold border-b border-border-subtle pb-2 mb-3">Informações Gerais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                        <InfoItem label="ID da Venda" value={selectedSale.id} />
                        <InfoItem label="Data" value={formatDateTime(selectedSale.createdAt)} />
                        <InfoItem label="Valor Total" value={<span className="font-bold text-accent-blue-neon text-lg">{formatCurrency(selectedSale.totalAmountInCents)}</span>} />
                        <InfoItem label="Método" value={getPaymentMethodLabel(selectedSale.paymentMethod)} />
                        <InfoItem label="Status" value={<span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(selectedSale.status)}`}>{(selectedSale.status).replace(/_/g, ' ').toUpperCase()}</span>} />
                        {selectedSale.paidAt && <InfoItem label="Pago em" value={formatDateTime(selectedSale.paidAt)} />}
                    </div>
                </section>

                {selectedSale.paymentMethod === PaymentMethod.PIX && selectedSale.status === PaymentStatus.WAITING_PAYMENT && selectedSale.pixQrCodeBase64 && (
                    <section>
                        <h3 className="text-lg font-semibold text-accent-gold border-b border-border-subtle pb-2 mb-3">Detalhes do PIX</h3>
                        <div className="space-y-3">
                            <div className="flex justify-center">
                                <img src={`data:image/png;base64,${selectedSale.pixQrCodeBase64}`} alt="PIX QR Code" className="w-48 h-48 object-contain border border-border-subtle rounded-lg" />
                            </div>
                            <div className="relative">
                                <Input label="Código PIX Copia e Cola" value={selectedSale.pixQrCode || ''} readOnly />
                                <Button
                                    onClick={() => handleCopyPixCode(selectedSale.pixQrCode!)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2"
                                    variant="ghost" size="sm" title="Copiar código PIX"
                                >
                                    <DocumentDuplicateIcon className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </section>
                )}

                <section>
                    <h3 className="text-lg font-semibold text-accent-gold border-b border-border-subtle pb-2 mb-3">Informações do Cliente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                         <InfoItem label="Nome" value={selectedSale.customer.name} />
                         <InfoItem label="Email" value={selectedSale.customer.email} />
                         <InfoItem label="WhatsApp" value={selectedSale.customer.whatsapp} />
                         {selectedSale.customer.ip && <InfoItem label="IP" value={selectedSale.customer.ip} />}
                    </div>
                </section>

                {selectedSale.trackingParameters && Object.keys(selectedSale.trackingParameters).length > 0 && (
                    <section>
                        <h3 className="text-lg font-semibold text-accent-gold border-b border-border-subtle pb-2 mb-3">Parâmetros de Rastreamento (UTMs)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                            {Object.entries(selectedSale.trackingParameters).map(([key, value]) => (
                                <InfoItem key={`param-${key}`} label={key} value={String(value)} />
                            ))}
                        </div>
                    </section>
                )}

                <section>
                    <h3 className="text-lg font-semibold text-accent-gold border-b border-border-subtle pb-2 mb-3">Produtos Adquiridos</h3>
                    {Array.isArray(selectedSale.products) && selectedSale.products.map((item: SaleProductItem, idx: number) => (
                        <div key={idx} className="mb-1 p-2 bg-neutral-700/30 rounded-sm text-sm border border-border-subtle">
                            <p className="font-medium text-text-default">{String(item.name)} {item.isTraditionalOrderBump ? '(Order Bump)' : item.isUpsell ? '(Upsell)' : ''}</p>
                            <div className="grid grid-cols-2 gap-x-4 text-xs text-text-muted">
                                <span>Quantidade: {Number(item.quantity)}</span>
                                <span>Subtotal: {formatCurrency(Number(item.priceInCents) * Number(item.quantity))}</span>
                            </div>
                        </div>
                    ))}
                </section>

                {selectedSale.status === PaymentStatus.PAID && selectedSale.products.some(p => p.deliveryUrl) && (
                    <section>
                        <h3 className="text-lg font-semibold text-accent-gold border-b border-border-subtle pb-2 mb-3">Acessar Produtos</h3>
                        <div className="space-y-2">
                            {selectedSale.products.filter(p => p.deliveryUrl).map((item, idx) => (
                                <a key={`${item.productId}-${idx}-link`} href={item.deliveryUrl!} target="_blank" rel="noopener noreferrer" className="block w-full text-center px-4 py-2.5 rounded-lg transition-colors duration-200 ease-in-out font-medium group border border-blue-500 text-blue-500 hover:bg-blue-50">
                                    Acessar: {item.name}
                                </a>
                            ))}
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
