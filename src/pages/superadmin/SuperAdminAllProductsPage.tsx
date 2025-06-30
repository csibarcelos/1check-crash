
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Product, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { ChartPieIcon } from '../../constants.tsx';
import { superAdminService } from '@/services/superAdminService';
import { Table, TableHeader } from '@/components/ui/Table'; // Import Table

const formatCurrency = (valueInCents: number): string => {
    return `R\$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

const InfoItem: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
  <div className={`mb-1 ${className}`}>
    <span className="font-semibold text-xs text-text-muted uppercase">{label}: </span>
    <span className="text-sm text-text-default">{value}</span>
  </div>
);

type ProductSortableKeys = 'name' | 'priceInCents' | 'totalSales';
type SortableKeys = ProductSortableKeys | 'ownerEmail';


interface SortConfig {
    key: SortableKeys | null;
    direction: 'ascending' | 'descending';
}

const SuperAdminAllProductsPage: React.FC = () => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });

  const getUserEmail = useCallback((userId: string): string => {
    const user = allUsers.find(u => u.id === userId);
    return user?.email || 'Desconhecido';
  }, [allUsers]);

  const fetchData = useCallback(async () => {
    if (!accessToken) {
      setError("Autenticação de super admin necessária.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [productsData, usersData] = await Promise.all([
          superAdminService.getAllPlatformProducts(accessToken),
          superAdminService.getAllPlatformUsers(accessToken)
      ]);
      setAllProducts(productsData);
      setAllUsers(usersData);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIndicator = (columnKey: SortableKeys) => {
    if (sortConfig.key === columnKey) {
      return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    }
    return '';
  };
  
  const sortedProducts = useMemo(() => {
    const sortableItems = [...allProducts];
    if (sortConfig.key) {
      const key = sortConfig.key;
      sortableItems.sort((a, b) => {
        let valA, valB;
        if (key === 'ownerEmail') {
          valA = getUserEmail(a.platformUserId).toLowerCase();
          valB = getUserEmail(b.platformUserId).toLowerCase();
        } else {
          valA = (a as any)[key];
          valB = (b as any)[key];
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortConfig.direction === 'ascending' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
        }
        if (valA == null && valB != null) return -1;
        if (valA != null && valB == null) return 1;
        if (valA == null && valB == null) return 0;
        return 0;
      });
    }
    return sortableItems;
  }, [allProducts, sortConfig, getUserEmail]);

  const handleOpenDetailsModal = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedProduct(null);
    setIsDetailsModalOpen(false);
  };

  const productTableHeaders: TableHeader<Product>[] = [
    { key: 'name', label: <button onClick={() => requestSort('name')} className="hover:text-text-strong">Nome{renderSortIndicator('name')}</button> },
    { key: 'ownerEmail', label: <button onClick={() => requestSort('ownerEmail')} className="hover:text-text-strong">Proprietário{renderSortIndicator('ownerEmail')}</button>, renderCell: (product) => getUserEmail(product.platformUserId) },
    { key: 'priceInCents', label: <button onClick={() => requestSort('priceInCents')} className="hover:text-text-strong">Preço{renderSortIndicator('priceInCents')}</button>, renderCell: (product) => formatCurrency(product.priceInCents) },
    { key: 'totalSales', label: <button onClick={() => requestSort('totalSales')} className="hover:text-text-strong">Vendas{renderSortIndicator('totalSales')}</button>, renderCell: (product) => product.totalSales || 0 },
    {
      key: 'slug',
      label: 'Checkout',
      renderCell: (product) => (
        product.slug ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); product.slug && navigate(`/checkout/${product.slug}`);}}
            className="text-accent-blue-neon hover:text-opacity-80"
          >
            Ver Checkout
          </Button>
        ) : (
          <span className="text-xs text-text-muted">Sem Slug</span>
        )
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      renderCell: (product) => (
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenDetailsModal(product); }} className="border-accent-blue-neon/50 text-accent-blue-neon hover:border-accent-blue-neon hover:bg-accent-blue-neon/10">
          Detalhes
        </Button>
      ),
    },
  ];

  if (isLoading && allProducts.length === 0) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /><p className="ml-2 text-text-muted">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <ChartPieIcon className="h-8 w-8 text-accent-blue-neon" />
        <h1 className="text-3xl font-display font-bold text-text-strong">Todos os Produtos ({allProducts.length})</h1>
      </div>

      {error && <p className="text-status-error bg-status-error/10 p-3 rounded-xl border border-status-error/30">{error}</p>}

      <Card className="p-0 sm:p-0">
        <Table<Product>
            headers={productTableHeaders}
            data={sortedProducts}
            rowKey="id"
            isLoading={isLoading}
            onRowClick={handleOpenDetailsModal}
            emptyStateMessage="Nenhum produto encontrado na plataforma."
        />
      </Card>

      {selectedProduct && (
        <Modal isOpen={isDetailsModalOpen} onClose={handleCloseDetailsModal} title={`Detalhes do Produto: ${selectedProduct.name}`} size="xl">
          <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-2">
            <InfoItem label="ID Produto" value={selectedProduct.id} />
            <InfoItem label="ID Proprietário" value={selectedProduct.platformUserId} />
            <InfoItem label="Email Proprietário" value={getUserEmail(selectedProduct.platformUserId)} />
            <InfoItem label="Nome" value={selectedProduct.name} />
            <InfoItem label="Descrição" value={
              <div className="text-xs max-h-24 overflow-y-auto bg-bg-main p-2 rounded border border-border-subtle text-text-default">
                {selectedProduct.description}
              </div>
            } />
            <InfoItem label="Preço" value={formatCurrency(selectedProduct.priceInCents)} />
            <InfoItem label="URL Imagem" value={selectedProduct.imageUrl || 'N/A'} />
            <InfoItem label="URL Entrega" value={selectedProduct.deliveryUrl || 'N/A'} />
            <InfoItem label="Vendas Totais" value={selectedProduct.totalSales ?? 0} />
            <InfoItem label="Cliques" value={selectedProduct.clicks ?? 0} />
            <InfoItem label="Visualizações Checkout" value={selectedProduct.checkoutViews ?? 0} />
            <InfoItem label="Taxa Conversão" value={`${(selectedProduct.conversionRate ?? 0).toFixed(2)}%`} />
            <InfoItem label="Taxa Abandono" value={`${(selectedProduct.abandonmentRate ?? 0).toFixed(2)}%`} />

            <h4 className="font-semibold text-text-default pt-2 border-t border-border-subtle mt-2">Customização do Checkout:</h4>
            <pre className="bg-bg-main p-2 rounded text-xs max-h-40 overflow-auto border border-border-subtle text-text-muted">
              {JSON.stringify(selectedProduct.checkoutCustomization, null, 2)}
            </pre>

            {selectedProduct.postClickOffer && (<>
              <h4 className="font-semibold text-text-default pt-2 border-t border-border-subtle mt-2">Oferta Pós-Clique (Antigo Order Bump):</h4>
              <pre className="bg-bg-main p-2 rounded text-xs max-h-40 overflow-auto border border-border-subtle text-text-muted">
                {JSON.stringify(selectedProduct.postClickOffer, null, 2)}
              </pre>
            </>)}
            {selectedProduct.orderBumps && selectedProduct.orderBumps.length > 0 && (<>
              <h4 className="font-semibold text-text-default pt-2 border-t border-border-subtle mt-2">Order Bumps Tradicionais:</h4>
              <pre className="bg-bg-main p-2 rounded text-xs max-h-40 overflow-auto border border-border-subtle text-text-muted">
                {JSON.stringify(selectedProduct.orderBumps, null, 2)}
              </pre>
            </>)}
            {selectedProduct.upsell && (<>
              <h4 className="font-semibold text-text-default pt-2 border-t border-border-subtle mt-2">Upsell:</h4>
              <pre className="bg-bg-main p-2 rounded text-xs max-h-40 overflow-auto border border-border-subtle text-text-muted">
                {JSON.stringify(selectedProduct.upsell, null, 2)}
              </pre>
            </>)}
            {selectedProduct.coupons && selectedProduct.coupons.length > 0 && (<>
              <h4 className="font-semibold text-text-default pt-2 border-t border-border-subtle mt-2">Cupons:</h4>
              <pre className="bg-bg-main p-2 rounded text-xs max-h-40 overflow-auto border border-border-subtle text-text-muted">
                {JSON.stringify(selectedProduct.coupons, null, 2)}
              </pre>
            </>)}
             {selectedProduct.utmParams && Object.keys(selectedProduct.utmParams).length > 0 && (<>
                <h4 className="font-semibold text-text-default pt-2 border-t border-border-subtle mt-2">Parâmetros UTM:</h4>
                 <pre className="bg-bg-main p-2 rounded text-xs max-h-40 overflow-auto border border-border-subtle text-text-muted">
                    {JSON.stringify(selectedProduct.utmParams, null, 2)}
                 </pre>
            </>)}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SuperAdminAllProductsPage;