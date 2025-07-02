
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { settingsService } from '@/services/settingsService';
import { AppSettings, NotificationSettings, WhatsappTemplates } from '@/types';
import { CogIcon, COLOR_PALETTE_OPTIONS, InformationCircleIcon } from '../constants.tsx';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/contexts/ToastContext';
import { Tabs, TabConfig } from '@/components/ui/Tabs'; 
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Accordion } from '@/components/ui/Accordion';

const initialAppSettings: AppSettings = {
  checkoutIdentity: {
    logoUrl: '',
    faviconUrl: '',
    brandColor: '#0D9488',
  },
  customDomain: '',
  smtpSettings: {
    host: '',
    port: 587,
    user: '',
    pass: '',
  },
  apiTokens: { // Kept for structure, but managed in IntegracoesPage
    pushinPay: '',
    utmify: '',
    pushinPayEnabled: false,
    utmifyEnabled: false,
  },
  pixelIntegrations: [], // Kept for structure, but managed in IntegracoesPage
  abandonedCartRecoveryConfig: {
    enabled: false,
    delayMinutes: 360,
    subject: 'Você esqueceu algo no seu carrinho!',
    bodyHtml: '<p>Recupere seu carrinho.</p>'
  },
  whatsappTemplates: { // Default WhatsApp templates
    saleApproved: {
      enabled: true,
      message: "Olá {{customer_name}}! Seu pedido #{{order_id}} foi aprovado! Acesse seus produtos aqui: {{product_delivery_links_whatsapp}}. Qualquer dúvida, estamos à disposição!",
      placeholders: ["{{customer_name}}", "{{order_id}}", "{{product_delivery_links_whatsapp}}", "{{shop_name}}", "{{pix_copy_paste_code}}", "{{pix_qr_code_image_url}}"]
    },
    abandonedCart: {
      enabled: true,
      message: "Olá {{customer_name}}! Notamos que você deixou alguns itens no seu carrinho em {{shop_name}}. Que tal finalizar sua compra agora? {{abandoned_checkout_link}}",
      placeholders: ["{{customer_name}}", "{{shop_name}}", "{{abandoned_checkout_link}}", "{{product_names}}"]
    }
  } as WhatsappTemplates, // Explicitly cast to WhatsappTemplates
  notificationSettings: {
    notifyOnAbandonedCart: true,
    notifyOnOrderPlaced: true,
    notifyOnSaleApproved: true,
    playSaleSound: true,
  }
};

const ConfiguracoesPage: React.FC = () => {
  const { appSettings, isLoading: isDataLoading, error: dataError, refreshData } = useData();
  const [settings, setSettings] = useState<AppSettings>(initialAppSettings);
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsappTemplates>(initialAppSettings.whatsappTemplates || { saleApproved: { enabled: false, message: "", placeholders: [] }, abandonedCart: { enabled: false, message: "", placeholders: [] } });
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (appSettings) {
        setSettings({ ...initialAppSettings, ...appSettings });
        setWhatsappTemplates(appSettings.whatsappTemplates || { saleApproved: { enabled: false, message: "", placeholders: [] }, abandonedCart: { enabled: false, message: "", placeholders: [] } });
    }
    if (dataError) {
        showToast({ title: "Erro ao Carregar", description: dataError, variant: "error" });
    }
  }, [appSettings, dataError, showToast]);


  const handleInputChange = (section: keyof AppSettings, field: string, value: any) => {
    setSettings(prev => {
      const sectionObject = prev[section] as Record<string, any>;
      return {
        ...prev,
        [section]: {
          ...sectionObject,
          [field]: value,
        },
      };
    });
  };

  const handleDirectFieldChange = (field: keyof Pick<AppSettings, 'customDomain'>, value: any) => {
    setSettings(prev => ({...prev, [field]: value}));
  }
  
  const handleNotificationChange = <K extends keyof NotificationSettings>(field: K, value: NotificationSettings[K]) => {
    setSettings(prev => ({
        ...prev,
        notificationSettings: {
            ...(prev.notificationSettings || initialAppSettings.notificationSettings!),
            [field]: value,
        },
    }));
  };

  const handleWhatsappTemplateChange = (type: keyof WhatsappTemplates, field: 'enabled' | 'message', value: boolean | string) => {
    setWhatsappTemplates((prev: WhatsappTemplates) => ({
      ...prev,
      [type]: {
        ...(prev[type] || {}),
        [field]: value,
      },
    }));
  };

  const renderWhatsappTemplatesTab = () => {
    return (
      <Card title="Mensagens Padrão de WhatsApp">
        <div className="space-y-6">
          <p className="text-sm text-text-muted">
            Configure as mensagens automáticas de WhatsApp que serão enviadas em diferentes eventos.
            Use os placeholders disponíveis para personalizar as mensagens.
          </p>

          <Accordion title="Mensagem de Venda Aprovada">
            <div className="space-y-4">
              <ToggleSwitch
                label="Habilitar mensagem de venda aprovada"
                enabled={whatsappTemplates.saleApproved.enabled}
                onEnabledChange={(val) => handleWhatsappTemplateChange('saleApproved', 'enabled', val)}
                disabled={isSaving}
              />
              <Input
                label="Mensagem"
                value={whatsappTemplates.saleApproved.message}
                onChange={(e) => handleWhatsappTemplateChange('saleApproved', 'message', e.target.value)}
                placeholder="Sua mensagem de venda aprovada"
                disabled={isSaving}
              />
              <p className="text-xs text-text-muted mt-2">
                Placeholders disponíveis: {whatsappTemplates.saleApproved.placeholders.join(', ')}
              </p>
            </div>
          </Accordion>

          <Accordion title="Mensagem de Carrinho Abandonado">
            <div className="space-y-4">
              <ToggleSwitch
                label="Habilitar mensagem de carrinho abandonado"
                enabled={whatsappTemplates.abandonedCart.enabled}
                onEnabledChange={(val) => handleWhatsappTemplateChange('abandonedCart', 'enabled', val)}
                disabled={isSaving}
              />
              <Input
                label="Mensagem"
                value={whatsappTemplates.abandonedCart.message}
                onChange={(e) => handleWhatsappTemplateChange('abandonedCart', 'message', e.target.value)}
                placeholder="Sua mensagem de carrinho abandonado"
                disabled={isSaving}
              />
              <p className="text-xs text-text-muted mt-2">
                Placeholders disponíveis: {whatsappTemplates.abandonedCart.placeholders.join(', ')}
              </p>
            </div>
          </Accordion>
        </div>
      </Card>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const settingsToSave: Partial<AppSettings> = {
        customDomain: settings.customDomain,
        checkoutIdentity: settings.checkoutIdentity,
        smtpSettings: settings.smtpSettings,
        notificationSettings: settings.notificationSettings,
        whatsappTemplates: whatsappTemplates,
      };

      await settingsService.saveAppSettings(settingsToSave);
      await refreshData(); // Refresh data in context
      showToast({ title: "Sucesso!", description: "Configurações salvas com sucesso!", variant: "success" });
    } catch (err: any) {
      showToast({ title: "Erro ao Salvar", description: err.message || 'Falha ao salvar configurações.', variant: "error" });
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const tabsConfig: TabConfig[] = [
    {
      value: 'identity',
      label: 'Identidade Visual',
      content: (
        <Card title="Identidade Visual Padrão do Checkout">
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Estas configurações serão usadas como padrão para seus checkouts, caso um produto específico não tenha sua própria personalização.
            </p>
            <Input
              label="URL do Logo Padrão (Checkout)"
              name="logoUrl"
              type="url"
              value={settings.checkoutIdentity?.logoUrl || ''}
              onChange={(e) => handleInputChange('checkoutIdentity', 'logoUrl', e.target.value)}
              placeholder="https://suamarca.com/logo.png"
              disabled={isSaving}
            />
            <Input
              label="URL do Favicon Padrão (Checkout)"
              name="faviconUrl"
              type="url"
              value={settings.checkoutIdentity?.faviconUrl || ''}
              onChange={(e) => handleInputChange('checkoutIdentity', 'faviconUrl', e.target.value)}
              placeholder="https://suamarca.com/favicon.ico"
              disabled={isSaving}
            />
            <div>
              <label className="block text-sm font-medium text-text-default mb-1.5">Cor da Marca Padrão (Checkout)</label>
              <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-2 mb-2">
                {COLOR_PALETTE_OPTIONS.map(colorOption => (
                  <button
                    key={colorOption.value}
                    type="button"
                    title={colorOption.name}
                    onClick={() => handleInputChange('checkoutIdentity', 'brandColor', colorOption.value)}
                    className={`h-8 w-full rounded-lg border-2 transition-all duration-150
                                ${settings.checkoutIdentity?.brandColor === colorOption.value
                                  ? 'ring-2 ring-offset-2 ring-accent-blue-neon border-accent-blue-neon ring-offset-bg-surface'
                                  : 'border-border-subtle hover:border-accent-blue-neon/70'
                                }`}
                    style={{ backgroundColor: colorOption.value }}
                    disabled={isSaving}
                  />
                ))}
              </div>
              <Input
                name="brandColor"
                type="color"
                value={settings.checkoutIdentity?.brandColor || '#0D9488'}
                onChange={(e) => handleInputChange('checkoutIdentity', 'brandColor', e.target.value)}
                className="mt-2 h-10 w-full sm:w-auto bg-bg-surface border-border-subtle"
                disabled={isSaving}
              />
            </div>
          </div>
        </Card>
      )
    },
    {
      value: 'domain',
      label: 'Domínio',
      content: (
        <Card title="Domínio Personalizado (Em Breve)">
          <div className="space-y-4">
            <Input
              label="Seu Domínio Personalizado"
              name="customDomain"
              type="text"
              value={settings.customDomain || ''}
              onChange={(e) => handleDirectFieldChange('customDomain', e.target.value)}
              placeholder="Ex: checkout.suamarca.com"
              disabled={true || isSaving} 
            />
            <div className="flex items-start p-3 bg-bg-main border border-border-subtle rounded-lg">
              <InformationCircleIcon className="h-5 w-5 text-accent-blue-neon mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-text-muted">
                A funcionalidade de domínio personalizado está em desenvolvimento. Em breve você poderá configurar seu próprio domínio para os checkouts.
              </p>
            </div>
          </div>
        </Card>
      )
    },
    {
      value: 'smtp',
      label: 'SMTP',
      content: (
        <Card title="Configurações de SMTP (Envio de E-mails)">
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Configure seu próprio servidor SMTP para enviar e-mails transacionais (confirmação de compra, recuperação de senha, etc.) usando sua identidade.
            </p>
            <Input
              label="Servidor SMTP (Host)"
              name="smtpHost"
              type="text"
              value={settings.smtpSettings?.host || ''}
              onChange={(e) => handleInputChange('smtpSettings', 'host', e.target.value)}
              placeholder="Ex: smtp.seuprovedor.com"
              disabled={isSaving}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Porta SMTP"
                name="smtpPort"
                type="number"
                value={settings.smtpSettings?.port || ''}
                onChange={(e) => handleInputChange('smtpSettings', 'port', parseInt(e.target.value, 10) || 0)}
                placeholder="Ex: 587"
                disabled={isSaving}
              />
              <Input
                label="Usuário SMTP"
                name="smtpUser"
                type="text"
                value={settings.smtpSettings?.user || ''}
                onChange={(e) => handleInputChange('smtpSettings', 'user', e.target.value)}
                placeholder="Seu e-mail ou usuário SMTP"
                disabled={isSaving}
                autoComplete="username"
              />
              <Input
                label="Senha SMTP"
                name="smtpPass"
                type="password"
                value={settings.smtpSettings?.pass || ''}
                onChange={(e) => handleInputChange('smtpSettings', 'pass', e.target.value)}
                placeholder="••••••••"
                disabled={isSaving}
                autoComplete="new-password"
              />
            </div>
             <div className="flex items-start p-3 bg-bg-main border border-border-subtle rounded-lg">
              <InformationCircleIcon className="h-5 w-5 text-accent-blue-neon mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-text-muted">
                Deixar em branco para usar o sistema de e-mail padrão da plataforma. Se preenchido, certifique-se de que as credenciais estão corretas para evitar falhas no envio de e-mails importantes.
              </p>
            </div>
          </div>
        </Card>
      )
    },
    {
      value: 'notifications',
      label: 'Notificações',
      content: (
        <Card title="Notificações em Tempo Real">
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Escolha quais eventos em tempo real devem gerar uma notificação no painel.
            </p>
            <div className="space-y-5 pt-4">
              <ToggleSwitch
                label="Pedido Realizado"
                enabled={settings.notificationSettings?.notifyOnOrderPlaced ?? true}
                onEnabledChange={(val) => handleNotificationChange('notifyOnOrderPlaced', val)}
                disabled={isSaving}
              />
              <ToggleSwitch
                label="Venda Aprovada"
                enabled={settings.notificationSettings?.notifyOnSaleApproved ?? true}
                onEnabledChange={(val) => handleNotificationChange('notifyOnSaleApproved', val)}
                disabled={isSaving}
              />
              <div className="pl-6">
                <ToggleSwitch
                  label="Tocar som de venda aprovada (cha-ching!)"
                  enabled={settings.notificationSettings?.playSaleSound ?? true}
                  onEnabledChange={(val) => handleNotificationChange('playSaleSound', val)}
                  disabled={isSaving || !(settings.notificationSettings?.notifyOnSaleApproved ?? true)}
                  size="sm"
                />
              </div>
              <ToggleSwitch
                label="Carrinho Abandonado"
                enabled={settings.notificationSettings?.notifyOnAbandonedCart ?? true}
                onEnabledChange={(val) => handleNotificationChange('notifyOnAbandonedCart', val)}
                disabled={isSaving}
              />
            </div>
          </div>
        </Card>
      )
    },
    {
      value: 'whatsapp',
      label: 'WhatsApp',
      content: renderWhatsappTemplatesTab()
    }
  ];


  if (isDataLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <LoadingSpinner size="lg" />
        <p className="ml-3 text-text-muted">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-text-default">
      <div className="flex items-center space-x-3">
        <CogIcon className="h-8 w-8 text-accent-blue-neon" />
        <h1 className="text-3xl font-display font-bold text-text-strong">Configurações da Conta</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs tabs={tabsConfig} defaultValue="identity" className="w-full" />
        
        <div className="mt-8 flex justify-end pt-6 border-t border-border-subtle">
          <Button type="submit" variant="primary" isLoading={isSaving} size="lg" disabled={isSaving}>
            Salvar Alterações
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ConfiguracoesPage;
