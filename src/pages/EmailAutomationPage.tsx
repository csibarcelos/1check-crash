
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MiniEditor } from '@/components/shared/MiniEditor';
import { settingsService } from '@/services/settingsService';
import { AppSettings, AbandonedCartEmailConfig } from '@/types';
import { EnvelopeIcon, InformationCircleIcon } from '../constants.tsx';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Tabs, TabConfig } from '@/components/ui/Tabs'; // Importa o novo componente Tabs


const defaultAbandonedCartConfig: AbandonedCartEmailConfig = {
  enabled: false,
  delayHours: 6, // Default delay
  subject: 'Você esqueceu algo no seu carrinho!',
  bodyHtml: `<p>Olá {{customer_name}},</p>
<p>Notamos que você demonstrou interesse em <strong>{{product_name}}</strong> e não finalizou sua compra.</p>
<p>Sabemos que a vida é corrida, mas não queríamos que você perdesse essa oportunidade!</p>
<p>Para retornar ao seu carrinho e completar sua compra, basta clicar no link abaixo:</p>
<p><a href="{{abandoned_checkout_link}}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block;">Finalizar Minha Compra Agora</a></p>
<p>Se tiver alguma dúvida ou precisar de ajuda, estamos à disposição!</p>
<p>Atenciosamente,<br>Equipe {{shop_name}}</p>`,
};

const EmailAutomationPage: React.FC = () => {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [abandonedCartConfig, setAbandonedCartConfig] = useState<AbandonedCartEmailConfig>(defaultAbandonedCartConfig);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { accessToken, isLoading: authIsLoading } = useAuth();
  const { showToast } = useToast();

  const delayOptions = [
    { value: "1", label: "1 hora após abandono" }, { value: "3", label: "3 horas após abandono" },
    { value: "6", label: "6 horas após abandono" }, { value: "12", label: "12 horas após abandono" },
    { value: "24", label: "24 horas após abandono" }, { value: "48", label: "48 horas após abandono (2 dias)" },
  ];
  
  const fetchSettings = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      showToast({ title: "Erro de Autenticação", description: "Autenticação necessária.", variant: "error" });
      return;
    }
    setIsLoading(true);
    try {
      const settings = await settingsService.getAppSettings(accessToken);
      setAppSettings(settings);
      setAbandonedCartConfig(settings.abandonedCartRecoveryConfig 
        ? { ...defaultAbandonedCartConfig, ...settings.abandonedCartRecoveryConfig } 
        : defaultAbandonedCartConfig
      );
    } catch (err: any) {
      showToast({ title: "Erro ao Carregar", description: err.message || 'Falha ao carregar configurações de automação.', variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    if (!authIsLoading) {
      fetchSettings();
    }
  }, [fetchSettings, authIsLoading]);

  const handleAbandonedCartConfigChange = <K extends keyof AbandonedCartEmailConfig>(field: K, value: AbandonedCartEmailConfig[K]) => {
    setAbandonedCartConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveAbandonedCartConfig = async () => {
    if (!accessToken || !appSettings) {
      showToast({ title: "Erro de Autenticação", description: "Não foi possível salvar.", variant: "error" });
      return;
    }
    setIsSaving(true);
    try {
      const updatedSettings: AppSettings = {
        ...appSettings,
        abandonedCartRecoveryConfig: abandonedCartConfig,
      };
      await settingsService.saveAppSettings(updatedSettings, accessToken);
      setAppSettings(updatedSettings); // Update local state for consistency
      showToast({ title: "Sucesso!", description: "Configurações de recuperação de carrinho salvas.", variant: "success" });
    } catch (err: any) {
      showToast({ title: "Erro ao Salvar", description: err.message || 'Falha ao salvar configurações.', variant: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const tabsConfig: TabConfig[] = [
    {
      value: 'abandonedCart',
      label: 'Recuperação de Carrinho',
      content: (
        <Card title="Recuperação de Carrinho Abandonado">
          <div className="space-y-6">
            <ToggleSwitch
              label="Habilitar recuperação de carrinho abandonado"
              enabled={abandonedCartConfig.enabled}
              onEnabledChange={(val) => handleAbandonedCartConfigChange('enabled', val)}
              disabled={isSaving}
            />
            {abandonedCartConfig.enabled && (
              <div className="space-y-4 mt-4 pl-4 border-l-2 border-border-interactive/30">
                <Select
                  label="Atraso para envio do e-mail:"
                  options={delayOptions}
                  value={String(abandonedCartConfig.delayHours)}
                  onValueChange={(val) => handleAbandonedCartConfigChange('delayHours', parseInt(val, 10))}
                  disabled={isSaving}
                />
                <Input
                  label="Assunto do E-mail de Recuperação"
                  value={abandonedCartConfig.subject}
                  onChange={(e) => handleAbandonedCartConfigChange('subject', e.target.value)}
                  placeholder="Ex: Não deixe seus itens para trás!"
                  disabled={isSaving}
                />
                <div>
                  <label className="block text-sm font-medium text-text-default mb-1.5">Corpo do E-mail (HTML)</label>
                  <MiniEditor
                    value={abandonedCartConfig.bodyHtml}
                    onChange={(html) => handleAbandonedCartConfigChange('bodyHtml', html)}
                    placeholder={'<p>Olá {{customer_name}}, você esqueceu o produto {{product_name}}...</p>'}
                  />
                   <p className="text-xs text-text-muted mt-2">
                    {'Placeholders disponíveis: {{customer_name}}, {{product_name}}, {{abandoned_checkout_link}}, {{shop_name}}.'}
                  </p>
                </div>
                <div className="flex items-start p-3 bg-bg-main border border-border-subtle rounded-lg mt-2">
                    <InformationCircleIcon className="h-5 w-5 text-accent-blue-neon mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-muted">
                        {'Lembre-se de configurar a função agendada '}
                        <code className="font-mono bg-bg-surface text-accent-blue-neon px-1 py-0.5 rounded text-[0.9em]">process-abandoned-carts</code>
                        {' no painel do Supabase para que estes e-mails sejam enviados.'}
                        <br />{'O `{{shop_name}}` será substituído pelo nome da sua loja (se configurado em Identidade Visual) ou um nome padrão.'}
                    </p>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveAbandonedCartConfig} isLoading={isSaving} disabled={isSaving}>
                    Salvar Config. de Carrinho Abandonado
                  </Button>
                </div>
              </div>
            )}
             {!abandonedCartConfig.enabled && (
                <div className="flex justify-end pt-4">
                     <Button onClick={handleSaveAbandonedCartConfig} isLoading={isSaving} disabled={isSaving}>
                        Salvar Estado (Desabilitado)
                    </Button>
                </div>
             )}
          </div>
        </Card>
      )
    },
    {
      value: 'postPurchase',
      label: 'E-mails Pós-Compra',
      content: (
         <Card title="E-mails Pós-Compra (Sequências por Produto)">
            <div className="space-y-4">
                <p className="text-text-muted">
                    Configure e-mails de acompanhamento para serem enviados após uma compra.
                    As configurações de template e atraso são feitas individualmente <strong className="text-text-default">na página de edição de cada produto</strong>, na aba "E-mail Pós-Compra".
                </p>
                <div className="flex items-start p-3 bg-bg-main border border-border-subtle rounded-lg mt-2">
                    <InformationCircleIcon className="h-5 w-5 text-accent-blue-neon mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-muted">
                        {'Lembre-se de configurar a função agendada '}
                        <code className="font-mono bg-bg-surface text-accent-blue-neon px-1 py-0.5 rounded text-[0.9em]">process-post-purchase-emails</code>
                        {' no painel do Supabase para que estes e-mails sejam enviados.'}
                        <br />{'Placeholders como {{customer_name}}, {{product_name}}, {{order_id}}, {{product_delivery_url}}, {{shop_name}} podem ser usados nos templates.'}
                    </p>
                </div>
            </div>
         </Card>
      )
    }
  ];


  if (isLoading || authIsLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <LoadingSpinner size="lg" />
        <p className="ml-3 text-text-muted">Carregando configurações de automação...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-text-default">
      <div className="flex items-center space-x-3">
        <EnvelopeIcon className="h-8 w-8 text-accent-blue-neon" />
        <h1 className="text-3xl font-display font-bold text-text-strong">Automação de E-mail</h1>
      </div>
      
      <Tabs tabs={tabsConfig} defaultValue="abandonedCart" className="w-full" />
    </div>
  );
};

export default EmailAutomationPage;
