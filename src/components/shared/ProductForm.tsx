
import React, { useState, useEffect, useCallback } from 'react';
import { Product, ProductCheckoutCustomization, OrderBumpOffer, UpsellOffer, Coupon, UtmParams } from '@/types';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { COLOR_PALETTE_OPTIONS, TrashIcon, PlusIcon, LinkIcon as UtmIcon, UploadIcon, LinkIcon } from '../../constants.tsx';
import { MiniEditor } from '@/components/shared/MiniEditor';
import { CouponFormModal } from '@/components/shared/CouponFormModal';
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Select } from '@/components/ui/Select';
import { Combobox } from '@/components/ui/Combobox'; 
import { Tabs, TabConfig } from '@/components/ui/Tabs';
import { supabase } from '@/supabaseClient';
import { useToast } from '@/contexts/ToastContext';

const defaultCheckoutCustomizationValues: ProductCheckoutCustomization = {
  primaryColor: '#0D9488', logoUrl: '', videoUrl: '', salesCopy: '',
  testimonials: [], guaranteeBadges: [],
  countdownTimer: { enabled: false, durationMinutes: 15, messageBefore: 'Oferta expira em:', messageAfter: 'Oferta expirada!', backgroundColor: '#EF4444', textColor: '#FFFFFF' },
  theme: 'light', showProductName: true,
};

const defaultUtmParams: UtmParams = { source: '', medium: '', campaign: '', term: '', content: '' };

const listItemVariants: Variants = {
  initial: { opacity: 0, y: -10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: "circOut" } },
  exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.2, ease: "circIn" } },
};

interface ProductFormProps {
  initialData?: Partial<Product>;
  onSubmit: (formData: Omit<Product, 'id' | 'platformUserId' | 'slug' | 'totalSales' | 'clicks' | 'checkoutViews' | 'conversionRate' | 'abandonmentRate'>) => Promise<void>;
  isSaving: boolean;
  availableProductsForOffers?: Product[];
  formId?: string;
  onFormChange?: () => void; 
  formRef?: React.RefObject<HTMLFormElement>; 
}

export const ProductForm: React.FC<ProductFormProps> = ({ initialData, onSubmit, isSaving, availableProductsForOffers = [], formId = "product-form", onFormChange, formRef }) => {
  const { showToast } = useToast();
  const isInitialLoadDone = React.useRef(false);
  
  const [productName, setProductName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [price, setPrice] = useState(initialData?.priceInCents ? (initialData.priceInCents / 100).toFixed(2).replace('.', ',') : '');
  
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>(initialData?.imageUrl ? 'url' : 'url');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(initialData?.imageUrl || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [deliveryUrl, setDeliveryUrl] = useState(initialData?.deliveryUrl || '');
  const [checkoutCustomization, setCheckoutCustomization] = useState<ProductCheckoutCustomization>(
    initialData?.checkoutCustomization 
        ? { ...defaultCheckoutCustomizationValues, ...initialData.checkoutCustomization,
            countdownTimer: { ...defaultCheckoutCustomizationValues.countdownTimer!, ...(initialData.checkoutCustomization.countdownTimer || {}) } } 
        : defaultCheckoutCustomizationValues
  );
  const [utmParams, setUtmParams] = useState<UtmParams>(initialData?.utmParams || defaultUtmParams);

  const [orderBump, setOrderBump] = useState<OrderBumpOffer | undefined>(initialData?.orderBump);
  const [upsell, setUpsell] = useState<UpsellOffer | undefined>(initialData?.upsell);
  const [coupons, setCoupons] = useState<Coupon[]>(initialData?.coupons || []);

  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const notifyChange = useCallback(() => {
    console.log("[ProductForm] notifyChange called. isInitialLoadDone.current:", isInitialLoadDone.current);
    if (isInitialLoadDone.current && onFormChange) {
      console.log("[ProductForm] onFormChange is being invoked.");
      onFormChange();
    }
  }, [onFormChange]);

  useEffect(() => {
    setProductName(initialData?.name || '');
    setDescription(initialData?.description || '');
    setPrice(initialData?.priceInCents ? (initialData.priceInCents / 100).toFixed(2).replace('.', ',') : '');
    setImageUrl(initialData?.imageUrl || '');
    setImagePreviewUrl(initialData?.imageUrl || null);
    setDeliveryUrl(initialData?.deliveryUrl || '');
    setCheckoutCustomization(initialData?.checkoutCustomization 
      ? { ...defaultCheckoutCustomizationValues, ...initialData.checkoutCustomization,
          countdownTimer: { ...defaultCheckoutCustomizationValues.countdownTimer!, ...(initialData.checkoutCustomization.countdownTimer || {}) } } 
      : defaultCheckoutCustomizationValues
    );
    setUtmParams(initialData?.utmParams || defaultUtmParams);
    setOrderBump(initialData?.orderBump);
    setUpsell(initialData?.upsell);
    setCoupons(initialData?.coupons || []);
    setImageInputMode(initialData?.imageUrl && !initialData.imageUrl.startsWith('https://supabase-generated-url') ? 'url' : 'url');
    
    const timer = setTimeout(() => {
        isInitialLoadDone.current = true;
        console.log("[ProductForm] Initial load complete. isInitialLoadDone.current set to true.");
    }, 0);
    return () => clearTimeout(timer);
  }, [initialData]);


  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setImageUrl(''); 
      notifyChange();
    }
  };

  const handleImageUpload = async (): Promise<string | null> => {
    if (!imageFile) return null;
    setIsUploadingImage(true);
    try {
      const fileName = `${Date.now()}_${imageFile.name.replace(/\s+/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('productimages') 
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false, 
        });

      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('productimages').getPublicUrl(data.path);
      showToast({ title: "Upload Concluído", description: "Imagem enviada com sucesso!", variant: 'success' });
      return publicUrl;
    } catch (error: any) {
      console.error("Error uploading image to Supabase Storage:", error);
      showToast({ title: "Erro no Upload", description: error.message || "Falha ao enviar imagem.", variant: 'error' });
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleInternalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !description.trim() || !price) {
      showToast({ title: "Campos Obrigatórios", description: 'Por favor, preencha nome, descrição e preço.', variant: "error" });
      return;
    }
    const priceInCentsNum = Math.round(parseFloat(price.replace(',', '.')) * 100);
    if (isNaN(priceInCentsNum) || priceInCentsNum <= 0) {
      showToast({ title: "Preço Inválido", description: 'Por favor, insira um preço válido.', variant: "error" });
      return;
    }

    let finalImageUrl = imageUrl;
    if (imageInputMode === 'upload' && imageFile) {
        const uploadedUrl = await handleImageUpload();
        if (uploadedUrl) finalImageUrl = uploadedUrl;
        else if (!initialData?.imageUrl) { 
             showToast({ title: "Erro na Imagem", description: "Falha ao fazer upload da imagem. Verifique o arquivo e tente novamente.", variant: "error"});
             return; 
        }
    }
    
    const formData: Omit<Product, 'id' | 'platformUserId' | 'slug' | 'totalSales' | 'clicks' | 'checkoutViews' | 'conversionRate' | 'abandonmentRate'> = {
      name: productName, description, priceInCents: priceInCentsNum,
      imageUrl: finalImageUrl.trim() || undefined,
      deliveryUrl: deliveryUrl.trim() || undefined,
      checkoutCustomization: { ...checkoutCustomization, theme: checkoutCustomization.theme || 'light', showProductName: checkoutCustomization.showProductName !== undefined ? checkoutCustomization.showProductName : true },
      orderBump: orderBump?.productId ? orderBump : undefined,
      upsell: upsell?.productId ? upsell : undefined,
      coupons: coupons.length > 0 ? coupons : undefined,
      utmParams: Object.values(utmParams).some(val => typeof val === 'string' && val.trim() !== '') ? utmParams : undefined,
    };
    await onSubmit(formData);
  };
  
  const imageTabsConfig: TabConfig[] = [
    { value: 'url', label: 'URL da Imagem', content: 
        <Input type="url" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); setImagePreviewUrl(e.target.value || null); notifyChange(); }} placeholder="https://exemplo.com/imagem.jpg" disabled={isSaving || isUploadingImage} icon={<LinkIcon className="h-5 w-5"/>}/> },
    { value: 'upload', label: 'Enviar Arquivo', content: 
        <Input type="file" accept="image/*" onChange={handleImageFileChange} disabled={isSaving || isUploadingImage} icon={<UploadIcon className="h-5 w-5"/>} /> },
  ];

  const handleCustomizationChange = <K extends keyof ProductCheckoutCustomization, V extends ProductCheckoutCustomization[K]>(field: K, value: V) => { setCheckoutCustomization(prev => ({ ...prev, [field]: value })); notifyChange(); };
  const handleCountdownTimerChange = <K extends keyof NonNullable<ProductCheckoutCustomization['countdownTimer']>>(field: K, value: NonNullable<ProductCheckoutCustomization['countdownTimer']>[K]) => { setCheckoutCustomization(prev => ({ ...prev, countdownTimer: { ...(prev.countdownTimer || defaultCheckoutCustomizationValues.countdownTimer!), [field]: value } })); notifyChange(); };
  const handleUtmParamChange = (param: keyof UtmParams, value: string) => { setUtmParams(prev => ({ ...prev, [param]: value })); notifyChange(); };
  const handleSalesCopyChange = (html: string) => { handleCustomizationChange('salesCopy', html); }; 
  const addGuaranteeBadge = () => { handleCustomizationChange('guaranteeBadges', [...(checkoutCustomization.guaranteeBadges || []), { id: `badge_${Date.now()}`, imageUrl: '', altText: '' }]); };
  const updateGuaranteeBadge = (id: string, field: 'imageUrl' | 'altText', value: string) => { handleCustomizationChange('guaranteeBadges', (checkoutCustomization.guaranteeBadges || []).map(b => b.id === id ? { ...b, [field]: value } : b)); };
  const removeGuaranteeBadge = (id: string) => { handleCustomizationChange('guaranteeBadges', (checkoutCustomization.guaranteeBadges || []).filter(b => b.id !== id)); };
  
  const handleOfferProductSelect = (type: 'bump' | 'upsell', selectedProdId: string) => {
    if (!selectedProdId) { if (type === 'bump') setOrderBump(undefined); else setUpsell(undefined); notifyChange(); return; }
    const selectedProductOffer = availableProductsForOffers.find(p => p.id === selectedProdId);
    if (!selectedProductOffer) { if (type === 'bump') setOrderBump(undefined); else setUpsell(undefined); notifyChange(); return; }
    const offerData = { productId: selectedProductOffer.id, name: selectedProductOffer.name, description: selectedProductOffer.description.substring(0, 100) + (selectedProductOffer.description.length > 100 ? '...' : ''), customPriceInCents: selectedProductOffer.priceInCents, imageUrl: selectedProductOffer.imageUrl || selectedProductOffer.checkoutCustomization?.logoUrl || '', };
    if (type === 'bump') setOrderBump(offerData); else setUpsell(offerData);
    notifyChange();
  };

  const handleOfferPriceChange = (type: 'bump' | 'upsell', priceStr: string) => {
    const priceNum = Math.round(parseFloat(priceStr.replace(',', '.')) * 100);
    if (type === 'bump' && orderBump) setOrderBump(prev => prev ? { ...prev, customPriceInCents: isNaN(priceNum) ? prev.customPriceInCents : priceNum } : undefined);
    else if (type === 'upsell' && upsell) setUpsell(prev => prev ? { ...prev, customPriceInCents: isNaN(priceNum) ? prev.customPriceInCents : priceNum } : undefined);
    notifyChange();
  };
  const removeOffer = (type: 'bump' | 'upsell') => { if (type === 'bump') setOrderBump(undefined); else setUpsell(undefined); notifyChange(); };
  const openCouponModal = (coupon?: Coupon) => { setEditingCoupon(coupon || null); setIsCouponModalOpen(true); };
  const closeCouponModal = () => { setEditingCoupon(null); setIsCouponModalOpen(false); };
  const saveCoupon = (couponData: Coupon) => { if (editingCoupon) setCoupons(prev => prev.map(c => c.id === couponData.id ? couponData : c)); else setCoupons(prev => [...prev, { ...couponData, id: `coupon_${Date.now()}` }]); closeCouponModal(); notifyChange(); };
  const deleteCoupon = (couponId: string) => { setCoupons(prev => prev.filter(c => c.id !== couponId)); notifyChange(); };

  const countdownDurationOptions = [ { label: 'Nenhum', value: "0" }, { label: '5 minutos', value: "5" }, { label: '10 minutos', value: "10" }, { label: '15 minutos', value: "15" }, { label: '20 minutos', value: "20" }, { label: '30 minutos', value: "30" }, { label: '60 minutos', value: "60" }, ].map(cd => ({ value: cd.value, label: cd.label }));
  
  const offerProductComboboxOptions = availableProductsForOffers.map(p => ({ value: p.id, label: `${p.name} (R$ ${(p.priceInCents / 100).toFixed(2).replace('.', ',')})` }));
  const upsellProductComboboxOptions = availableProductsForOffers.filter(p => p.id !== orderBump?.productId).map(p => ({ value: p.id, label: `${p.name} (R$ ${(p.priceInCents / 100).toFixed(2).replace('.', ',')})` }));

  const wrappedSetProductName = (val: string) => { setProductName(val); notifyChange(); };
  const wrappedSetDescription = (val: string) => { setDescription(val); notifyChange(); };
  const wrappedSetPrice = (val: string) => { setPrice(val); notifyChange(); };
  const wrappedSetDeliveryUrl = (val: string) => { setDeliveryUrl(val); notifyChange(); };
  const wrappedSetImageInputMode = (val: 'url' | 'upload') => { setImageInputMode(val); notifyChange(); };

  return (
    <form onSubmit={handleInternalSubmit} id={formId} ref={formRef}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Detalhes do Produto">
            <div className="space-y-4">
              <Input label="Nome do Produto" name="productName" value={productName} onChange={(e) => wrappedSetProductName(e.target.value)} required placeholder="Ex: Curso de Marketing Digital Avançado" disabled={isSaving} />
              <Textarea label="Descrição" name="description" value={description} onChange={(e) => wrappedSetDescription(e.target.value)} required placeholder="Descreva seu produto em detalhes..." rows={5} disabled={isSaving}/>
              <Input label="Preço (R$)" name="price" type="text" value={price} onChange={(e) => wrappedSetPrice(e.target.value)} required placeholder="Ex: 197,00" disabled={isSaving}/>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-default">Imagem Principal do Produto</label>
                <Tabs tabs={imageTabsConfig} defaultValue={imageInputMode} onValueChange={(val) => wrappedSetImageInputMode(val as 'url' | 'upload')} />
                {imagePreviewUrl && <img src={imagePreviewUrl} alt="Prévia da Imagem" className="mt-2 max-h-48 w-auto rounded-lg border border-border-subtle shadow-sm"/>}
                {isUploadingImage && <div className="flex items-center text-sm text-accent-blue-neon"><LoadingSpinner size="sm" className="mr-2"/>Enviando imagem...</div>}
              </div>

              <Input label="URL de Entrega (Opcional)" name="deliveryUrl" type="url" value={deliveryUrl} onChange={(e) => wrappedSetDeliveryUrl(e.target.value)} placeholder="https://areademembros.com/acesso-curso" disabled={isSaving}/>
            </div>
          </Card>
          <Card title="Oferta Adicional (Order Bump)">
            {orderBump ? (
              <motion.div variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="space-y-3 p-3 border border-border-subtle rounded-xl bg-bg-surface-opaque">
                <p className="font-medium text-text-strong">Produto: <span className="text-primary">{orderBump.name}</span></p>
                <Input label="Preço Customizado (R$)" type="text" value={orderBump.customPriceInCents !== undefined ? (orderBump.customPriceInCents / 100).toFixed(2).replace('.', ',') : ''} onChange={(e) => handleOfferPriceChange('bump', e.target.value)} placeholder="Preço original se vazio" disabled={isSaving}/>
                <Button type="button" variant="danger" size="sm" onClick={() => removeOffer('bump')} disabled={isSaving}>Remover</Button>
              </motion.div>
            ) : (
              <div className="space-y-2">
                <Combobox
                  label="Selecionar Produto para Order Bump:"
                  options={offerProductComboboxOptions}
                  value={orderBump ? (orderBump as any).productId : ""}
                  onValueChange={(value) => handleOfferProductSelect('bump', value)}
                  placeholder="Nenhum (Sem Order Bump)"
                  emptyMessage="Nenhum produto encontrado."
                  disabled={isSaving || availableProductsForOffers.length === 0}
                />
                {availableProductsForOffers.length === 0 && <p className="text-xs text-text-muted mt-1">Crie outros produtos.</p>}
              </div>
            )}
          </Card>
          <Card title="Oferta Pós-Compra (Upsell)">
            {upsell ? (
              <motion.div variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="space-y-3 p-3 border border-border-subtle rounded-xl bg-bg-surface-opaque">
                <p className="font-medium text-text-strong">Produto: <span className="text-primary">{upsell.name}</span></p>
                <Input label="Preço Customizado (R$)" type="text" value={upsell.customPriceInCents !== undefined ? (upsell.customPriceInCents / 100).toFixed(2).replace('.', ',') : ''} onChange={(e) => handleOfferPriceChange('upsell', e.target.value)} placeholder="Preço original se vazio" disabled={isSaving}/>
                <Button type="button" variant="danger" size="sm" onClick={() => removeOffer('upsell')} disabled={isSaving}>Remover</Button>
              </motion.div>
            ) : (
              <div className="space-y-2">
                 <Combobox
                  label="Selecionar Produto para Upsell:"
                  options={upsellProductComboboxOptions}
                  value={upsell ? (upsell as any).productId : ""}
                  onValueChange={(value) => handleOfferProductSelect('upsell', value)}
                  placeholder="Nenhum (Sem Upsell)"
                  emptyMessage="Nenhum produto encontrado."
                  disabled={isSaving || availableProductsForOffers.length === 0}
                />
                {availableProductsForOffers.length === 0 && <p className="text-xs text-text-muted mt-1">Crie outros produtos.</p>}
              </div>
            )}
          </Card>
        </div>
        <div className="lg:col-span-1 space-y-6">
          <Card title="Personalização do Checkout">
            <div className="space-y-4">
              <div> <label className="block text-sm font-medium text-text-default mb-1.5">Cor Principal</label> <div className="grid grid-cols-5 gap-2 mt-1"> {COLOR_PALETTE_OPTIONS.map(color => ( <button key={color.value} type="button" title={color.name} onClick={() => handleCustomizationChange('primaryColor', color.value)} className={`h-8 w-full rounded-lg border-2 transition-all duration-150 ${checkoutCustomization.primaryColor === color.value ? 'ring-2 ring-offset-2 ring-accent-blue-neon border-accent-blue-neon ring-offset-bg-surface' : 'border-border-subtle hover:border-accent-blue-neon/70'}`} style={{ backgroundColor: color.value }} disabled={isSaving} /> ))} </div> <Input name="customColor" type="color" value={checkoutCustomization.primaryColor || '#0D9488'} onChange={(e) => handleCustomizationChange('primaryColor', e.target.value)} className="mt-2 h-10 w-full sm:w-auto bg-bg-surface border-border-subtle" disabled={isSaving}/> </div>
              <div> <Select label="Tema da Página de Checkout" options={[{value: 'light', label: 'Claro (Padrão)'}, {value: 'dark', label: 'Escuro'}]} value={checkoutCustomization.theme || 'light'} onValueChange={(value) => handleCustomizationChange('theme', value as 'light' | 'dark')} disabled={isSaving}/> </div>
              <ToggleSwitch label="Exibir Nome do Produto no Checkout" enabled={checkoutCustomization.showProductName !== undefined ? checkoutCustomization.showProductName : true} onEnabledChange={(isEnabled) => handleCustomizationChange('showProductName', isEnabled)} disabled={isSaving}/>
              <Input label="URL do Logo Pequeno (Checkout)" name="logoUrl" value={checkoutCustomization.logoUrl || ''} onChange={(e) => handleCustomizationChange('logoUrl', e.target.value)} placeholder="https://exemplo.com/logo.png" disabled={isSaving}/>
              <Input label="URL do Vídeo (YouTube Embed)" name="videoUrl" value={checkoutCustomization.videoUrl || ''} onChange={(e) => handleCustomizationChange('videoUrl', e.target.value)} placeholder="https://youtube.com/embed/..." disabled={isSaving}/>
              <div> <label className="block text-sm font-medium text-text-default mb-1.5">Copy de Vendas</label> <MiniEditor value={checkoutCustomization.salesCopy || ''} onChange={handleSalesCopyChange} placeholder="Sua copy persuasiva para o checkout..."/> </div>
              <div> <h4 className="text-sm font-medium text-text-default mb-2">Selos de Garantia</h4> <AnimatePresence> {(checkoutCustomization.guaranteeBadges || []).map((badge, index) => ( <motion.div key={badge.id} variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="mb-3"> <Card className="p-3 bg-bg-surface-opaque border-border-subtle"> <Input label={`URL Imagem Selo ${index + 1}`} value={badge.imageUrl} onChange={(e) => updateGuaranteeBadge(badge.id, 'imageUrl', e.target.value)} placeholder="https://exemplo.com/selo.png" className="mb-2" disabled={isSaving}/> <Input label={`Texto Alt Selo ${index + 1}`} value={badge.altText} onChange={(e) => updateGuaranteeBadge(badge.id, 'altText', e.target.value)} placeholder="Descrição do selo" className="mb-2" disabled={isSaving}/> <Button type="button" variant="danger" size="sm" onClick={() => removeGuaranteeBadge(badge.id)} leftIcon={<TrashIcon className="h-4 w-4"/>} disabled={isSaving}>Remover</Button> </Card> </motion.div> ))} </AnimatePresence> <Button type="button" variant="secondary" size="sm" onClick={addGuaranteeBadge} leftIcon={<PlusIcon className="h-4 w-4" />} disabled={isSaving}>Adicionar Selo</Button> </div>
              <div className="pt-4 border-t border-border-subtle"> <h4 className="text-md font-semibold text-text-strong mb-3">Cronômetro de Escassez</h4> <ToggleSwitch label="Habilitar Cronômetro" enabled={checkoutCustomization.countdownTimer?.enabled || false} onEnabledChange={(isEnabled) => handleCountdownTimerChange('enabled', isEnabled)} disabled={isSaving}/> {checkoutCustomization.countdownTimer?.enabled && ( <motion.div variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="space-y-3 mt-3 pl-3 border-l-2 border-border-interactive/50"> <Select label="Duração do Cronômetro" options={countdownDurationOptions} value={String(checkoutCustomization.countdownTimer.durationMinutes || 15)} onValueChange={(value) => handleCountdownTimerChange('durationMinutes', parseInt(value))} disabled={isSaving} /> <Textarea label="Mensagem Antes do Cronômetro (Opcional)" value={checkoutCustomization.countdownTimer.messageBefore || ''} onChange={(e) => handleCountdownTimerChange('messageBefore', e.target.value)} rows={2} disabled={isSaving}/> <Textarea label="Mensagem Após Expirar (Opcional)" value={checkoutCustomization.countdownTimer.messageAfter || ''} onChange={(e) => handleCountdownTimerChange('messageAfter', e.target.value)} rows={2} disabled={isSaving}/> <div className="flex space-x-3"> <Input label="Cor Fundo" type="color" value={checkoutCustomization.countdownTimer.backgroundColor || '#EF4444'} onChange={(e) => handleCountdownTimerChange('backgroundColor', e.target.value)} className="h-10 w-1/2 bg-bg-surface border-border-subtle" disabled={isSaving}/> <Input label="Cor Texto" type="color" value={checkoutCustomization.countdownTimer.textColor || '#FFFFFF'} onChange={(e) => handleCountdownTimerChange('textColor', e.target.value)} className="h-10 w-1/2 bg-bg-surface border-border-subtle" disabled={isSaving}/> </div> </motion.div> )} </div>
            </div>
          </Card>
          <Card title="Parâmetros UTM"> <div className="space-y-4"> <Input label="utm_source" name="utm_source" value={utmParams.source || ''} onChange={(e) => handleUtmParamChange('source', e.target.value)} placeholder="Ex: google, facebook" icon={<UtmIcon className="h-5 w-5 text-text-muted"/>} disabled={isSaving}/> <Input label="utm_medium" name="utm_medium" value={utmParams.medium || ''} onChange={(e) => handleUtmParamChange('medium', e.target.value)} placeholder="Ex: cpc, email" icon={<UtmIcon className="h-5 w-5 text-text-muted"/>} disabled={isSaving}/> <Input label="utm_campaign" name="utm_campaign" value={utmParams.campaign || ''} onChange={(e) => handleUtmParamChange('campaign', e.target.value)} placeholder="Ex: promocao_natal" icon={<UtmIcon className="h-5 w-5 text-text-muted"/>} disabled={isSaving}/> <Input label="utm_term (Opcional)" name="utm_term" value={utmParams.term || ''} onChange={(e) => handleUtmParamChange('term', e.target.value)} placeholder="Ex: palavra_chave" icon={<UtmIcon className="h-5 w-5 text-text-muted"/>} disabled={isSaving}/> <Input label="utm_content (Opcional)" name="utm_content" value={utmParams.content || ''} onChange={(e) => handleUtmParamChange('content', e.target.value)} placeholder="Ex: banner_azul" icon={<UtmIcon className="h-5 w-5 text-text-muted"/>} disabled={isSaving}/> </div> </Card>
          <Card title="Cupons de Desconto"> <div className="space-y-3"> {coupons.length === 0 && <p className="text-sm text-text-muted">Nenhum cupom adicionado.</p>} <AnimatePresence> {coupons.map(coupon => ( <motion.div key={coupon.id} variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="p-3 border border-border-subtle rounded-xl bg-bg-surface-opaque flex justify-between items-center"> <div><p className="font-semibold text-primary">{coupon.code}</p> <p className="text-xs text-text-default"> {coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `R$ ${(coupon.discountValue/100).toFixed(2)} OFF`} {coupon.isAutomatic && <span className="ml-1 text-status-success text-xs">(Automático)</span>} {!coupon.isActive && <span className="ml-1 text-status-warning text-xs">(Inativo)</span>} </p> </div> <div className="space-x-1"> <Button type="button" variant="ghost" size="sm" onClick={() => openCouponModal(coupon)} disabled={isSaving}>Editar</Button> <Button type="button" variant="ghost" size="sm" onClick={() => deleteCoupon(coupon.id)} className="text-status-error hover:text-opacity-80" disabled={isSaving}><TrashIcon className="h-4 w-4"/></Button> </div> </motion.div> ))} </AnimatePresence> <Button type="button" variant="secondary" onClick={() => openCouponModal()} leftIcon={<PlusIcon className="h-5 w-5"/>} className="w-full" disabled={isSaving}>Adicionar Cupom</Button> </div> </Card>
        </div>
      </div>
      {isCouponModalOpen && <CouponFormModal isOpen={isCouponModalOpen} onClose={closeCouponModal} onSave={saveCoupon} existingCoupon={editingCoupon}/> }
    </form>
  );
};
