
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from "react-router-dom";
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Product } from '@/types';
import { productService } from '@/services/productService';
import { utmifyService } from '@/services/utmifyService';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { Table, TableHeader } from '@/components/ui/Table'; 
import { 
  CubeIcon, PlusIcon, CheckIcon, PencilIcon, 
  LinkIcon as LinkActionIcon, 
  Square2StackIconHero, 
  TrashIcon as TrashActionIcon, 
  EllipsisVerticalIcon, 
  ExternalLinkIconHero, 
  cn 
} from '../constants.tsx';
import { useAuth } from '@/contexts/AuthContext';

const ITEMS_PER_PAGE = 10;

const ProductsPage: React.FC = () => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isCloning, setIsCloning] = useState<string | null>(null);
  const [copiedLinkForProductId, setCopiedLinkForProductId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const fetchProducts = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      setAllProducts([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await productService.getProducts(accessToken);
      setAllProducts(data.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)));
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar produtos. Tente novamente.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setProductToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete || !accessToken) return;
    setIsLoading(true);
    try {
      await productService.deleteProduct(productToDelete.id, accessToken);
      setAllProducts(prev => prev.filter(p => p.id !== productToDelete.id));
      setCurrentPage(1); 
      closeDeleteModal();
    } catch (err: any) {
      setError(`Falha ao deletar produto ${productToDelete.name}.`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloneProduct = async (productId: string) => {
    setIsCloning(productId);
    setError(null);
    try {
      const clonedProduct = await productService.cloneProduct(productId, accessToken);
      if (clonedProduct) {
        fetchProducts(); 
      } else {
        setError('Falha ao clonar produto. Nenhum produto retornado.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao clonar produto.');
      console.error(err);
    } finally {
      setIsCloning(null);
    }
  };

  const handleCopyLink = (product: Product) => {
    if (!product || !product.slug) {
      alert('Slug do produto não encontrado para copiar o link.');
      return;
    }
    const checkoutUrl = `${window.location.origin}/checkout/${product.slug}`;
    const utmifiedUrl = utmifyService.buildUtmifiedUrl(product, checkoutUrl);

    navigator.clipboard.writeText(utmifiedUrl)
      .then(() => {
        setCopiedLinkForProductId(product.id);
        setTimeout(() => setCopiedLinkForProductId(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
        alert('Falha ao copiar o link.');
      });
  };
  
  const handleViewCheckoutInNewTab = (product: Product) => {
    if (product.slug) {
      window.open(`${window.location.origin}/checkout/${product.slug}`, '_blank');
    }
  };

  const handleRowClick = (product: Product) => {
    navigate(`/produtos/editar/${product.id}`);
  };

  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return allProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allProducts, currentPage]);

  const productTableHeaders: TableHeader<Product>[] = [
    {
      key: 'name',
      label: 'Nome',
      renderCell: (product) => (
        <>
          <div className="text-sm font-medium text-text-strong">{product.name}</div>
          <div className="text-xs text-text-muted truncate max-w-xs">{product.description}</div>
        </>
      ),
    },
    {
      key: 'priceInCents',
      label: 'Preço',
      renderCell: (product) => `R$ ${(product.priceInCents / 100).toFixed(2).replace('.', ',')}`,
    },
    { key: 'totalSales', label: 'Vendas', renderCell: (product) => product.totalSales || 0 },
    {
      key: 'conversionRate',
      label: 'Conversão',
      renderCell: (product) => (product.conversionRate !== undefined ? `${product.conversionRate.toFixed(1)}%` : 'N/A'),
    },
    {
      key: 'actions',
      label: 'Ações',
      className: 'text-right',
      renderCell: (product) => (
        <div className="flex items-center justify-end space-x-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="p-1.5 text-text-muted hover:text-accent-blue-neon"
            onClick={(e) => { e.stopPropagation(); navigate(`/produtos/editar/${product.id}`); }}
            aria-label={`Editar ${product.name}`}
            title="Editar Produto"
          >
            <PencilIcon className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="p-1.5 text-text-muted hover:text-accent-blue-neon"
            onClick={(e) => { e.stopPropagation(); handleCopyLink(product); }}
            disabled={!product.slug}
            aria-label={`Copiar link de ${product.name}`}
            title="Copiar Link do Checkout"
          >
            {copiedLinkForProductId === product.id ? <CheckIcon className="h-5 w-5 text-status-success" /> : <LinkActionIcon className="h-5 w-5" />}
          </Button>

          <DropdownMenuPrimitive.Root>
            <DropdownMenuPrimitive.Trigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-1.5 text-text-muted hover:text-accent-blue-neon data-[state=open]:bg-neutral-700"
                onClick={(e) => e.stopPropagation()} 
                aria-label={`Mais ações para ${product.name}`}
                title="Mais Ações"
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </Button>
            </DropdownMenuPrimitive.Trigger>
            <DropdownMenuPrimitive.Portal>
              <DropdownMenuPrimitive.Content
                sideOffset={5}
                align="end"
                className={cn(
                  "z-50 min-w-[190px] origin-top-right overflow-hidden rounded-xl border border-border-subtle bg-bg-surface bg-opacity-80 backdrop-blur-lg p-1.5 shadow-2xl",
                  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                  "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
                )}
                onClick={(e) => e.stopPropagation()} 
              >
                <DropdownMenuPrimitive.Item
                  onSelect={(e) => { e.stopPropagation(); handleViewCheckoutInNewTab(product); }}
                  disabled={!product.slug}
                  className={cn(
                    "group relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm text-text-default outline-none transition-colors",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-white/10 data-[highlighted]:text-accent-blue-neon"
                  )}
                >
                  <ExternalLinkIconHero className="mr-2.5 h-5 w-5 text-text-muted group-data-[highlighted]:text-accent-blue-neon" />
                  Visualizar Checkout
                </DropdownMenuPrimitive.Item>
                <DropdownMenuPrimitive.Item
                  onSelect={(e) => { e.stopPropagation(); handleCloneProduct(product.id); }}
                  disabled={isCloning === product.id}
                  className={cn(
                    "group relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm text-text-default outline-none transition-colors",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-white/10 data-[highlighted]:text-accent-blue-neon"
                  )}
                >
                  {isCloning === product.id ? <LoadingSpinner size="sm" className="mr-2.5 h-5 w-5"/> : <Square2StackIconHero className="mr-2.5 h-5 w-5 text-text-muted group-data-[highlighted]:text-accent-blue-neon" />}
                  Duplicar Produto
                </DropdownMenuPrimitive.Item>
                <DropdownMenuPrimitive.Separator className="h-px bg-border-subtle my-1" />
                <DropdownMenuPrimitive.Item
                  onSelect={(e) => { e.stopPropagation(); openDeleteModal(product); }}
                  className={cn(
                    "group relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm text-status-error outline-none transition-colors",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-status-error/10 data-[highlighted]:text-status-error"
                  )}
                >
                  <TrashActionIcon className="mr-2.5 h-5 w-5 text-status-error/80 group-data-[highlighted]:text-status-error" />
                  Excluir
                </DropdownMenuPrimitive.Item>
              </DropdownMenuPrimitive.Content>
            </DropdownMenuPrimitive.Portal>
          </DropdownMenuPrimitive.Root>
        </div>
      ),
    },
  ];
  
  if (isLoading && allProducts.length === 0) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-display font-bold text-text-strong">Meus Produtos</h1>
        <Button to="/produtos/novo" variant="primary" leftIcon={<PlusIcon className="h-5 w-5"/>}>
          Criar Produto
        </Button>
      </div>

      {error && <div className="text-center text-status-error p-4 bg-status-error/10 rounded-xl border border-status-error/30">{error}</div>}
      
      <Card className="p-0 sm:p-0">
        <Table<Product>
            headers={productTableHeaders}
            data={paginatedProducts}
            rowKey="id"
            isLoading={isLoading}
            onRowClick={handleRowClick} 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={ITEMS_PER_PAGE}
            totalItems={allProducts.length}
            emptyStateMessage={
              <div className="text-center py-12">
                  <CubeIcon className="h-16 w-16 text-text-muted/70 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-text-strong mb-2">Nenhum produto encontrado</h3>
                  <p className="text-text-default mb-6">Crie seu primeiro produto para começar a vender.</p>
                  <Button to="/produtos/novo" variant="primary" leftIcon={<PlusIcon className="h-5 w-5"/>}>
                    Criar Primeiro Produto
                  </Button>
              </div>
            }
        />
      </Card>

      {productToDelete && (
        <AlertDialog
            isOpen={isDeleteModalOpen}
            onOpenChange={setIsDeleteModalOpen}
            onClose={closeDeleteModal}
            title="Confirmar Exclusão"
            description={<>Você tem certeza que deseja excluir o produto <span className="font-semibold text-text-strong">"{productToDelete?.name}"</span>? Esta ação não poderá ser desfeita.</>}
            onConfirm={handleDeleteProduct}
            confirmText="Excluir Produto"
            cancelText="Cancelar"
            confirmButtonVariant="danger"
        />
      )}
    </div>
  );
};

export default ProductsPage;
