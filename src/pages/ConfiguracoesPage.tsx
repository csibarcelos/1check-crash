
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { settingsService } from '@/services/settingsService';
import { AppSettings } from '@/types';
import { CogIcon, COLOR_PALETTE_OPTIONS, InformationCircleIcon } from '../constants.tsx';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Tabs, TabConfig } from '@/components/ui/Tabs'; 

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
  apiTokens: { // Mantido para estrutura, mas gerenciado em IntegracoesPage
    pushinPay: '',
    utmify: '',
    pushinPayEnabled: false,
    utmifyEnabled: false,
  },
  pixelIntegrations: [], // Mantido para estrutura, mas gerenciado em IntegracoesPage
  abandonedCartRecoveryConfig: { // Adicionado com defaults
    enabled: false,
    delayHours: 6,
    subject: 'Você esqueceu algo no seu carrinho!',
    bodyHtml: '<p>Olá {{customer_name}},</p><p>Notamos que você deixou alguns itens no seu carrinho. Que tal finalizar sua compra?</p><p><a href="{{abandoned_checkout_link}}">Clique aqui para voltar ao checkout</a></p><p>Produto: {{product_name}}</p>',
  }
};

const ConfiguracoesPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(initialAppSettings);
  const [pageLoading, setPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { accessToken, isLoading: authIsLoading } = useAuth();
  const { showToast } = useToast();

  const fetchSettings = useCallback(async () => {
    if (!accessToken) {
      setPageLoading(false);
      showToast({ title: "Erro de Autenticação", description: "Autenticação necessária para carregar configurações.", variant: "error" });
      return;
    }
    try {
      const fetchedSettings = await settingsService.getAppSettings(accessToken);
      
      setSettings(() => ({
        ...initialAppSettings, // Começa com defaults completos
        ...fetchedSettings,    // Sobrescreve com o que veio do DB
        // Garante que sub-objetos tenham defaults se não vierem do DB
        checkoutIdentity: {
          ...initialAppSettings.checkoutIdentity,
          ...(fetchedSettings.checkoutIdentity || {}),
        },
        smtpSettings: {
          ...initialAppSettings.smtpSettings!, // Non-null assertion, as it's in defaults
          ...(fetchedSettings.smtpSettings || {}),
        },
        // apiTokens e pixelIntegrations são mantidos para consistência do tipo AppSettings,
        // mas não são mais editados diretamente aqui.
        apiTokens: fetchedSettings.apiTokens || initialAppSettings.apiTokens,
        pixelIntegrations: fetchedSettings.pixelIntegrations || initialAppSettings.pixelIntegrations,
        abandonedCartRecoveryConfig: {
          ...initialAppSettings.abandonedCartRecoveryConfig!, // Non-null assertion
          ...(fetchedSettings.abandonedCartRecoveryConfig || {}),
        }
      }));
    } catch (err: any) {
      showToast({ title: "Erro ao Carregar", description: err.message || 'Falha ao carregar configurações.', variant: "error" });
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    if (authIsLoading) {
        setPageLoading(true);
        return;
    }
    if (accessToken) {
      fetchSettings();
    } else {
      setPageLoading(false);
      showToast({ title: "Acesso Negado", description: "Autenticação necessária para visualizar as configurações.", variant: "error" });
      setSettings(initialAppSettings);
    }
  }, [fetchSettings, accessToken, authIsLoading, showToast]);

  const handleInputChange = (section: keyof AppSettings, field: string, value: any) => {
    setSettings(prev => {
      const sectionObject = prev[section] as Record<string, any> | undefined;
      if (typeof sectionObject === 'object' && sectionObject !== null) {
        return {
          ...prev,
          [section]: {
            ...sectionObject,
            [field]: value,
          },
        };
      }
      return { ...prev, [field as keyof AppSettings]: value };
    });
  };

  const handleDirectFieldChange = (field: keyof Pick<AppSettings, 'customDomain'>, value: any) => {
    setSettings(prev => ({...prev, [field]: value}));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      showToast({ title: "Erro de Autenticação", description: "Autenticação necessária para salvar.", variant: "error" });
      return;
    }
    setIsSaving(true);

    try {
      // Envia apenas as configurações relevantes desta página
      const settingsToSave: Partial<AppSettings> = {
        customDomain: settings.customDomain,
        checkoutIdentity: settings.checkoutIdentity,
        smtpSettings: settings.smtpSettings,
        // Não envia apiTokens e pixelIntegrations daqui
      };

      await settingsService.saveAppSettings(settingsToSave, accessToken);
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
    }
  ];


  if (pageLoading) {
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
