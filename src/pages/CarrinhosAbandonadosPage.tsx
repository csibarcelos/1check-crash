
import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { AbandonedCart, AbandonedCartStatus } from '@/types';
import { abandonedCartService } from '@/services/abandonedCartService';
import { ArchiveBoxXMarkIcon, WhatsAppIcon, generateWhatsAppLink } from '../constants.tsx';
import { useData } from '@/contexts/DataContext';
import { Table, TableHeader } from '@/components/ui/Table'; 


const ITEMS_PER_PAGE = 10;

const labels: Record<AbandonedCartStatus, string> = {
  [AbandonedCartStatus.NOT_CONTACTED]: 'Não Contactado',
  [AbandonedCartStatus.RECOVERY_EMAIL_SENT]: 'Email Enviado',
  [AbandonedCartStatus.RECOVERED]: 'Recuperado',
  [AbandonedCartStatus.IGNORED]: 'Ignorado',
};

const getStatusLabel = (status: AbandonedCartStatus) => {
  return labels[status] || status;
};

const getStatusClass = (status: AbandonedCartStatus) => {
  switch (status) {
    case AbandonedCartStatus.RECOVERED: return 'bg-green-600/20 text-green-400';
    case AbandonedCartStatus.RECOVERY_EMAIL_SENT: return 'bg-blue-600/20 text-blue-400';
    case AbandonedCartStatus.NOT_CONTACTED: return 'bg-yellow-500/20 text-yellow-400';
    case AbandonedCartStatus.IGNORED: return 'bg-neutral-700 text-neutral-400';
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


const CarrinhosAbandonadosPage: React.FC = () => {
  const { abandonedCarts: allCarts, isLoading, error: dataError } = useData();
  const [localError, setLocalError] = useState<string|null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<AbandonedCartStatus | ''>( '');

  const [currentPage, setCurrentPage] = useState(1);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const filteredCarts = useMemo(() => {
    let currentCarts = [...allCarts];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      currentCarts = currentCarts.filter(cart =>
        cart.customerName?.toLowerCase().includes(term) ||
        cart.customerEmail?.toLowerCase().includes(term) ||
        cart.productName?.toLowerCase().includes(term) ||
        cart.id?.toLowerCase().includes(term)
      );
    }
    if (filterStatus) {
      currentCarts = currentCarts.filter(cart => cart.status === filterStatus);
    }
    return currentCarts;
  }, [searchTerm, filterStatus, allCarts]);

  const totalPages = Math.ceil(filteredCarts.length / ITEMS_PER_PAGE);
  const paginatedCarts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCarts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCarts, currentPage]);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, filterStatus]);


  const handleOpenDetailsModal = (cart: AbandonedCart) => {
    setSelectedCart(cart);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedCart(null);
    setIsDetailsModalOpen(false);
  };

  const handleUpdateStatus = async (cartId: string, newStatus: AbandonedCartStatus) => {
    setIsUpdatingStatus(true);
    try {
      await abandonedCartService.updateAbandonedCartStatus(cartId, newStatus);
      // No need to update local state, DataContext realtime will handle it.
      if (selectedCart && selectedCart.id === cartId) {
        setSelectedCart(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      setLocalError(err.message || "Falha ao atualizar status do carrinho.");
      console.error(err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const selectClasses = "block w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-150 ease-in-out bg-bg-surface bg-opacity-60 backdrop-blur-sm border-border-subtle focus:border-accent-blue-neon focus:ring-1 focus:ring-accent-blue-neon text-text-strong placeholder-text-muted";

  const abandonedCartsTableHeaders: TableHeader<AbandonedCart>[] = [
    {
      key: 'customer',
      label: 'Cliente',
      renderCell: (cart) => (
        <>
          <div className="text-sm text-text-strong">{cart.customerName || 'Cliente'}</div>
          <div className="text-xs text-text-muted">{cart.customerEmail}</div>
          {cart.customerWhatsapp && (
            <a
              href={generateWhatsAppLink(cart.customerWhatsapp, `Olá ${cart.customerName || 'Cliente'}, vi que você demonstrou interesse em nosso produto "${cart.productName}" e não finalizou a compra. Gostaria de ajuda?`)}
              target="_blank"
              rel="noopener noreferrer"
              title="Contactar via WhatsApp"
              className="mt-1 inline-flex items-center text-xs text-status-success hover:opacity-80"
              onClick={(e) => e.stopPropagation()}
            >
              <WhatsAppIcon className="h-4 w-4 mr-1" /> {cart.customerWhatsapp}
            </a>
          )}
        </>
      ),
    },
    { key: 'productName', label: 'Produto' },
    { key: 'potentialValueInCents', label: 'Valor Potencial', renderCell: (cart) => <span className="text-primary">{formatCurrency(cart.potentialValueInCents)}</span> },
    {
      key: 'status',
      label: 'Status',
      renderCell: (cart) => (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(cart.status as AbandonedCartStatus)}`}>
          {getStatusLabel(cart.status as AbandonedCartStatus)}
        </span>
      ),
    },
    { key: 'lastInteractionAt', label: 'Última Interação', renderCell: (cart) => new Date(cart.lastInteractionAt).toLocaleString() },
    {
      key: 'actions',
      label: 'Ações',
      renderCell: (cart) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenDetailsModal(cart); }} className="text-text-default hover:text-primary">
          Detalhes
        </Button>
      ),
    },
  ];

  if (isLoading && allCarts.length === 0) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-neutral-100">Carrinhos Abandonados ({filteredCarts.length})</h1>
      </div>

      {(dataError || localError) && <p className="my-4 text-sm text-status-error p-3 bg-status-error/10 rounded-xl border border-status-error/30">{dataError || localError}</p>}

      <Card className="p-0 sm:p-0 border-neutral-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 border-b border-neutral-700">
          <Input
            placeholder="Buscar por cliente, produto, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div>
            <label htmlFor="statusFilterAbandoned" className="block text-sm font-medium text-text-default mb-1.5">Status</label>
            <select
              id="statusFilterAbandoned"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as AbandonedCartStatus | '')}
              className={`${selectClasses} mt-0`}
            >
              <option value="">Todos Status</option>
              {Object.values(AbandonedCartStatus).map((status: AbandonedCartStatus) => (
                <option key={status} value={status}>{getStatusLabel(status as AbandonedCartStatus)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end col-span-1 md:col-span-2 lg:col-span-1 lg:col-start-4">
            <Button variant="outline" onClick={() => {setSearchTerm(''); setFilterStatus('');}} className="w-full">Limpar Filtros</Button>
          </div>
        </div>
        
        <Table<AbandonedCart>
            headers={abandonedCartsTableHeaders}
            data={paginatedCarts}
            rowKey="id"
            isLoading={isLoading}
            onRowClick={handleOpenDetailsModal}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={ITEMS_PER_PAGE}
            totalItems={filteredCarts.length}
            emptyStateMessage={
                <div className="text-center py-12">
                    <ArchiveBoxXMarkIcon className="h-16 w-16 text-neutral-500 mx-auto mb-4" />
                    <p className="text-lg text-neutral-400">
                    {allCarts.length === 0 ? "Nenhum carrinho abandonado registrado." : "Nenhum carrinho encontrado com os filtros atuais."}
                    </p>
                </div>
            }
        />
      </Card>

      {selectedCart && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={handleCloseDetailsModal}
          title={`Detalhes do Carrinho: ${selectedCart.id.substring(0,8)}...`}
          size="lg"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-sm">
            <section>
              <h3 className="text-md font-semibold text-neutral-100 border-b border-neutral-600 pb-1 mb-2">Informações do Cliente</h3>
              <InfoItem label="Nome" value={selectedCart.customerName || 'N/A'} />
              <InfoItem label="Email" value={selectedCart.customerEmail} />
              <InfoItem
                label="WhatsApp"
                value={selectedCart.customerWhatsapp || 'N/A'}
                isWhatsApp={!!selectedCart.customerWhatsapp}
                whatsAppUrl={selectedCart.customerWhatsapp ? generateWhatsAppLink(selectedCart.customerWhatsapp, `Olá ${selectedCart.customerName || 'Cliente'}, sobre seu carrinho...`) : undefined}
              />
            </section>
            <section>
              <h3 className="text-md font-semibold text-neutral-100 border-b border-neutral-600 pb-1 mb-2">Detalhes do Carrinho</h3>
              <InfoItem label="Produto" value={selectedCart.productName} />
              <InfoItem label="Valor Potencial" value={<span className="font-bold text-primary">{formatCurrency(selectedCart.potentialValueInCents)}</span>} />
              <InfoItem label="Status Atual" value={<span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusClass(selectedCart.status as AbandonedCartStatus)}`}>{getStatusLabel(selectedCart.status as AbandonedCartStatus)}</span>} />
              <InfoItem label="Criado em" value={new Date(selectedCart.date).toLocaleString()} />
              <InfoItem label="Última Interação" value={new Date(selectedCart.lastInteractionAt).toLocaleString()} />
            </section>
             {selectedCart.trackingParameters && Object.keys(selectedCart.trackingParameters).length > 0 && (
                <section>
                    <h3 className="text-md font-semibold text-neutral-100 border-b border-neutral-600 pb-1 mb-2">Parâmetros de Rastreamento (UTMs)</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                        {Object.entries(selectedCart.trackingParameters).map(([key, value]) => (
                            <InfoItem key={key} label={key} value={value as string} />
                        ))}
                    </div>
                </section>
             )}
            <section>
              <h3 className="text-md font-semibold text-neutral-100 border-b border-neutral-600 pb-1 mb-2">Atualizar Status</h3>
              <div className="flex flex-wrap gap-2">
                {(Object.values(AbandonedCartStatus) as AbandonedCartStatus[]).map(statusValue => (
                  <Button
                    key={statusValue}
                    variant={selectedCart.status === statusValue ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedCart.id, statusValue as AbandonedCartStatus)}
                    isLoading={isUpdatingStatus && selectedCart.status !== statusValue}
                    disabled={isUpdatingStatus || selectedCart.status === statusValue}
                    className={selectedCart.status === statusValue ? 'ring-2 ring-offset-1 ring-primary ring-offset-neutral-800' : ''}
                  >
                    {getStatusLabel(statusValue as AbandonedCartStatus)}
                  </Button>
                ))}
              </div>
              {(dataError || localError) && isUpdatingStatus && <p className="text-xs text-status-error mt-2">{dataError || localError}</p>}
            </section>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={handleCloseDetailsModal} disabled={isUpdatingStatus}>Fechar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CarrinhosAbandonadosPage;
