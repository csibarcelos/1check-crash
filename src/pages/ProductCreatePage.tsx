
import React, { useState, useRef } from 'react';
import { useNavigate } from "react-router-dom"; 
import { ProductForm } from '@/components/shared/ProductForm';
import { Product } from '@/types';
import { productService } from '@/services/productService';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/contexts/ToastContext';
import { useData } from '@/contexts/DataContext';
import { ArrowDownTrayIcon, ArrowUturnLeftIconHero, cn } from '../constants.tsx';

const FORM_ID = "product-create-form";

const ProductCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { products: userProducts, isLoading: isFetchingProducts } = useData();

  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  const handleCreateProduct = async (formData: Omit<Product, 'id' | 'platformUserId' | 'slug' | 'totalSales' | 'clicks' | 'checkoutViews' | 'conversionRate' | 'abandonmentRate'>) => {
    setIsSaving(true);
    try {
      await productService.createProduct(formData);
      showToast({ title: "Produto Criado!", description: "Seu novo produto foi salvo com sucesso.", variant: "success" });
      navigate('/produtos');
    } catch (err: any) {
      showToast({ title: "Erro ao Criar Produto", description: err.message || 'Falha ao criar produto. Tente novamente.', variant: "error" });
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isFetchingProducts) {
      return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /><p className="ml-2 text-text-muted">Carregando dados...</p></div>;
  }

  return (
    <div className="space-y-6 pb-24">
      <div className={cn(
        "flex justify-between items-center mb-4 py-4 border-b border-border-subtle", // Removido sticky e top-0
        "-mx-6 md:-mx-8 px-6 md:px-8", 
        "bg-bg-surface-opaque z-20" 
      )}>
        <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/produtos')} disabled={isSaving} aria-label="Voltar para produtos">
                <ArrowUturnLeftIconHero className="h-5 w-5 mr-1.5" /> Voltar
            </Button>
            <h1 className="text-xl md:text-2xl font-display font-semibold text-text-strong">
                Criar Novo Produto
            </h1>
        </div>
      </div>
      
      <div className="container mx-auto px-0 sm:px-0 md:px-0">
        <ProductForm 
          onSubmit={handleCreateProduct} 
          isSaving={isSaving}
          availableProductsForOffers={userProducts}
          formId={FORM_ID}
          formRef={formRef}
        />
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-bg-surface-opaque border-t border-border-subtle p-4 shadow-top-hard z-20 md:pl-[calc(288px+1rem)]">
        <div className="max-w-7xl mx-auto flex justify-end items-center space-x-3">
          <Button variant="outline" onClick={() => navigate('/produtos')} disabled={isSaving}>
            Cancelar
          </Button>
          <Button 
            type="submit" 
            form={FORM_ID} 
            variant="primary" 
            isLoading={isSaving} 
            size="md"
            leftIcon={<ArrowDownTrayIcon className="h-5 w-5" />}
            disabled={isSaving}
          >
            Criar Produto
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductCreatePage;