
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useBlocker } from "react-router-dom";
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { ProductForm } from '@/components/shared/ProductForm';
import { Product } from '@/types';
import { productService } from '@/services/productService';
import { utmifyService } from '@/services/utmifyService';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  ArrowUturnLeftIconHero, ExternalLinkIconHero, LinkIcon as LinkActionIcon, Square2StackIconHero,
  TrashIcon as TrashActionIcon, ArrowDownTrayIcon, CheckIcon, EllipsisVerticalIcon, cn
} from '../constants.tsx'; 

const FORM_ID = "product-edit-form";

const ProductEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [initialProductData, setInitialProductData] = useState<Product | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [userProductsForOffers, setUserProductsForOffers] = useState<Product[]>([]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLeaveConfirmModalOpen, setIsLeaveConfirmModalOpen] = useState(false);
  const [shouldNavigateAfterSave, setShouldNavigateAfterSave] = useState(false); 
  
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    console.log("[ProductEditPage] hasUnsavedChanges updated to:", hasUnsavedChanges);
  }, [hasUnsavedChanges]);

  const blocker = useBlocker(() => {
    console.log("[ProductEditPage] Blocker triggered. hasUnsavedChanges:", hasUnsavedChanges);
    if (hasUnsavedChanges) {
      setIsLeaveConfirmModalOpen(true);
      return true; 
    }
    return false; 
  });
  
  useEffect(() => {
    console.log("[ProductEditPage] Blocker state changed:", blocker.state);
    console.log("[ProductEditPage] isLeaveConfirmModalOpen state:", isLeaveConfirmModalOpen);
    if (!hasUnsavedChanges && isLeaveConfirmModalOpen && blocker.state === 'blocked') {
      console.log("[ProductEditPage] Proceeding with navigation as no unsaved changes or modal open.");
      setIsLeaveConfirmModalOpen(false);
      blocker.proceed();
    }
  }, [hasUnsavedChanges, isLeaveConfirmModalOpen, blocker]);


  const fetchProductAndRelatedData = useCallback(async (id: string) => {
    if (!accessToken) {
      showToast({ title: "Erro de Autenticação", description: "Autenticação necessária.", variant: "error" });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setHasUnsavedChanges(false); 
    setShouldNavigateAfterSave(false); 
    try {
      const [fetchedProduct, allUserProducts] = await Promise.all([
        productService.getProductById(id, accessToken),
        productService.getProducts(accessToken)
      ]);

      if (fetchedProduct) {
        setInitialProductData(fetchedProduct);
        setUserProductsForOffers(allUserProducts.filter((p: Product) => p.id !== id));
      } else {
        showToast({ title: "Erro", description: 'Produto não encontrado.', variant: "error" });
        navigate('/produtos');
      }
    } catch (err: any) {
      showToast({ title: "Erro ao Carregar", description: err.message || 'Falha ao carregar dados do produto.', variant: "error" });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, navigate, showToast]);

  useEffect(() => {
    if (productId) {
      fetchProductAndRelatedData(productId);
    } else {
      showToast({ title: "Erro", description: "ID do produto não fornecido.", variant: "error" });
      navigate('/produtos');
    }
  }, [productId, fetchProductAndRelatedData, navigate, showToast]);

  
  useEffect(() => {
    if (shouldNavigateAfterSave && !hasUnsavedChanges) {
      navigate('/produtos');
      setShouldNavigateAfterSave(false); 
    }
  }, [shouldNavigateAfterSave, hasUnsavedChanges, navigate]);


  const handleFormSubmit = async (formData: Omit<Product, 'id' | 'platformUserId' | 'slug' | 'totalSales' | 'clicks' | 'checkoutViews' | 'conversionRate' | 'abandonmentRate'>) => {
    if (!productId) {
      showToast({ title: "Erro", description: 'ID do produto ausente para atualização.', variant: "error" });
      return;
    }
    setIsSaving(true);
    try {
      const updatedProduct = await productService.updateProduct(productId, formData, accessToken);
      showToast({ title: "Produto Atualizado!", description: "As alterações no produto foram salvas.", variant: "success" });
      setHasUnsavedChanges(false); 
      if (updatedProduct) {
        setInitialProductData(updatedProduct);
      } else {
        await fetchProductAndRelatedData(productId); 
      }
      
      if (shouldNavigateAfterSave) {
        console.log("[ProductEditPage] Navigate after save condition met. Navigating to /produtos");
        navigate('/produtos');
        setShouldNavigateAfterSave(false);
      }

    } catch (err: any) {
      showToast({ title: "Erro ao Atualizar", description: err.message || 'Falha ao atualizar produto. Tente novamente.', variant: "error" });
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };
  
  const triggerFormSubmit = () => {
    const formElement = formRef.current || document.getElementById(FORM_ID);
    if (formElement instanceof HTMLFormElement) {
        const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
        formElement.dispatchEvent(submitEvent);
    } else {
        showToast({ title: "Erro Interno", description: "Não foi possível submeter o formulário.", variant: "error"});
    }
  };

  const handleSaveAndExit = () => {
    console.log("[ProductEditPage] handleSaveAndExit called.");
    setShouldNavigateAfterSave(true); 
    triggerFormSubmit(); 
  };
  
  const handleSave = () => {
    console.log("[ProductEditPage] handleSave called.");
    setShouldNavigateAfterSave(false); 
    triggerFormSubmit(); 
  };


  const handleNavigateBack = () => {
    if (hasUnsavedChanges) {
      setIsLeaveConfirmModalOpen(true);
    } else {
      navigate('/produtos');
    }
  };

  const handleViewCheckout = () => {
    if (initialProductData?.slug) {
      window.open(`${window.location.origin}/checkout/${initialProductData.slug}`, '_blank');
    } else {
      showToast({ title: "Ação Indisponível", description: "Salve o produto primeiro para gerar o link do checkout.", variant: "info" });
    }
  };

  const handleCopyLinkAction = () => {
    if (!initialProductData || !initialProductData.slug) {
      showToast({ title: "Ação Indisponível", description: "Salve o produto primeiro para gerar o link.", variant: "info" });
      return;
    }
    const checkoutUrl = `${window.location.origin}/checkout/${initialProductData.slug}`;
    const utmifiedUrl = utmifyService.buildUtmifiedUrl(initialProductData, checkoutUrl);
    navigator.clipboard.writeText(utmifiedUrl)
      .then(() => {
        setCopiedLink(true);
        showToast({ title: "Link Copiado!", variant: "success", duration: 2000 });
        setTimeout(() => setCopiedLink(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
        showToast({ title: "Erro ao Copiar", description: "Não foi possível copiar o link.", variant: "error" });
      });
  };

  const handleClone = async () => {
    if (!productId || !accessToken) return;
    setIsCloning(true);
    try {
      const clonedProduct = await productService.cloneProduct(productId, accessToken);
      if (clonedProduct) {
        setHasUnsavedChanges(false); 
        showToast({ title: "Produto Clonado!", description: `Produto "${clonedProduct.name}" criado com sucesso. Você será redirecionado.`, variant: "success" });
        navigate('/produtos'); 
      } else {
        showToast({ title: "Erro ao Clonar", description: "Não foi possível clonar o produto.", variant: "error" });
      }
    } catch (err: any) {
      showToast({ title: "Erro ao Clonar", description: err.message || "Ocorreu um erro.", variant: "error" });
    } finally {
      setIsCloning(false);
    }
  };

  const handleDelete = async () => {
    if (!productId || !accessToken) return;
    setIsDeleting(true);
    try {
      await productService.deleteProduct(productId, accessToken);
      setHasUnsavedChanges(false); 
      showToast({ title: "Produto Excluído!", description: "O produto foi excluído com sucesso.", variant: "success" });
      navigate('/produtos'); 
    } catch (err: any) {
      showToast({ title: "Erro ao Excluir", description: err.message || "Não foi possível excluir o produto.", variant: "error" });
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };
  
  const handleFormChange = useCallback(() => {
    if (!isLoading) { 
      setHasUnsavedChanges(true);
    }
  }, [isLoading]);

  const handleConfirmLeave = async (saveFirst: boolean) => {
    console.log("[ProductEditPage] handleConfirmLeave. saveFirst:", saveFirst);
    if (saveFirst) {
      handleSaveAndExit(); 
      setIsLeaveConfirmModalOpen(false); 
    } else {
      setIsLeaveConfirmModalOpen(false);
      setHasUnsavedChanges(false); 
      setTimeout(() => { 
        if (blocker.state === 'blocked') {
          console.log("[ProductEditPage] Proceeding with blocker after 'Don't Save'.");
          blocker.proceed();
        } else {
          console.log("[ProductEditPage] Blocker not in 'blocked' state, navigating directly.");
          navigate('/produtos'); 
        }
      }, 0);
    }
  };
  

  const handleCancelLeave = () => {
    console.log("[ProductEditPage] handleCancelLeave called.");
    setIsLeaveConfirmModalOpen(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };
  
  if (isLoading || !initialProductData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner size="lg" />
        <p className="ml-2 text-text-muted">Carregando dados do produto...</p>
      </div>
    );
  }
  
  const dropdownItemClass = cn(
    "group relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm text-text-default outline-none transition-colors",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-white/10 data-[highlighted]:text-accent-blue-neon"
  );
  const dropdownDangerItemClass = cn(
    "group relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm text-status-error outline-none transition-colors",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-status-error/10 data-[highlighted]:text-status-error"
  );
  const dropdownIconClass = "mr-2.5 h-5 w-5 text-text-muted group-data-[highlighted]:text-accent-blue-neon";
  const dropdownDangerIconClass = "mr-2.5 h-5 w-5 text-status-error/80 group-data-[highlighted]:text-status-error";

  return (
    <div className="space-y-6 pb-24">
      <div className={cn(
        "flex justify-between items-center mb-4 py-4 border-b border-border-subtle", // Removido sticky e top-0
        "-mx-6 md:-mx-8 px-6 md:px-8", 
        "bg-bg-surface-opaque z-20" 
      )}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleNavigateBack} disabled={isSaving || isDeleting || isCloning} aria-label="Voltar para produtos">
            <ArrowUturnLeftIconHero className="h-5 w-5 mr-1.5" /> Voltar
          </Button>
          <h1 className="text-xl md:text-2xl font-display font-semibold text-text-strong truncate">
            Editar: <span className="text-primary">{initialProductData?.name}</span>
            {hasUnsavedChanges && <span className="text-xs text-status-warning ml-2">(Não Salvo)</span>}
          </h1>
        </div>
        
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <Button variant="outline" size="md" className="p-2.5" aria-label="Mais ações" title="Mais Ações" disabled={isSaving || isDeleting || isCloning}>
              <EllipsisVerticalIcon className="h-5 w-5" />
            </Button>
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              sideOffset={5}
              align="end"
              className={cn(
                "z-50 min-w-[220px] origin-top-right overflow-hidden rounded-xl border border-border-subtle bg-bg-surface bg-opacity-90 backdrop-blur-lg p-1.5 shadow-2xl",
                "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
              )}
            >
              <DropdownMenuPrimitive.Item
                onSelect={handleSave} 
                disabled={isSaving || isDeleting || isCloning || !hasUnsavedChanges}
                className={dropdownItemClass}
              >
                <ArrowDownTrayIcon className={dropdownIconClass} /> Salvar Alterações
              </DropdownMenuPrimitive.Item>
              <DropdownMenuPrimitive.Item
                onSelect={handleSaveAndExit} 
                disabled={isSaving || isDeleting || isCloning || !hasUnsavedChanges}
                className={dropdownItemClass}
              >
                <ArrowDownTrayIcon className={dropdownIconClass} /> Salvar e Sair
              </DropdownMenuPrimitive.Item>
              
              <DropdownMenuPrimitive.Separator className="h-px bg-border-subtle my-1" />

              <DropdownMenuPrimitive.Item
                onSelect={handleViewCheckout}
                disabled={!initialProductData?.slug || isSaving}
                className={dropdownItemClass}
              >
                <ExternalLinkIconHero className={dropdownIconClass} /> Visualizar Checkout
              </DropdownMenuPrimitive.Item>
              <DropdownMenuPrimitive.Item
                onSelect={handleCopyLinkAction}
                disabled={!initialProductData?.slug || isSaving}
                className={dropdownItemClass}
              >
                {copiedLink ? <CheckIcon className={cn(dropdownIconClass, "text-status-success")} /> : <LinkActionIcon className={dropdownIconClass} />}
                {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
              </DropdownMenuPrimitive.Item>
              <DropdownMenuPrimitive.Item
                onSelect={handleClone}
                disabled={isCloning || isSaving || isDeleting}
                className={dropdownItemClass}
              >
                <Square2StackIconHero className={dropdownIconClass} /> Duplicar Produto
              </DropdownMenuPrimitive.Item>

              <DropdownMenuPrimitive.Separator className="h-px bg-border-subtle my-1" />
              
              <DropdownMenuPrimitive.Item
                onSelect={() => setIsDeleteModalOpen(true)}
                disabled={isDeleting || isSaving || isCloning}
                className={dropdownDangerItemClass}
              >
                <TrashActionIcon className={dropdownDangerIconClass} /> Excluir Produto
              </DropdownMenuPrimitive.Item>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
      </div>
      
      <div className="container mx-auto px-0 sm:px-0 md:px-0">
        <ProductForm
          initialData={initialProductData}
          onSubmit={handleFormSubmit} 
          isSaving={isSaving}
          availableProductsForOffers={userProductsForOffers}
          formId={FORM_ID}
          onFormChange={handleFormChange} 
          formRef={formRef}
        />
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-bg-surface-opaque border-t border-border-subtle p-4 shadow-top-hard z-20 md:pl-[calc(288px+1rem)]">
        <div className="max-w-7xl mx-auto flex justify-end items-center space-x-3">
          <Button variant="outline" onClick={handleNavigateBack} disabled={isSaving || isDeleting || isCloning}>
            Voltar para Produtos
          </Button>
          
          <Button 
            onClick={handleSave} 
            variant="primary" 
            isLoading={isSaving} 
            size="md"
            disabled={isSaving || isDeleting || isCloning || !hasUnsavedChanges}
            leftIcon={<ArrowDownTrayIcon className="h-5 w-5" />}
            >
            Salvar Alterações
          </Button>
        </div>
      </div>

      <AlertDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar Exclusão"
        description={<>Você tem certeza que deseja excluir o produto <span className="font-semibold text-text-strong">"{initialProductData?.name}"</span>? Esta ação não poderá ser desfeita.</>}
        onConfirm={handleDelete}
        confirmText="Excluir Produto"
        cancelText="Cancelar"
        confirmButtonVariant="danger"
      />

      <AlertDialog
        isOpen={isLeaveConfirmModalOpen}
        onClose={handleCancelLeave} 
        title="Alterações não Salvas"
        description="Você possui alterações não salvas. Deseja salvá-las antes de sair?"
        confirmText="Salvar e Sair"
        onConfirm={() => handleConfirmLeave(true)}
        cancelText="Continuar Editando"
      >
        <Button variant="danger" onClick={() => handleConfirmLeave(false)} className="mt-2 sm:mt-0">
          Sair sem Salvar
        </Button>
      </AlertDialog>
    </div>
  );
};

export default ProductEditPage;
