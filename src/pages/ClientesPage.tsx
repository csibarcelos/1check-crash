
import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Customer, FunnelStage } from '../types';
import { UserGroupIcon, WhatsAppIcon, generateWhatsAppLink } from '../constants.tsx';
import { useData } from '@/contexts/DataContext';
import { Table, TableHeader } from '@/components/ui/Table'; 

const ITEMS_PER_PAGE = 10;

const getFunnelStageLabel = (stage: FunnelStage) => {
  const labels: Record<FunnelStage, string> = {
    [FunnelStage.LEAD]: 'Lead',
    [FunnelStage.PROSPECT]: 'Prospect',
    [FunnelStage.CUSTOMER]: 'Cliente',
  };
  return labels[stage] || stage;
};

const getFunnelStageClass = (stage: FunnelStage) => {
  switch (stage) {
    case FunnelStage.CUSTOMER: return 'bg-green-600/20 text-green-400';
    case FunnelStage.PROSPECT: return 'bg-blue-600/20 text-blue-400';
    case FunnelStage.LEAD: return 'bg-yellow-500/20 text-yellow-400';
    default: return 'bg-neutral-700 text-neutral-300';
  }
};

const formatCurrency = (valueInCents: number) => {
    return `R$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

const InfoItem: React.FC<{ label: string; value: React.ReactNode; className?: string; isWhatsApp?: boolean; whatsAppUrl?: string }> = ({ label, value, className, isWhatsApp, whatsAppUrl }) => (
  <div className={`mb-2 ${className}`}>
    <span className="font-semibold text-neutral-400">{label}: </span>
    <span className="text-neutral-200">{value}</span>
    {isWhatsApp && whatsAppUrl && (
      <a
        href={whatsAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Enviar mensagem via WhatsApp"
        className="ml-2 inline-flex items-center text-green-400 hover:text-green-300"
        onClick={(e) => { if (!whatsAppUrl) e.preventDefault();}}
      >
        <WhatsAppIcon className="h-5 w-5" />
      </a>
    )}
  </div>
);


const ClientesPage: React.FC = () => {
  const { customers: allCustomers, products: allProducts, isLoading, error } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterFunnelStage, setFilterFunnelStage] = useState<FunnelStage | ''>( '');
  const [currentPage, setCurrentPage] = useState(1);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = useMemo(() => {
    let currentCustomers = [...allCustomers];
    if (searchTerm) {
      currentCustomers = currentCustomers.filter(customer =>
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.whatsapp?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterFunnelStage) {
      currentCustomers = currentCustomers.filter(customer => customer.funnelStage === filterFunnelStage);
    }
    return currentCustomers;
  }, [searchTerm, filterFunnelStage, allCustomers]);

  React.useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, filterFunnelStage]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCustomers, currentPage]);

  const handleOpenDetailsModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedCustomer(null);
    setIsDetailsModalOpen(false);
  };

  const selectClasses = "block w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-150 ease-in-out bg-bg-surface bg-opacity-60 backdrop-blur-sm border-border-subtle focus:border-accent-blue-neon focus:ring-1 focus:ring-accent-blue-neon text-text-strong placeholder-text-muted";

  const customerTableHeaders: TableHeader<Customer>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'Email' },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      renderCell: (customer) => (
        customer.whatsapp ? (
          <a
            href={generateWhatsAppLink(customer.whatsapp, `Olá ${customer.name}, ...`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-status-success hover:opacity-80"
            onClick={(e) => e.stopPropagation()} // Prevent row click if clicking link
          >
            <WhatsAppIcon className="h-4 w-4 mr-1" /> {customer.whatsapp}
          </a>
        ) : 'N/A'
      ),
    },
    { key: 'totalSpentInCents', label: 'Total Gasto', renderCell: (customer) => <span className="text-primary">{formatCurrency(customer.totalSpentInCents)}</span> },
    {
      key: 'funnelStage',
      label: 'Funil',
      renderCell: (customer) => (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getFunnelStageClass(customer.funnelStage as FunnelStage)}`}>
          {getFunnelStageLabel(customer.funnelStage as FunnelStage)}
        </span>
      ),
    },
    { key: 'lastPurchaseDate', label: 'Última Compra', renderCell: (customer) => customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString() : 'N/A' },
    {
      key: 'actions',
      label: 'Ações',
      renderCell: (customer) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenDetailsModal(customer); }} className="text-text-default hover:text-primary">
          Detalhes
        </Button>
      ),
    },
  ];

  if (isLoading && allCustomers.length === 0) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-neutral-100">Meus Clientes ({filteredCustomers.length})</h1>
      </div>

      {error && <p className="my-4 text-sm text-status-error p-3 bg-status-error/10 rounded-xl border border-status-error/30">{error}</p>}
      
      <Card className="p-0 sm:p-0 border-neutral-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 border-b border-neutral-700">
          <Input
            placeholder="Buscar por nome, email, ID, WhatsApp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:col-span-2 lg:col-span-2"
          />
          <div>
            <label htmlFor="funnelStageFilter" className="block text-sm font-medium text-text-default mb-1.5">Funil</label>
            <select
              id="funnelStageFilter"
              value={filterFunnelStage}
              onChange={(e) => setFilterFunnelStage(e.target.value as FunnelStage | '')}
              className={`${selectClasses} mt-0`}
            >
              <option value="">Todos Estágios</option>
              {Object.values(FunnelStage).map((stage) => (
                <option key={stage} value={stage}>{getFunnelStageLabel(stage)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end col-span-1 md:col-span-2 lg:col-span-1 lg:col-start-4">
            <Button variant="outline" onClick={() => {setSearchTerm(''); setFilterFunnelStage('');}} className="w-full">Limpar Filtros</Button>
          </div>
        </div>
        
        <Table<Customer>
            headers={customerTableHeaders}
            data={paginatedCustomers}
            rowKey="id"
            isLoading={isLoading}
            onRowClick={handleOpenDetailsModal}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={ITEMS_PER_PAGE}
            totalItems={filteredCustomers.length}
            emptyStateMessage={
                <div className="text-center py-12">
                    <UserGroupIcon className="h-16 w-16 text-neutral-500 mx-auto mb-4" />
                    <p className="text-lg text-neutral-400">
                    {allCustomers.length === 0 ? "Nenhum cliente registrado." : "Nenhum cliente encontrado com os filtros atuais."}
                    </p>
                </div>
            }
        />
      </Card>

      {selectedCustomer && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={handleCloseDetailsModal}
          title={`Detalhes do Cliente: ${selectedCustomer.name}`}
          size="lg"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-sm">
            <section>
              <h3 className="text-md font-semibold text-neutral-100 border-b border-neutral-600 pb-1 mb-2">Informações de Contato</h3>
              <InfoItem label="ID" value={selectedCustomer.id.substring(0,15) + '...'} />
              <InfoItem label="Nome" value={selectedCustomer.name} />
              <InfoItem label="Email" value={selectedCustomer.email} />
              <InfoItem
                label="WhatsApp"
                value={selectedCustomer.whatsapp || 'N/A'}
                isWhatsApp={!!selectedCustomer.whatsapp}
                whatsAppUrl={selectedCustomer.whatsapp ? generateWhatsAppLink(selectedCustomer.whatsapp, `Olá ${selectedCustomer.name}, ...`) : undefined}
              />
            </section>
            <section>
              <h3 className="text-md font-semibold text-neutral-100 border-b border-neutral-600 pb-1 mb-2">Histórico de Compras</h3>
              <InfoItem label="Total Gasto" value={<span className="font-bold text-primary">{formatCurrency(selectedCustomer.totalSpentInCents)}</span>} />
              <InfoItem label="Total de Pedidos" value={selectedCustomer.totalOrders} />
              <InfoItem label="Primeira Compra" value={selectedCustomer.firstPurchaseDate ? new Date(selectedCustomer.firstPurchaseDate).toLocaleDateString() : 'N/A'} />
              <InfoItem label="Última Compra" value={selectedCustomer.lastPurchaseDate ? new Date(selectedCustomer.lastPurchaseDate).toLocaleDateString() : 'N/A'} />
              <InfoItem label="Estágio no Funil" value={<span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${getFunnelStageClass(selectedCustomer.funnelStage as FunnelStage)}`}>{getFunnelStageLabel(selectedCustomer.funnelStage as FunnelStage)}</span>} />
            </section>
            <section>
                <h3 className="text-md font-semibold text-neutral-100 border-b border-neutral-600 pb-1 mb-2">Produtos Comprados ({selectedCustomer.productsPurchased?.length || 0})</h3>
                {selectedCustomer.productsPurchased && selectedCustomer.productsPurchased.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 pl-1">
                        {selectedCustomer.productsPurchased.map(productId => {
                            const productDetails = allProducts.find(p => p.id === productId);
                            return <li key={productId} className="text-neutral-300">{productDetails?.name || `ID: ${productId.substring(0,10)}...`}</li>;
                        })}
                    </ul>
                ) : <p className="text-neutral-400">Nenhum produto comprado registrado.</p>}
            </section>
             <section>
                <h3 className="text-md font-semibold text-neutral-100 border-b border-neutral-600 pb-1 mb-2">IDs das Vendas ({selectedCustomer.saleIds?.length || 0})</h3>
                {selectedCustomer.saleIds && selectedCustomer.saleIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedCustomer.saleIds
                      .filter((idInput): idInput is string => typeof idInput === 'string') // Ensure elements are strings
                      .map((currentSaleId: string, index: number) => {
                        const displayString = currentSaleId.substring(0, 12) + (currentSaleId.length > 12 ? '...' : '');
                        const itemKey = `${currentSaleId}-${index}`; // This line was 210
                        return (<span key={itemKey} className="px-2 py-0.5 bg-neutral-700 text-xs text-neutral-300 rounded-full">{displayString}</span>);
                      })}
                  </div>
                ) : <p className="text-neutral-400">Nenhum ID de venda associado.</p>}
            </section>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={handleCloseDetailsModal}>Fechar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ClientesPage;
