import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { settingsService } from '@/services/settingsService';
import { AppSettings } from '@/types';
import { CogIcon, COLOR_PALETTE_OPTIONS, CheckCircleIcon, InformationCircleIcon } from '../constants.tsx';
import { useAuth } from '@/contexts/AuthContext';

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
  apiTokens: {
    pushinPay: '',
    utmify: '',
    pushinPayEnabled: false,
    utmifyEnabled: false,
  },
  pixelIntegrations: [],
};


export const ConfiguracoesPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(initialAppSettings);
  const [pageLoading, setPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { accessToken, isLoading: authIsLoading } = useAuth();

  const fetchSettings = useCallback(async () => {
    if (!accessToken) {
      setPageLoading(false);
      setError("Autenticação necessária para carregar configurações.");
      return;
    }
    setError(null);
    try {
      const fetchedSettings = await settingsService.getAppSettings(accessToken);
      setSettings(prev => ({
        ...initialAppSettings, 
        ...prev, 
        ...fetchedSettings, 
        checkoutIdentity: { 
          ...(initialAppSettings.checkoutIdentity),
          ...(prev.checkoutIdentity),
          ...(fetchedSettings.checkoutIdentity),
        },
        smtpSettings: {
          ...(initialAppSettings.smtpSettings),
          ...(prev.smtpSettings),
          ...(fetchedSettings.smtpSettings),
        },
        apiTokens: { 
            ...(initialAppSettings.apiTokens),
            ...(prev.apiTokens),
            ...(fetchedSettings.apiTokens),
        },
        pixelIntegrations: fetchedSettings.pixelIntegrations || initialAppSettings.pixelIntegrations,
      }));
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar configurações.');
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authIsLoading) {
        setPageLoading(true);
        return;
    }
    if (accessToken) {
      fetchSettings();
    } else {
      setPageLoading(false);
      setError("Autenticação necessária para visualizar as configurações.");
      setSettings(initialAppSettings);
    }
  }, [fetchSettings, accessToken, authIsLoading]);

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
    if (successMessage) setSuccessMessage(null);
    if (error) setError(null);
  };

  const handleDirectFieldChange = (field: keyof Pick<AppSettings, 'customDomain'>, value: any) => {
    setSettings(prev => ({...prev, [field]: value}));
    if (successMessage) setSuccessMessage(null);
    if (error) setError(null);
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setError("Autenticação necessária para salvar.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const settingsToSave: Partial<AppSettings> = {
        customDomain: settings.customDomain,
        checkoutIdentity: settings.checkoutIdentity,
        smtpSettings: settings.smtpSettings,
        apiTokens: settings.apiTokens,
        pixelIntegrations: settings.pixelIntegrations,
      };

      await settingsService.saveAppSettings(settingsToSave, accessToken);
      setSuccessMessage('Configurações salvas com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar configurações.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
        <p className="ml-3 text-text-muted">Carregando configurações...</p>
      </div>
    );
  }


  return (
    <div className="space-y-8 text-text-default">
      <div className="flex items-center space-x-3">
        <CogIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-text-strong">Configurações da Conta</h1>
      </div>

      {error && <p className="my-4 text-sm text-status-error p-3 bg-status-error/10 rounded-xl border border-status-error/30">{error}</p>}
      {successMessage && <p className="my-4 text-sm text-status-success p-3 bg-status-success/10 rounded-xl border border-status-success/30 flex items-center"><CheckCircleIcon className="h-5 w-5 mr-2"/>{successMessage}</p>}

      <form onSubmit={handleSubmit} className="space-y-8">
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
              labelClassName="text-text-default"
            />
            <Input
              label="URL do Favicon Padrão (Checkout)"
              name="faviconUrl"
              type="url"
              value={settings.checkoutIdentity?.faviconUrl || ''}
              onChange={(e) => handleInputChange('checkoutIdentity', 'faviconUrl', e.target.value)}
              placeholder="https://suamarca.com/favicon.ico"
              disabled={isSaving}
              labelClassName="text-text-default"
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
                className="mt-2 h-10 w-full sm:w-auto"
                disabled={isSaving}
              />
            </div>
          </div>
        </Card>

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
              labelClassName="text-text-default"
            />
            <div className="flex items-start p-3 bg-bg-main border border-border-subtle rounded-lg">
              <InformationCircleIcon className="h-5 w-5 text-accent-blue-neon mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-text-muted">
                A funcionalidade de domínio personalizado está em desenvolvimento. Em breve você poderá configurar seu próprio domínio para os checkouts.
              </p>
            </div>
          </div>
        </Card>

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
              labelClassName="text-text-default"
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
                labelClassName="text-text-default"
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
                labelClassName="text-text-default"
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
                labelClassName="text-text-default"
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

        <div className="mt-8 flex justify-end">
          <Button type="submit" variant="primary" isLoading={isSaving} size="lg" disabled={isSaving}>
            Salvar Alterações
          </Button>
        </div>
      </form>
    </div>
  );
};