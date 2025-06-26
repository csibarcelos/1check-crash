
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, ProductCheckoutCustomization, TraditionalOrderBumpOffer, PostClickOffer, UpsellOffer, Coupon, UtmParams, PostPurchaseEmailConfig } from '@/types';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { 
    COLOR_PALETTE_OPTIONS, TrashIcon, PlusIcon, UploadIcon, LinkIcon, 
    LockClosedIcon as OpenLockIcon, EyeIcon as ViewIcon, PaintBrushIcon, 
    TagIcon as PriceTagIcon, ShoppingBagIcon, GiftIcon, ChartPieIcon as UtmIcon,
    SparklesIcon, EnvelopeIcon // Added EnvelopeIcon
} from '../../constants.tsx';
import { MiniEditor } from '@/components/shared/MiniEditor';
import { CouponFormModal } from '@/components/shared/CouponFormModal';
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Select } from '@/components/ui/Select';
import { Combobox } from '@/components/ui/Combobox'; 
import { Tabs, TabConfig } from '@/components/ui/Tabs';
import { supabase } from '@/supabaseClient';
import { useToast } from '@/contexts/ToastContext';
import { v4 as uuidv4 } from 'uuid';
import { defaultProductCheckoutCustomization, defaultUtmParams } from '@/services/productService';


const formatCurrency = (valueInCents: number): string => {
    return `R\$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

const defaultPostPurchaseEmailConfigValues: PostPurchaseEmailConfig = {
  enabled: false,
  delayDays: 3,
  subject: 'Obrigado por comprar {{product_name}}!',
  bodyHtml: '<p>Olá {{customer_name}},</p><p>Agradecemos por adquirir nosso produto: {{product_name}}.</p><p>Esperamos que você aproveite ao máximo! Se precisar de ajuda, estamos à disposição.</p><p>Atenciosamente,</p><p>Equipe {{shop_name}}</p>',
};


const listItemVariants: Variants = {
  initial: { opacity: 0, y: -10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: "circOut" } },
  exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.2, ease: "circIn" } },
};

const postClickOfferCopySuggestions = {
  titulo_modal: [
    "🚨 PARE! Você quase perdeu isso...", "💀 Oferta que mata em 30 segundos", "🔥 Só aparece UMA VEZ na vida", "⚡ Acesso VIP desbloqueado!", "🎯 EXCLUSIVO: Você foi escolhido!", "💣 Bomba que vai explodir sua mente", "🚀 Turbine AGORA ou se arrependa", "🧠 Só quem é INTELIGENTE pega isso", "👑 Oferta de MILIONÁRIO liberada", "💰 Dinheiro fácil batendo na porta", "🔓 Acesso SECRETO desbloqueado", "⏰ Expira em 3... 2... 1...", "🎰 Jackpot! Você ganhou!", "🔴 URGENTE: Leia antes de sair", "💎 Tesouro encontrado!", "🌟 Você é o ESCOLHIDO!", "🚨 ALERTA: Oportunidade única", "🔥 Queima de estoque SECRETA", "⚡ Raio que não cai duas vezes", "🎁 Presente que vale OURO"
  ],
  descricao_modal: [
    "Você está a 1 clique de ganhar MUITO mais por quase nada. Vai deixar isso passar?", "Olha só o que você desbloqueou... Essa oferta normalmente custa 10x mais!", "Não conte pra ninguém: você ganhou acesso a algo que poucos conhecem.", "Eu vou te fazer um favor ABSURDO agora. Só porque você chegou até aqui...", "Essa é a parte SECRETA que os outros não vão ver. Aproveite!", "Se você não pegar isso AGORA, vai se arrepender pelo resto da vida.", "Atenção: Isso aqui é ouro puro por preço de banana. Vai perder?", "Última chance de sair do básico e entrar no PREMIUM de verdade.", "Você tem 10 segundos para decidir: mediocridade ou SUCESSO?", "Só quem entende o jogo aproveita uma oportunidade dessas.", "Essa é a diferença entre você e os outros 99% que desistem.", "Vai jogar R$ {preco} fora? Porque é isso que você faz quando recusa.", "Nem todo mundo tem acesso a isso. Você foi ESCOLHIDO!", "Cuidado: quem ignora essa oferta geralmente se arrepende por anos.", "Isso vale 100x mais que o que você está pagando. É presente!", "Você quer ser mais um na multidão ou quer se DESTACAR?", "Essa é sua chance de ouro. Não aparece de novo!", "Se fosse meu dinheiro, eu pegaria sem pensar 2 vezes.", "R$ {preco} que separam você do PRÓXIMO NÍVEL. Vale a pena?", "Só os ESPERTOS entendem o valor disso aqui. Você é um deles?"
  ],
  texto_botao_aceitar: [
    "🔥 PEGAR AGORA por R$ {preco}!", "💰 LUCRAR com essa oferta!", "⚡ ATIVAR meu poder secreto!", "🚀 DECOLAR por só R$ {preco}!", "💎 SIM! Quero ser PREMIUM!", "🧠 INTELIGENTE, vou pegar!", "👑 VENCER por R$ {preco}!", "🎯 ACERTAR em cheio!", "💣 EXPLODIR meus resultados!", "🔓 DESTRANCAR o sucesso!", "⭐ BRILHAR por R$ {preco}!", "🎰 APOSTAR na vitória!", "🔴 URGENTE: Quero isso!", "💥 DOMINAR por R$ {preco}!", "🌟 ESCOLHIDO, vou pegar!", "🚨 ALERTA: Aceito!", "🔥 QUEIMAR a concorrência!", "⚡ RAIO de genialidade!", "🎁 PRESENTE aceito!", "💰 INVESTIR em mim!"
  ],
  texto_botao_recusar: [
    "😔 Dispensar essa fortuna...", "🤦‍♂️ Perder essa chance única", "😩 Desistir do sucesso", "💸 Jogar dinheiro fora", "😞 Ficar na mediocridade", "🚫 Recusar ser especial", "😢 Continuar igual todo mundo", "💔 Quebrar meu coração", "😭 Me arrepender depois", "🙄 Ignorar essa oportunidade", "😤 Dispensar o que é bom", "🤷‍♂️ Deixar pra lá...", "😓 Perder por orgulho", "💀 Morrer de arrependimento", "😰 Ter medo de ganhar", "🤡 Fazer papel de bobo", "😱 Perder o controle", "🥺 Chorar depois", "😬 Fingir que não preciso", "🙈 Fechar os olhos pro óbvio"
  ]
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
  
  const supabaseOrigin = useMemo(() => {
    const { data } = supabase.storage.from('productimages').getPublicUrl('_'); // Dummy path
    if (data?.publicUrl) {
        try {
            return new URL(data.publicUrl).origin;
        } catch (e) { 
            console.error("Error parsing Supabase origin URL from publicUrl:", data.publicUrl, e);
            return ''; 
        }
    }
    console.warn("Could not get publicUrl to determine Supabase origin.");
    return '';
  }, []); 


  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>(
    initialData?.imageUrl && supabaseOrigin && !initialData.imageUrl.startsWith(supabaseOrigin) ? 'url' : 'url'
  );
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(initialData?.imageUrl || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [deliveryUrl, setDeliveryUrl] = useState(initialData?.deliveryUrl || '');
  const [checkoutCustomization, setCheckoutCustomization] = useState<ProductCheckoutCustomization>(
    initialData?.checkoutCustomization 
        ? { ...defaultProductCheckoutCustomization, ...initialData.checkoutCustomization,
            countdownTimer: { ...defaultProductCheckoutCustomization.countdownTimer!, ...(initialData.checkoutCustomization.countdownTimer || {}) },
            animateTraditionalOrderBumps: typeof initialData.checkoutCustomization.animateTraditionalOrderBumps === 'boolean' ? initialData.checkoutCustomization.animateTraditionalOrderBumps : defaultProductCheckoutCustomization.animateTraditionalOrderBumps,
        } 
        : defaultProductCheckoutCustomization
  );
  const [utmParams, setUtmParams] = useState<UtmParams>(initialData?.utmParams || defaultUtmParams);
  const [postPurchaseEmailConfig, setPostPurchaseEmailConfig] = useState<PostPurchaseEmailConfig>(
    initialData?.postPurchaseEmailConfig 
      ? { ...defaultPostPurchaseEmailConfigValues, ...initialData.postPurchaseEmailConfig }
      : defaultPostPurchaseEmailConfigValues
  );

  const [traditionalOrderBumps, setTraditionalOrderBumps] = useState<TraditionalOrderBumpOffer[]>(initialData?.orderBumps || []);
  const [postClickOffer, setPostClickOffer] = useState<PostClickOffer | undefined>(initialData?.postClickOffer);
  const [upsell, setUpsell] = useState<UpsellOffer | undefined>(initialData?.upsell);
  const [coupons, setCoupons] = useState<Coupon[]>(initialData?.coupons || []);

  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const [postClickOfferTitleIndex, setPostClickOfferTitleIndex] = useState(0);
  const [postClickOfferDescIndex, setPostClickOfferDescIndex] = useState(0);
  const [postClickOfferAcceptBtnIndex, setPostClickOfferAcceptBtnIndex] = useState(0);
  const [postClickOfferDeclineBtnIndex, setPostClickOfferDeclineBtnIndex] = useState(0);


  const notifyChange = useCallback(() => {
    if (isInitialLoadDone.current && onFormChange) {
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
      ? { ...defaultProductCheckoutCustomization, ...initialData.checkoutCustomization,
          countdownTimer: { ...defaultProductCheckoutCustomization.countdownTimer!, ...(initialData.checkoutCustomization.countdownTimer || {}) },
          animateTraditionalOrderBumps: typeof initialData.checkoutCustomization.animateTraditionalOrderBumps === 'boolean' ? initialData.checkoutCustomization.animateTraditionalOrderBumps : defaultProductCheckoutCustomization.animateTraditionalOrderBumps,
        } 
      : defaultProductCheckoutCustomization
    );
    setUtmParams(initialData?.utmParams || defaultUtmParams);
    setPostPurchaseEmailConfig(initialData?.postPurchaseEmailConfig ? { ...defaultPostPurchaseEmailConfigValues, ...initialData.postPurchaseEmailConfig } : defaultPostPurchaseEmailConfigValues);
    setTraditionalOrderBumps(initialData?.orderBumps || []);
    setPostClickOffer(initialData?.postClickOffer);
    setUpsell(initialData?.upsell);
    setCoupons(initialData?.coupons || []);
    
    if (supabaseOrigin && initialData?.imageUrl) {
        const hasSupabaseGeneratedUrl = initialData.imageUrl.startsWith(supabaseOrigin);
        setImageInputMode(initialData.imageUrl && !hasSupabaseGeneratedUrl ? 'url' : 'url');
    } else if (initialData?.imageUrl) {
        setImageInputMode('url');
    }

    const timer = setTimeout(() => { isInitialLoadDone.current = true; }, 100); 
    return () => clearTimeout(timer);
  }, [initialData, supabaseOrigin]);


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
    const priceInCentsNum = Math.round(parseFloat(price.replace(/\./g, '').replace(',', '.')) * 100);
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
      checkoutCustomization: { 
          ...checkoutCustomization, 
          theme: checkoutCustomization.theme || 'light', 
          showProductName: checkoutCustomization.showProductName !== undefined ? checkoutCustomization.showProductName : true,
          animateTraditionalOrderBumps: typeof checkoutCustomization.animateTraditionalOrderBumps === 'boolean' ? checkoutCustomization.animateTraditionalOrderBumps : defaultProductCheckoutCustomization.animateTraditionalOrderBumps,
      },
      orderBumps: traditionalOrderBumps.length > 0 ? traditionalOrderBumps.filter(ob => ob.productId) : undefined,
      postClickOffer: postClickOffer?.productId ? postClickOffer : undefined, 
      upsell: upsell?.productId ? upsell : undefined,
      coupons: coupons.length > 0 ? coupons : undefined,
      utmParams: Object.values(utmParams).some(val => typeof val === 'string' && val.trim() !== '') ? utmParams : undefined,
      postPurchaseEmailConfig: postPurchaseEmailConfig.enabled ? postPurchaseEmailConfig : undefined,
    };
    await onSubmit(formData);
  };
  
  const imageInputTabs: TabConfig[] = [
    { value: 'url', label: 'URL da Imagem', content: 
        <Input type="url" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); setImagePreviewUrl(e.target.value || null); notifyChange(); }} placeholder="https://exemplo.com/imagem.jpg" disabled={isSaving || isUploadingImage} icon={<LinkIcon className="h-5 w-5"/>}/> },
    { value: 'upload', label: 'Enviar Arquivo', content: 
        <Input type="file" accept="image/*" onChange={handleImageFileChange} disabled={isSaving || isUploadingImage} icon={<UploadIcon className="h-5 w-5"/>} /> },
  ];

  const handleCustomizationChange = <K extends keyof ProductCheckoutCustomization, V extends ProductCheckoutCustomization[K]>(field: K, value: V) => { setCheckoutCustomization(prev => ({ ...prev, [field]: value })); notifyChange(); };
  const handleCountdownTimerChange = <K extends keyof NonNullable<ProductCheckoutCustomization['countdownTimer']>>(field: K, value: NonNullable<ProductCheckoutCustomization['countdownTimer']>[K]) => { setCheckoutCustomization(prev => ({ ...prev, countdownTimer: { ...(prev.countdownTimer || defaultProductCheckoutCustomization.countdownTimer!), [field]: value } })); notifyChange(); };
  const handleUtmParamChange = (param: keyof UtmParams, value: string) => { setUtmParams(prev => ({ ...prev, [param]: value })); notifyChange(); };
  const handleSalesCopyChange = (html: string) => { handleCustomizationChange('salesCopy', html); }; 
  const addGuaranteeBadge = () => { handleCustomizationChange('guaranteeBadges', [...(checkoutCustomization.guaranteeBadges || []), { id: `badge_${Date.now()}`, imageUrl: '', altText: '' }]); };
  const updateGuaranteeBadge = (id: string, field: 'imageUrl' | 'altText', value: string) => { handleCustomizationChange('guaranteeBadges', (checkoutCustomization.guaranteeBadges || []).map(b => b.id === id ? { ...b, [field]: value } : b)); };
  const removeGuaranteeBadge = (id: string) => { handleCustomizationChange('guaranteeBadges', (checkoutCustomization.guaranteeBadges || []).filter(b => b.id !== id)); };
  
  const addTraditionalOrderBump = () => {
    if (traditionalOrderBumps.length < 5) {
      setTraditionalOrderBumps(prev => [...prev, { id: uuidv4(), productId: '', name: '', customPriceInCents: undefined }]);
      notifyChange();
    } else {
      showToast({ title: "Limite Atingido", description: "Você pode adicionar no máximo 5 order bumps tradicionais.", variant: "info" });
    }
  };

  const updateTraditionalOrderBump = (index: number, field: keyof TraditionalOrderBumpOffer, value: any) => {
    setTraditionalOrderBumps(prev => prev.map((bump, i) => {
      if (i === index) {
        if (field === 'productId' && value) {
          const selectedProd = availableProductsForOffers.find(p => p.id === value);
          return {
            ...bump,
            productId: value,
            name: selectedProd?.name || '',
            description: selectedProd?.description.substring(0,100) || '',
            customPriceInCents: selectedProd?.priceInCents,
            imageUrl: selectedProd?.imageUrl || ''
          };
        }
        if (field === 'customPriceInCents') {
            const priceNum = Math.round(parseFloat(String(value).replace(/\./g, '').replace(',', '.')) * 100);
            return { ...bump, customPriceInCents: isNaN(priceNum) ? undefined : priceNum };
        }
        return { ...bump, [field]: value };
      }
      return bump;
    }));
    notifyChange();
  };

  const removeTraditionalOrderBump = (index: number) => {
    setTraditionalOrderBumps(prev => prev.filter((_, i) => i !== index));
    notifyChange();
  };

  const handlePostClickOfferProductSelect = (selectedProdId: string) => {
    if (!selectedProdId) { setPostClickOffer(undefined); notifyChange(); return; }
    const selectedProductOffer = availableProductsForOffers.find(p => p.id === selectedProdId);
    if (!selectedProductOffer) { setPostClickOffer(undefined); notifyChange(); return; }
    const price = selectedProductOffer.priceInCents;
    setPostClickOffer({
      productId: selectedProductOffer.id,
      name: selectedProductOffer.name,
      description: postClickOfferCopySuggestions.descricao_modal[0].replace('{preco}', formatCurrency(price)),
      customPriceInCents: price,
      imageUrl: selectedProductOffer.imageUrl || selectedProductOffer.checkoutCustomization?.logoUrl || '',
      modalTitle: postClickOfferCopySuggestions.titulo_modal[0],
      modalAcceptButtonText: postClickOfferCopySuggestions.texto_botao_aceitar[0].replace('{preco}', formatCurrency(price)),
      modalDeclineButtonText: postClickOfferCopySuggestions.texto_botao_recusar[0],
    });
    setPostClickOfferTitleIndex(0); setPostClickOfferDescIndex(0);
    setPostClickOfferAcceptBtnIndex(0); setPostClickOfferDeclineBtnIndex(0);
    notifyChange();
  };

  const updatePostClickOfferField = (field: keyof PostClickOffer, value: any) => {
    setPostClickOffer(prev => {
      if (!prev) return undefined; 
      let newOffer = { ...prev };
      if (field === 'customPriceInCents') {
        const priceNum = Math.round(parseFloat(String(value).replace(/\./g, '').replace(',', '.')) * 100);
        const newPrice = isNaN(priceNum) ? prev.customPriceInCents : priceNum;
        const acceptButtonText = prev.modalAcceptButtonText || postClickOfferCopySuggestions.texto_botao_aceitar[postClickOfferAcceptBtnIndex];
        newOffer = { ...newOffer, customPriceInCents: newPrice, modalAcceptButtonText: acceptButtonText.replace(/{preco}|R\$\s*\d+,\d+/g, formatCurrency(newPrice || 0)) };
      } else if (field === 'modalAcceptButtonText' && typeof value === 'string') {
        newOffer = { ...newOffer, [field]: value.replace(/{preco}|R\$\s*\d+,\d+/g, formatCurrency(prev.customPriceInCents || 0)) };
      }
       else {
        newOffer = { ...newOffer, [field]: value };
      }
      return newOffer;
    });
    notifyChange();
  };
  
  const suggestCopyForPostClickOffer = (fieldKey: keyof PostClickOffer) => {
    if (!postClickOffer) return;
  
    let suggestionsArray: string[] = [];
    let currentIndex = 0;
    let setIndexFunction: React.Dispatch<React.SetStateAction<number>> = () => {};
  
    switch (fieldKey) {
      case 'modalTitle': suggestionsArray = postClickOfferCopySuggestions.titulo_modal; currentIndex = postClickOfferTitleIndex; setIndexFunction = setPostClickOfferTitleIndex; break;
      case 'description': suggestionsArray = postClickOfferCopySuggestions.descricao_modal; currentIndex = postClickOfferDescIndex; setIndexFunction = setPostClickOfferDescIndex; break;
      case 'modalAcceptButtonText': suggestionsArray = postClickOfferCopySuggestions.texto_botao_aceitar; currentIndex = postClickOfferAcceptBtnIndex; setIndexFunction = setPostClickOfferAcceptBtnIndex; break;
      case 'modalDeclineButtonText': suggestionsArray = postClickOfferCopySuggestions.texto_botao_recusar; currentIndex = postClickOfferDeclineBtnIndex; setIndexFunction = setPostClickOfferDeclineBtnIndex; break;
      default: return;
    }
  
    if (suggestionsArray.length === 0) return;
    const nextIndex = (currentIndex + 1) % suggestionsArray.length;
    let nextCopy = suggestionsArray[nextIndex];
    if (fieldKey === 'description' || fieldKey === 'modalAcceptButtonText') nextCopy = nextCopy.replace(/{preco}|R\$\s*\d+,\d+/g, formatCurrency(postClickOffer.customPriceInCents || 0));
    updatePostClickOfferField(fieldKey, nextCopy);
    setIndexFunction(nextIndex);
  };
  
  const removePostClickOffer = () => { setPostClickOffer(undefined); notifyChange(); };

  const handleUpsellProductSelect = (selectedProdId: string) => {
    if (!selectedProdId) { setUpsell(undefined); notifyChange(); return; }
    const selectedProductOffer = availableProductsForOffers.find(p => p.id === selectedProdId);
    if (!selectedProductOffer) { setUpsell(undefined); notifyChange(); return; }
    setUpsell({ productId: selectedProductOffer.id, name: selectedProductOffer.name, description: selectedProductOffer.description.substring(0,150), customPriceInCents: selectedProductOffer.priceInCents, imageUrl: selectedProductOffer.imageUrl || '' });
    notifyChange();
  };

  const updateUpsellOfferField = (field: keyof UpsellOffer, value: any) => {
    setUpsell(prev => {
        if (!prev) return undefined;
        if (field === 'customPriceInCents') {
            const priceNum = Math.round(parseFloat(String(value).replace(/\./g, '').replace(',', '.')) * 100);
            return { ...prev, customPriceInCents: isNaN(priceNum) ? prev.customPriceInCents : priceNum };
        }
        return { ...prev, [field]: value };
    });
    notifyChange();
  };
  const removeUpsellOffer = () => { setUpsell(undefined); notifyChange(); };

  const openCouponModal = (coupon?: Coupon) => { setEditingCoupon(coupon || null); setIsCouponModalOpen(true); };
  const closeCouponModal = () => { setEditingCoupon(null); setIsCouponModalOpen(false); };
  const saveCoupon = (couponData: Coupon) => { if (editingCoupon) setCoupons(prev => prev.map(c => c.id === couponData.id ? couponData : c)); else setCoupons(prev => [...prev, { ...couponData, id: `coupon_${Date.now()}` }]); closeCouponModal(); notifyChange(); };
  const deleteCoupon = (couponId: string) => { setCoupons(prev => prev.filter(c => c.id !== couponId)); notifyChange(); };

  const countdownDurationOptions = [ { label: 'Nenhum', value: "0" }, { label: '5 minutos', value: "5" }, { label: '10 minutos', value: "10" }, { label: '15 minutos', value: "15" }, { label: '20 minutos', value: "20" }, { label: '30 minutos', value: "30" }, { label: '60 minutos', value: "60" }, ].map(cd => ({ value: cd.value, label: cd.label }));
  
  const handlePostPurchaseEmailConfigChange = <K extends keyof PostPurchaseEmailConfig>(field: K, value: PostPurchaseEmailConfig[K]) => { setPostPurchaseEmailConfig(prev => ({...prev, [field]: value})); notifyChange(); };
  const handlePostPurchaseEmailBodyChange = (html: string) => { handlePostPurchaseEmailConfigChange('bodyHtml', html); };
  const postPurchaseDelayOptions = [ {value: "1", label: "1 Dia Após Compra"}, {value: "2", label: "2 Dias Após Compra"}, {value: "3", label: "3 Dias Após Compra"}, {value: "5", label: "5 Dias Após Compra"}, {value: "7", label: "7 Dias Após Compra"}, {value: "10", label: "10 Dias Após Compra"}, {value: "15", label: "15 Dias Após Compra"}, {value: "30", label: "30 Dias Após Compra"} ];


  const traditionalOrderBumpProductOptions = (currentIndex: number) => {
    const selectedProductIds = traditionalOrderBumps.map((bump, idx) => (idx !== currentIndex ? bump.productId : null)).filter(id => id !== null && id !== '');
    if (postClickOffer?.productId) selectedProductIds.push(postClickOffer.productId);
    if (upsell?.productId) selectedProductIds.push(upsell.productId);
    return availableProductsForOffers.filter(p => !selectedProductIds.includes(p.id)).map(p => ({ value: p.id, label: `${p.name} (R$ ${(p.priceInCents / 100).toFixed(2).replace('.', ',')})` }));
  };
  
  const postClickOfferProductOptions = () => {
      const selectedProductIds = traditionalOrderBumps.map(bump => bump.productId).filter(id => id !== null && id !== '');
      if (upsell?.productId) selectedProductIds.push(upsell.productId);
      return availableProductsForOffers.filter(p => !selectedProductIds.includes(p.id)).map(p => ({ value: p.id, label: `${p.name} (R$ ${(p.priceInCents / 100).toFixed(2).replace('.', ',')})` }));
  };

  const upsellProductOptions = () => {
      const selectedProductIds = traditionalOrderBumps.map(bump => bump.productId).filter(id => id !== null && id !== '');
      if (postClickOffer?.productId) selectedProductIds.push(postClickOffer.productId);
      return availableProductsForOffers.filter(p => !selectedProductIds.includes(p.id)).map(p => ({ value: p.id, label: `${p.name} (R$ ${(p.priceInCents / 100).toFixed(2).replace('.', ',')})` }));
  };

  const wrappedSetProductName = (val: string) => { setProductName(val); notifyChange(); };
  const wrappedSetDescription = (val: string) => { setDescription(val); notifyChange(); };
  const wrappedSetPrice = (val: string) => { setPrice(val); notifyChange(); };
  const wrappedSetDeliveryUrl = (val: string) => { setDeliveryUrl(val); notifyChange(); };
  const wrappedSetImageInputMode = (val: 'url' | 'upload') => { setImageInputMode(val); notifyChange(); };

  const formatCurrencyForInput = (valueInCents?: number) => {
    if (valueInCents === undefined || isNaN(valueInCents)) return '';
    return (valueInCents / 100).toFixed(2).replace('.', ',');
  };

  const postClickOfferValue = postClickOffer ? postClickOffer.productId : "";
  const upsellValue = upsell ? upsell.productId : "";


  const formTabs: TabConfig[] = [
    { value: 'general', label: <><ShoppingBagIcon className="h-5 w-5 mr-2"/>Informações Gerais</>, content: (
      <Card title="Detalhes do Produto">
        <div className="space-y-4">
          <Input label="Nome do Produto" name="productName" value={productName} onChange={(e) => wrappedSetProductName(e.target.value)} required placeholder="Ex: Curso de Marketing Digital Avançado" disabled={isSaving} />
          <Textarea label="Descrição" name="description" value={description} onChange={(e) => wrappedSetDescription(e.target.value)} required placeholder="Descreva seu produto em detalhes..." rows={5} disabled={isSaving}/>
          <Input label="Preço (R$)" name="price" type="text" value={price} onChange={(e) => wrappedSetPrice(e.target.value)} required placeholder="Ex: 197,00" disabled={isSaving}/>
          <div className="space-y-2"> <label className="block text-sm font-medium text-text-default">Imagem Principal do Produto</label> <Tabs tabs={imageInputTabs} defaultValue={imageInputMode} onValueChange={(val) => wrappedSetImageInputMode(val as 'url' | 'upload')} /> {imagePreviewUrl && <img src={imagePreviewUrl} alt="Prévia da Imagem" className="mt-2 max-h-48 w-auto rounded-lg border border-border-subtle shadow-sm"/>} {isUploadingImage && <div className="flex items-center text-sm text-accent-blue-neon"><LoadingSpinner size="sm" className="mr-2"/>Enviando imagem...</div>} </div>
          <Input label="URL de Entrega (Opcional)" name="deliveryUrl" type="url" value={deliveryUrl} onChange={(e) => wrappedSetDeliveryUrl(e.target.value)} placeholder="https://areademembros.com/acesso-curso" icon={<OpenLockIcon className="h-5 w-5 text-text-muted"/>} disabled={isSaving}/>
        </div>
      </Card>
    )},
    { value: 'checkout-appearance', label: <><PaintBrushIcon className="h-5 w-5 mr-2"/>Aparência do Checkout</>, content: (
      <Card title="Personalização Visual do Checkout">
        <div className="space-y-6">
          <div> <label className="block text-sm font-medium text-text-default mb-1.5">Cor Principal</label> <div className="grid grid-cols-5 gap-2 mt-1"> {COLOR_PALETTE_OPTIONS.map(color => ( <button key={color.value} type="button" title={color.name} onClick={() => handleCustomizationChange('primaryColor', color.value)} className={`h-8 w-full rounded-lg border-2 transition-all duration-150 ${checkoutCustomization.primaryColor === color.value ? 'ring-2 ring-offset-2 ring-accent-blue-neon border-accent-blue-neon ring-offset-bg-surface' : 'border-border-subtle hover:border-accent-blue-neon/70'}`} style={{ backgroundColor: color.value }} disabled={isSaving} /> ))} </div> <Input name="customColor" type="color" value={checkoutCustomization.primaryColor || '#0D9488'} onChange={(e) => handleCustomizationChange('primaryColor', e.target.value)} className="mt-2 h-10 w-full sm:w-auto bg-bg-surface border-border-subtle" disabled={isSaving}/> </div>
          <div> <Select label="Tema da Página de Checkout" options={[{value: 'light', label: 'Claro (Padrão)'}, {value: 'dark', label: 'Escuro (Reimagined)'}]} value={checkoutCustomization.theme || 'light'} onValueChange={(value) => handleCustomizationChange('theme', value as 'light' | 'dark')} disabled={isSaving}/> </div>
          <ToggleSwitch label="Exibir Nome do Produto no Cabeçalho do Checkout" enabled={checkoutCustomization.showProductName !== undefined ? checkoutCustomization.showProductName : true} onEnabledChange={(isEnabled) => handleCustomizationChange('showProductName', isEnabled)} disabled={isSaving}/>
          <Input label="URL do Logo Pequeno (Exibido no Checkout)" name="logoUrl" value={checkoutCustomization.logoUrl || ''} onChange={(e) => handleCustomizationChange('logoUrl', e.target.value)} placeholder="https://exemplo.com/logo-pequeno.png" disabled={isSaving} icon={<ViewIcon className="h-5 w-5 text-text-muted"/>}/>
          <Input label="URL do Vídeo (YouTube Embed)" name="videoUrl" value={checkoutCustomization.videoUrl || ''} onChange={(e) => handleCustomizationChange('videoUrl', e.target.value)} placeholder="https://youtube.com/embed/seu-video" disabled={isSaving} icon={<ViewIcon className="h-5 w-5 text-text-muted"/>}/>
        </div>
      </Card>
    )},
    { value: 'checkout-content', label: <><GiftIcon className="h-5 w-5 mr-2"/>Conteúdo e Escassez</>, content: (
      <Card title="Conteúdo Adicional e Escassez no Checkout">
        <div className="space-y-6">
          <div> <label className="block text-sm font-medium text-text-default mb-1.5">Copy de Vendas (HTML)</label> <MiniEditor value={checkoutCustomization.salesCopy || ''} onChange={handleSalesCopyChange} placeholder="Sua copy persuasiva para o checkout..."/> </div>
          <div> <h4 className="text-sm font-medium text-text-default mb-2">Selos de Garantia</h4> <AnimatePresence> {(checkoutCustomization.guaranteeBadges || []).map((badge, index) => ( <motion.div key={badge.id} variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="mb-3"> <Card className="p-3 bg-bg-surface-opaque border-border-subtle"> <Input label={`URL Imagem Selo ${index + 1}`} value={badge.imageUrl} onChange={(e) => updateGuaranteeBadge(badge.id, 'imageUrl', e.target.value)} placeholder="https://exemplo.com/selo.png" className="mb-2" disabled={isSaving}/> <Input label={`Texto Alt Selo ${index + 1}`} value={badge.altText} onChange={(e) => updateGuaranteeBadge(badge.id, 'altText', e.target.value)} placeholder="Descrição do selo" className="mb-2" disabled={isSaving}/> <Button type="button" variant="danger" size="sm" onClick={() => removeGuaranteeBadge(badge.id)} leftIcon={<TrashIcon className="h-4 w-4"/>} disabled={isSaving}>Remover</Button> </Card> </motion.div> ))} </AnimatePresence> <Button type="button" variant="secondary" size="sm" onClick={addGuaranteeBadge} leftIcon={<PlusIcon className="h-4 w-4" />} disabled={isSaving}>Adicionar Selo</Button> </div>
          <div className="pt-4 border-t border-border-subtle"> <h4 className="text-md font-semibold text-text-strong mb-3">Cronômetro de Escassez</h4> <ToggleSwitch label="Habilitar Cronômetro" enabled={checkoutCustomization.countdownTimer?.enabled || false} onEnabledChange={(isEnabled) => handleCountdownTimerChange('enabled', isEnabled)} disabled={isSaving}/> {checkoutCustomization.countdownTimer?.enabled && ( <motion.div variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="space-y-3 mt-3 pl-3 border-l-2 border-border-interactive/50"> <Select label="Duração do Cronômetro" options={countdownDurationOptions} value={String(checkoutCustomization.countdownTimer.durationMinutes || 15)} onValueChange={(value) => handleCountdownTimerChange('durationMinutes', parseInt(value))} disabled={isSaving} /> <Textarea label="Mensagem Antes do Cronômetro (Opcional)" value={checkoutCustomization.countdownTimer.messageBefore || ''} onChange={(e) => handleCountdownTimerChange('messageBefore', e.target.value)} rows={2} disabled={isSaving}/> <Textarea label="Mensagem Após Expirar (Opcional)" value={checkoutCustomization.countdownTimer.messageAfter || ''} onChange={(e) => handleCountdownTimerChange('messageAfter', e.target.value)} rows={2} disabled={isSaving}/> <div className="flex space-x-3"> <Input label="Cor Fundo" type="color" value={checkoutCustomization.countdownTimer.backgroundColor || '#EF4444'} onChange={(e) => handleCountdownTimerChange('backgroundColor', e.target.value)} className="h-10 w-1/2 bg-bg-surface border-border-subtle" disabled={isSaving}/> <Input label="Cor Texto" type="color" value={checkoutCustomization.countdownTimer.textColor || '#FFFFFF'} onChange={(e) => handleCountdownTimerChange('textColor', e.target.value)} className="h-10 w-1/2 bg-bg-surface border-border-subtle" disabled={isSaving}/> </div> </motion.div> )} </div>
        </div>
      </Card>
    )},
    { value: 'offers', label: <><PriceTagIcon className="h-5 w-5 mr-2"/>Ofertas Especiais</>, content: (
      <div className="space-y-6">
        <Card title="Order Bumps Tradicionais (Checkbox - até 5)"> <ToggleSwitch label="Habilitar animação de destaque nos Order Bumps?" enabled={checkoutCustomization.animateTraditionalOrderBumps ?? true} onEnabledChange={(isEnabled) => handleCustomizationChange('animateTraditionalOrderBumps', isEnabled)} disabled={isSaving} className="mb-4"/> <AnimatePresence> {traditionalOrderBumps.map((bump, index) => ( <motion.div key={bump.id} variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="space-y-3 p-4 border border-border-subtle rounded-xl bg-bg-surface-opaque mb-4"> <h4 className="text-sm font-semibold text-text-strong">Order Bump {index + 1}</h4> <Combobox label="Selecionar Produto:" options={traditionalOrderBumpProductOptions(index)} value={bump.productId} onValueChange={(value) => updateTraditionalOrderBump(index, 'productId', value)} placeholder="Escolha um produto" emptyMessage="Nenhum produto disponível." disabled={isSaving}/> {bump.productId && ( <> <Input label="Nome/Label no Checkout" value={bump.name} onChange={(e) => updateTraditionalOrderBump(index, 'name', e.target.value)} placeholder="Ex: Ebook Exclusivo" disabled={isSaving}/> <Textarea label="Descrição (Opcional)" value={bump.description || ''} onChange={(e) => updateTraditionalOrderBump(index, 'description', e.target.value)} placeholder="Pequena descrição da oferta" rows={2} disabled={isSaving}/> <Input label="Preço Customizado (R$)" type="text" value={formatCurrencyForInput(bump.customPriceInCents)} onChange={(e) => updateTraditionalOrderBump(index, 'customPriceInCents', e.target.value)} placeholder="Preço original se vazio" disabled={isSaving}/> <Input label="URL da Imagem (Opcional)" type="url" value={bump.imageUrl || ''} onChange={(e) => updateTraditionalOrderBump(index, 'imageUrl', e.target.value)} placeholder="https://exemplo.com/imagem-oferta.jpg" disabled={isSaving}/> </> )} <Button type="button" variant="danger" size="sm" onClick={() => removeTraditionalOrderBump(index)} disabled={isSaving}>Remover Order Bump {index + 1}</Button> </motion.div> ))} </AnimatePresence> {traditionalOrderBumps.length < 5 && ( <Button type="button" variant="secondary" onClick={addTraditionalOrderBump} leftIcon={<PlusIcon />} disabled={isSaving}>Adicionar Order Bump</Button> )} </Card>
        <Card title="Oferta Adicional Pós-Clique (Modal - 1 por produto)"> {postClickOffer ? ( <motion.div variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="space-y-3 p-3 border border-border-subtle rounded-xl bg-bg-surface-opaque"> <p className="font-medium text-text-strong">Produto Selecionado: <span className="text-primary">{availableProductsForOffers.find(p=>p.id === postClickOffer.productId)?.name || postClickOffer.name}</span></p> <Input label="Título no Modal" value={postClickOffer.modalTitle || ''} onChange={(e) => updatePostClickOfferField('modalTitle', e.target.value)} placeholder="Ex: 🔥 OFERTA ÚNICA! 🔥" disabled={isSaving} rightElement={ <button type="button" onClick={() => suggestCopyForPostClickOffer('modalTitle')} className="p-1 hover:bg-white/10 rounded-md" title="Sugerir copy"><SparklesIcon className="h-5 w-5 text-accent-gold"/></button> } /> <div> <label className="block text-sm font-medium text-text-default mb-1.5">Descrição no Modal</label> <MiniEditor value={postClickOffer.description || ''} onChange={(html) => updatePostClickOfferField('description', html)} placeholder="Detalhes da sua oferta irresistível..."/> <button type="button" onClick={() => suggestCopyForPostClickOffer('description')} className="mt-1 p-1 text-xs text-accent-gold hover:bg-white/10 rounded-md flex items-center" title="Sugerir copy"><SparklesIcon className="h-4 w-4 mr-1"/>Sugerir descrição</button> </div> <Input label="Preço Customizado (R$)" type="text" value={formatCurrencyForInput(postClickOffer.customPriceInCents)} onChange={(e) => updatePostClickOfferField('customPriceInCents', e.target.value)} placeholder="Preço original se vazio" disabled={isSaving}/> <Input label="URL da Imagem (Opcional)" type="url" value={postClickOffer.imageUrl || ''} onChange={(e) => updatePostClickOfferField('imageUrl', e.target.value)} placeholder="https://exemplo.com/imagem-modal.jpg" disabled={isSaving}/> <Input label="Texto Botão Aceitar" value={postClickOffer.modalAcceptButtonText || ''} onChange={(e) => updatePostClickOfferField('modalAcceptButtonText', e.target.value)} placeholder="Ex: Sim, Quero Adicionar!" disabled={isSaving} rightElement={ <button type="button" onClick={() => suggestCopyForPostClickOffer('modalAcceptButtonText')} className="p-1 hover:bg-white/10 rounded-md" title="Sugerir copy"><SparklesIcon className="h-5 w-5 text-accent-gold"/></button> }/> <Input label="Texto Botão Recusar" value={postClickOffer.modalDeclineButtonText || ''} onChange={(e) => updatePostClickOfferField('modalDeclineButtonText', e.target.value)} placeholder="Ex: Não, Obrigado." disabled={isSaving} rightElement={ <button type="button" onClick={() => suggestCopyForPostClickOffer('modalDeclineButtonText')} className="p-1 hover:bg-white/10 rounded-md" title="Sugerir copy"><SparklesIcon className="h-5 w-5 text-accent-gold"/></button> }/> <Button type="button" variant="danger" size="sm" onClick={removePostClickOffer} disabled={isSaving}>Remover Oferta Pós-Clique</Button> </motion.div> ) : ( <div className="space-y-2"> <Combobox label="Selecionar Produto para Oferta Pós-Clique:" options={postClickOfferProductOptions()} value={postClickOfferValue} onValueChange={handlePostClickOfferProductSelect} placeholder="Nenhum (Sem Oferta Pós-Clique)" emptyMessage="Nenhum produto disponível." disabled={isSaving || availableProductsForOffers.length === 0}/> {availableProductsForOffers.length === 0 && <p className="text-xs text-text-muted mt-1">Crie outros produtos para selecioná-los aqui.</p>} </div> )} </Card>
        <Card title="Oferta Pós-Compra (Upsell na Página de Obrigado)"> {upsell ? ( <motion.div variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="space-y-3 p-3 border border-border-subtle rounded-xl bg-bg-surface-opaque"> <p className="font-medium text-text-strong">Produto: <span className="text-primary">{availableProductsForOffers.find(p=>p.id === upsell.productId)?.name || upsell.name}</span></p> <Textarea label="Descrição da Oferta de Upsell" value={upsell.description} onChange={(e) => updateUpsellOfferField('description', e.target.value)} placeholder="Descreva a oferta de upsell..." rows={3} disabled={isSaving}/> <Input label="Preço Customizado (R$)" type="text" value={formatCurrencyForInput(upsell.customPriceInCents)} onChange={(e) => updateUpsellOfferField('customPriceInCents', e.target.value)} placeholder="Preço original se vazio" disabled={isSaving}/> <Input label="URL da Imagem (Opcional)" type="url" value={upsell.imageUrl || ''} onChange={(e) => updateUpsellOfferField('imageUrl', e.target.value)} placeholder="https://exemplo.com/imagem-upsell.jpg" disabled={isSaving}/> <Button type="button" variant="danger" size="sm" onClick={removeUpsellOffer} disabled={isSaving}>Remover Upsell</Button> </motion.div> ) : ( <div className="space-y-2"> <Combobox label="Selecionar Produto para Upsell:" options={upsellProductOptions()} value={upsellValue} onValueChange={handleUpsellProductSelect} placeholder="Nenhum (Sem Upsell)" emptyMessage="Nenhum produto disponível." disabled={isSaving || availableProductsForOffers.length === 0}/> {availableProductsForOffers.length === 0 && <p className="text-xs text-text-muted mt-1">Crie outros produtos para selecioná-los aqui.</p>} </div> )} </Card>
      </div>
    )},
    { value: 'email-pos-compra', label: <><EnvelopeIcon className="h-5 w-5 mr-2"/>E-mail Pós-Compra</>, content: (
      <Card title="Configuração do E-mail Pós-Compra">
        <div className="space-y-4">
          <ToggleSwitch
            label="Habilitar E-mail Pós-Compra para este produto?"
            enabled={postPurchaseEmailConfig.enabled}
            onEnabledChange={(isEnabled) => handlePostPurchaseEmailConfigChange('enabled', isEnabled)}
            disabled={isSaving}
          />
          {postPurchaseEmailConfig.enabled && (
            <motion.div variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="space-y-4 mt-3 pl-3 border-l-2 border-border-interactive/50">
              <Select
                label="Atraso para Envio:"
                options={postPurchaseDelayOptions}
                value={String(postPurchaseEmailConfig.delayDays)}
                onValueChange={(value) => handlePostPurchaseEmailConfigChange('delayDays', parseInt(value, 10))}
                disabled={isSaving}
              />
              <Input
                label="Assunto do E-mail"
                value={postPurchaseEmailConfig.subject}
                onChange={(e) => handlePostPurchaseEmailConfigChange('subject', e.target.value)}
                placeholder="Ex: Informações importantes sobre seu produto {{product_name}}"
                disabled={isSaving}
              />
              <div>
                <label className="block text-sm font-medium text-text-default mb-1.5">Corpo do E-mail (HTML)</label>
                <MiniEditor
                  value={postPurchaseEmailConfig.bodyHtml}
                  onChange={handlePostPurchaseEmailBodyChange}
                  placeholder={'<p>Olá {{customer_name}}, obrigado por comprar {{product_name}}!</p>'}
                />
                <p className="text-xs text-text-muted mt-2">{'Placeholders disponíveis: {{customer_name}}, {{product_name}}, {{order_id}}, {{product_delivery_url}}, {{shop_name}}.'}</p>
              </div>
            </motion.div>
          )}
        </div>
      </Card>
    )},
    { value: 'marketing', label: <><UtmIcon className="h-5 w-5 mr-2"/>Marketing e Cupons</>, content: (
      <div className="space-y-6">
        <Card title="Parâmetros UTM Padrão"> <div className="space-y-4"> <Input label="utm_source" name="utm_source" value={utmParams.source || ''} onChange={(e) => handleUtmParamChange('source', e.target.value)} placeholder="Ex: google, facebook" icon={<UtmIcon className="h-5 w-5 text-text-muted"/>} disabled={isSaving}/> <Input label="utm_medium" name="utm_medium" value={utmParams.medium || ''} onChange={(e) => handleUtmParamChange('medium', e.target.value)} placeholder="Ex: cpc, email" icon={<UtmIcon className="h-5 w-5 text-text-muted"/>} disabled={isSaving}/> <Input label="utm_campaign" name="utm_campaign" value={utmParams.campaign || ''} onChange={(e) => handleUtmParamChange('campaign', e.target.value)} placeholder="Ex: promocao_natal" icon={<UtmIcon className="h-5 w-5 text-text-muted"/>} disabled={isSaving}/> <Input label="utm_term (Opcional)" name="utm_term" value={utmParams.term || ''} onChange={(e) => handleUtmParamChange('term', e.target.value)} placeholder="Ex: palavra_chave" icon={<UtmIcon className="h-5 w-5 text-text-muted"/>} disabled={isSaving}/> <Input label="utm_content (Opcional)" name="utm_content" value={utmParams.content || ''} onChange={(e) => handleUtmParamChange('content', e.target.value)} placeholder="Ex: banner_azul" icon={<UtmIcon className="h-5 w-5 text-text-muted"/>} disabled={isSaving}/> </div> </Card>
        <Card title="Cupons de Desconto"> <div className="space-y-3"> {coupons.length === 0 && <p className="text-sm text-text-muted">Nenhum cupom adicionado.</p>} <AnimatePresence> {coupons.map(coupon => ( <motion.div key={coupon.id} variants={listItemVariants} initial="initial" animate="animate" exit="exit" layout className="p-3 border border-border-subtle rounded-xl bg-bg-surface-opaque flex justify-between items-center"> <div><p className="font-semibold text-primary">{coupon.code}</p> <p className="text-xs text-text-default"> {coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `R$ ${(coupon.discountValue/100).toFixed(2)} OFF`} {coupon.isAutomatic && <span className="ml-1 text-status-success text-xs">(Automático)</span>} {!coupon.isActive && <span className="ml-1 text-status-warning text-xs">(Inativo)</span>} </p> {coupon.description && <p className="text-xs text-text-muted italic mt-0.5">"{coupon.description}"</p>} </div> <div className="space-x-1"> <Button type="button" variant="ghost" size="sm" onClick={() => openCouponModal(coupon)} disabled={isSaving}>Editar</Button> <Button type="button" variant="ghost" size="sm" onClick={() => deleteCoupon(coupon.id)} className="text-status-error hover:text-opacity-80" disabled={isSaving}><TrashIcon className="h-4 w-4"/></Button> </div> </motion.div> ))} </AnimatePresence> <Button type="button" variant="secondary" onClick={() => openCouponModal()} leftIcon={<PlusIcon className="h-5 w-5"/>} className="w-full" disabled={isSaving}>Adicionar Cupom</Button> </div> </Card>
      </div>
    )},
  ];

  return (
    <form onSubmit={handleInternalSubmit} id={formId} ref={formRef}>
      <Tabs tabs={formTabs} defaultValue="general" className="w-full" />
      {isCouponModalOpen && <CouponFormModal isOpen={isCouponModalOpen} onClose={closeCouponModal} onSave={saveCoupon} existingCoupon={editingCoupon}/> }
    </form>
  );
};
