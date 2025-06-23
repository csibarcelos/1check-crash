
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from "react-router-dom"; 
import { ProductForm } from '@/components/shared/ProductForm';
import { Product } from '@/types';
import { productService } from '@/services/productService';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ArrowDownTrayIcon } from '../constants.tsx';

const FORM_ID = "product-create-form";

const ProductCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [isFetchingProducts, setIsFetchingProducts] = useState(true);

  const fetchUserProducts = useCallback(async () => {
    if (!accessToken) {
        setIsFetchingProducts(false);
        return;
    }
    setIsFetchingProducts(true);
    try {
      const products = await productService.getProducts(accessToken);
      setUserProducts(products);
    } catch (err: any) {
      console.error("Failed to fetch user products for bump/upsell selection", err);
      showToast({ title: "Erro ao Carregar Produtos", description: "Falha ao carregar lista de produtos para ofertas.", variant: "error" });
    } finally {
      setIsFetchingProducts(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    fetchUserProducts();
  }, [fetchUserProducts]);

  const handleCreateProduct = async (formData: Omit<Product, 'id' | 'platformUserId' | 'slug' | 'totalSales' | 'clicks' | 'checkoutViews' | 'conversionRate' | 'abandonmentRate'>) => {
    setIsSaving(true);
    try {
      await productService.createProduct(formData, accessToken);
      showToast({ title: "Produto Criado!", description: "Seu novo produto foi salvo com sucesso.", variant: "success" });
      navigate('/produtos');
    } catch (err: any) {
      showToast({ title: "Erro ao Criar Produto", description: err.message || 'Falha ao criar produto. Tente novamente.', variant: "error" });
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isFetchingProducts && userProducts.length === 0) {
      return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /><p className="ml-2 text-text-muted">Carregando dados...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-display font-bold text-text-strong">Criar Novo Produto</h1>
        <Button variant="ghost" onClick={() => navigate('/produtos')} disabled={isSaving}>Voltar</Button>
      </div>
      <ProductForm 
        onSubmit={handleCreateProduct} 
        isSaving={isSaving}
        availableProductsForOffers={userProducts}
        formId={FORM_ID}
        // submitButtonText prop is removed
      />
      <div className="mt-8 flex justify-end space-x-3">
        <Button 
          type="submit" 
          form={FORM_ID} // Associate with the form in ProductForm
          variant="primary" 
          isLoading={isSaving} 
          size="lg"
          leftIcon={<ArrowDownTrayIcon className="h-5 w-5" />}
          disabled={isSaving}
        >
          Criar Produto
        </Button>
      </div>
    </div>
  );
};

export default ProductCreatePage;
