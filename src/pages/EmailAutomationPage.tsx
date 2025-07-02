
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MiniEditor } from '@/components/shared/MiniEditor';
import { settingsService } from '@/services/settingsService';
import { AppSettings, AbandonedCartEmailConfig, PixGeneratedEmailConfig, PixRecoveryConfig } from '@/types';
import { EnvelopeIcon, InformationCircleIcon } from '../constants.tsx';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/contexts/ToastContext';
import { Tabs, TabConfig } from '@/components/ui/Tabs';
import { Accordion } from '@/components/ui/Accordion';
import { motion } from 'framer-motion';

const MotionDiv = motion.div;

const defaultAbandonedCartConfig: AbandonedCartEmailConfig = {
  enabled: false,
  delayMinutes: 360, 
  subject: 'Você esqueceu algo no seu carrinho!',
  bodyHtml: `<p>Olá {{customer_name}},</p><p>Notamos que você demonstrou interesse em <strong>{{product_name}}</strong> e não finalizou sua compra.</p><p>Sabemos que a vida é corrida, mas não queríamos que você perdesse essa oportunidade!</p><p>Para retornar ao seu carrinho e completar sua compra, basta clicar no link abaixo:</p><p><a href="{{abandoned_checkout_link}}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block;">Finalizar Minha Compra Agora</a></p><p>Se tiver alguma dúvida ou precisar de ajuda, estamos à disposição!</p><p>Atenciosamente,<br>Equipe {{shop_name}}</p>`,
};

const defaultPixGeneratedEmailConfig: PixGeneratedEmailConfig = {
  enabled: false,
  subject: 'Seu código PIX para o pedido {{order_id}} - {{shop_name}}',
  bodyHtml: `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #0D9488;">Confirmação de Pedido</h1>
      </div>
      <p>Olá <strong>{{customer_name}}</strong>,</p>
      <p>Seu pedido <strong>#{{order_id}}</strong> em <strong>{{shop_name}}</strong> foi recebido com sucesso!</p>
      <p>Para finalizar sua compra de <strong>{{all_product_names}}</strong>, por favor, realize o pagamento via PIX utilizando os dados abaixo:</p>
      
      <div style="text-align: center; margin: 25px 0; padding: 20px; background-color: #f9f9f9; border-radius: 8px; border: 1px dashed #ccc;">
        <h3 style="color: #0D9488; margin-top: 0;">Pague com PIX!</h3>
        <p style="margin-bottom: 15px;">Escaneie o QR Code ou copie o código para pagar:</p>
        <img src="{{pix_qr_code_image_url}}" alt="PIX QR Code" style="max-width: 200px; height: auto; border: 1px solid #eee; border-radius: 5px; margin-bottom: 15px;">
        <div style="background-color: #eee; padding: 10px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 14px; color: #555;">
          <strong>Código PIX Copia e Cola:</strong><br>
          {{pix_copy_paste_code}}
        </div>
        <p style="font-size: 12px; color: #777; margin-top: 15px;">Este PIX é válido por um tempo limitado.</p>
      </div>

      <p><strong>Detalhes do Pedido:</strong></p>
      {{product_list_html}}

      <p>Se tiver qualquer dúvida, entre em contato conosco. Estamos à disposição para ajudar!</p>
      <p>Atenciosamente,<br>Equipe <strong>{{shop_name}}</strong></p>
      <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #999;">
        <p>&copy; ${new Date().getFullYear()} {{shop_name}}. Todos os direitos reservados.</p>
      </div>
    </div>
  `,
};

const defaultPixRecoveryConfig: PixRecoveryConfig = {
  email1: { enabled: false, delayMinutes: 15, subject: 'Não se esqueça do seu PIX!', bodyHtml: '<p>Ainda dá tempo de finalizar sua compra de {{product_name}}!</p>' },
  email2: { enabled: false, delayMinutes: 30, subject: 'Sua oferta está expirando...', bodyHtml: '<p>Seu PIX para {{product_name}} está quase expirando. Não perca!</p>' },
  email3: { enabled: false, delayMinutes: 60, subject: 'Última chance para garantir seu produto!', bodyHtml: '<p>Esta é sua última oportunidade de pagar o PIX para {{product_name}}.</p>' },
};

const listItemVariants = {
  initial: { opacity: 0, height: 0, y: -10 },
  animate: { opacity: 1, height: 'auto', y: 0, transition: { duration: 0.3, ease: 'circOut' as const } },
  exit: { opacity: 0, height: 0, y: -10, transition: { duration: 0.2, ease: 'circIn' as const } },
};

const EmailAutomationPage: React.FC = () => {
  const { appSettings, isLoading, error, refreshData } = useData();
  const [abandonedCartConfig, setAbandonedCartConfig] = useState<AbandonedCartEmailConfig>(defaultAbandonedCartConfig);
  const [pixGeneratedEmailConfig, setPixGeneratedEmailConfig] = useState<PixGeneratedEmailConfig>(defaultPixGeneratedEmailConfig);
  const [pixRecoveryConfig, setPixRecoveryConfig] = useState<PixRecoveryConfig>(defaultPixRecoveryConfig);
  
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const abandonedCartDelayOptions = [
    { value: "15", label: "15 minutos após abandono" }, { value: "30", label: "30 minutos após abandono" },
    { value: "60", label: "1 hora após abandono" }, { value: "180", label: "3 horas após abandono" },
    { value: "360", label: "6 horas após abandono" }, { value: "720", label: "12 horas após abandono" },
    { value: "1440", label: "24 horas após abandono" },
  ];

  const pixRecoveryDelayOptions: { value: string; label: string }[] = [
    { value: "15", label: "15 minutos" },
    { value: "30", label: "30 minutos" },
    { value: "60", label: "60 minutos" },
  ];
  
  useEffect(() => {
    if (appSettings) {
      setAbandonedCartConfig(appSettings.abandonedCartRecoveryConfig ? { ...defaultAbandonedCartConfig, ...appSettings.abandonedCartRecoveryConfig } : defaultAbandonedCartConfig);
      setPixGeneratedEmailConfig(appSettings.pixGeneratedEmailConfig ? { ...defaultPixGeneratedEmailConfig, ...appSettings.pixGeneratedEmailConfig } : defaultPixGeneratedEmailConfig);
      setPixRecoveryConfig(appSettings.pixRecoveryConfig ? { ...defaultPixRecoveryConfig, ...appSettings.pixRecoveryConfig } : defaultPixRecoveryConfig);
    }
    if (error) {
      showToast({ title: "Erro ao Carregar Dados", description: error, variant: "error" });
    }
  }, [appSettings, error, showToast]);

  const handleSaveAllConfigs = async () => {
    if (!appSettings) {
      showToast({ title: "Erro", description: "Configurações não carregadas.", variant: "error" });
      return;
    }
    setIsSaving(true);
    try {
      const updatedSettings: AppSettings = {
        ...appSettings,
        abandonedCartRecoveryConfig: abandonedCartConfig,
        pixGeneratedEmailConfig,
        pixRecoveryConfig,
      };
      await settingsService.saveAppSettings(updatedSettings);
      await refreshData();
      showToast({ title: "Sucesso!", description: "Configurações de automação salvas.", variant: "success" });
    } catch (err: any) {
      showToast({ title: "Erro ao Salvar", description: err.message || 'Falha ao salvar configurações.', variant: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const renderAbandonedCartTab = () => (
    <Card title="Recuperação de Carrinho Abandonado">
      <div className="space-y-6">
        <ToggleSwitch label="Habilitar recuperação de carrinho abandonado" enabled={abandonedCartConfig.enabled} onEnabledChange={(val) => setAbandonedCartConfig(p => ({ ...p, enabled: val }))} disabled={isSaving}/>
        <MotionDiv variants={listItemVariants} initial={false} animate={abandonedCartConfig.enabled ? "animate" : "exit"} className="overflow-hidden">
          <div className="space-y-4 mt-4 pl-4 border-l-2 border-border-interactive/30">
            <Select label="Atraso para envio do e-mail:" options={abandonedCartDelayOptions} value={String(abandonedCartConfig.delayMinutes)} onValueChange={(val) => setAbandonedCartConfig(p => ({ ...p, delayMinutes: parseInt(val, 10) }))} disabled={isSaving}/>
            <Input label="Assunto do E-mail de Recuperação" value={abandonedCartConfig.subject} onChange={(e) => setAbandonedCartConfig(p => ({ ...p, subject: e.target.value }))} placeholder="Ex: Não deixe seus itens para trás!" disabled={isSaving}/>
            <div>
              <label className="block text-sm font-medium text-text-default mb-1.5">Corpo do E-mail (HTML)</label>
              <MiniEditor value={abandonedCartConfig.bodyHtml} onChange={(html) => setAbandonedCartConfig(p => ({...p, bodyHtml: html}))} placeholder={'<p>Olá {{customer_name}}, você esqueceu o produto {{product_name}}...</p>'}/>
              <p className="text-xs text-text-muted mt-2">{'Placeholders disponíveis: {{customer_name}}, {{product_name}}, {{abandoned_checkout_link}}, {{shop_name}}.'}</p>
            </div>
            <div className="flex items-start p-3 bg-bg-main border border-border-subtle rounded-lg mt-2">
              <InformationCircleIcon className="h-5 w-5 text-accent-blue-neon mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-text-muted">{'Lembre-se de configurar a função agendada '} <code className="font-mono bg-bg-surface text-accent-blue-neon px-1 py-0.5 rounded text-[0.9em]">process-abandoned-carts</code> {' no painel do Supabase para que estes e-mails sejam enviados.'}</p>
            </div>
          </div>
        </MotionDiv>
      </div>
    </Card>
  );
  
  const renderPixRecoveryTab = () => (
    <Card title="Recuperação de Pagamento PIX">
      <div className="space-y-6">
        {[1, 2, 3].map(i => {
          const key = `email${i}` as keyof PixRecoveryConfig;
          const config = pixRecoveryConfig[key];
          return (
            <Accordion key={key} title={`E-mail de Recuperação de PIX #${i}`} className="bg-bg-surface-opaque">
              <div className="space-y-4">
                <ToggleSwitch label={`Habilitar E-mail #${i}`} enabled={config.enabled} onEnabledChange={(val) => setPixRecoveryConfig(p => ({ ...p, [key]: { ...p[key], enabled: val } }))} disabled={isSaving}/>
                <MotionDiv variants={listItemVariants} initial={false} animate={config.enabled ? "animate" : "exit"} className="overflow-hidden">
                  <div className="space-y-4 mt-4 pl-4 border-l-2 border-border-interactive/30">
                    <Select label={`Atraso para Envio (após geração do PIX)`} options={pixRecoveryDelayOptions} value={String(config.delayMinutes)} onValueChange={(val) => setPixRecoveryConfig(p => ({ ...p, [key]: { ...p[key], delayMinutes: parseInt(val, 10) as 15 | 30 | 60 } }))} disabled={isSaving}/>
                    <Input label="Assunto do E-mail" value={config.subject} onChange={(e) => setPixRecoveryConfig(p => ({ ...p, [key]: { ...p[key], subject: e.target.value } }))} placeholder={`Assunto para e-mail #${i}`} disabled={isSaving}/>
                    <div>
                      <label className="block text-sm font-medium text-text-default mb-1.5">Corpo do E-mail (HTML)</label>
                      <MiniEditor value={config.bodyHtml} onChange={(html) => setPixRecoveryConfig(p => ({ ...p, [key]: { ...p[key], bodyHtml: html } }))} placeholder={`Conteúdo para e-mail #${i}`}/>
                      <p className="text-xs text-text-muted mt-2">{'Placeholders: {{customer_name}}, {{product_name}}, {{order_id}}, {{shop_name}}.'}</p>
                    </div>
                  </div>
                </MotionDiv>
              </div>
            </Accordion>
          );
        })}
        <div className="flex items-start p-3 bg-bg-main border border-border-subtle rounded-lg mt-2">
          <InformationCircleIcon className="h-5 w-5 text-accent-blue-neon mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-muted">{'Configure a função agendada '} <code className="font-mono bg-bg-surface text-accent-blue-neon px-1 py-0.5 rounded text-[0.9em]">process-pix-recovery-emails</code> {' no painel do Supabase para que esta sequência funcione.'}</p>
        </div>
      </div>
    </Card>
  );

  const renderPixGeneratedTab = () => (
    <Card title="Confirmação de PIX Gerado (Instantâneo)">
      <div className="space-y-6">
        <ToggleSwitch label="Habilitar e-mail de confirmação de PIX gerado" enabled={pixGeneratedEmailConfig.enabled} onEnabledChange={(val) => setPixGeneratedEmailConfig(p => ({ ...p, enabled: val }))} disabled={isSaving}/>
        <MotionDiv variants={listItemVariants} initial={false} animate={pixGeneratedEmailConfig.enabled ? "animate" : "exit"} className="overflow-hidden">
          <div className="space-y-4 mt-4 pl-4 border-l-2 border-border-interactive/30">
            <Input label="Assunto do E-mail" value={pixGeneratedEmailConfig.subject} onChange={(e) => setPixGeneratedEmailConfig(p => ({...p, subject: e.target.value}))} placeholder="Ex: Seu código PIX para o produto {{product_name}}!" disabled={isSaving}/>
            <div>
              <label className="block text-sm font-medium text-text-default mb-1.5">Corpo do E-mail (HTML)</label>
              <MiniEditor value={pixGeneratedEmailConfig.bodyHtml} onChange={(html) => setPixGeneratedEmailConfig(p => ({...p, bodyHtml: html}))} placeholder={'<p>Olá {{customer_name}}, seu código PIX para o produto {{product_name}} foi gerado...</p>'}/>
              <p className="text-xs text-text-muted mt-2">{'Placeholders: {{customer_name}}, {{product_name}}, {{order_id}}, {{pix_copy_paste_code}}, {{pix_qr_code_image_url}}, {{shop_name}}.'}</p>
            </div>
          </div>
        </MotionDiv>
      </div>
    </Card>
  );

  const tabsConfig: TabConfig[] = [
    { value: 'abandonedCart', label: 'Recuperação de Carrinho', content: renderAbandonedCartTab() },
    { value: 'pixRecovery', label: 'Recuperação de PIX', content: renderPixRecoveryTab() },
    { value: 'pixGenerated', label: 'Confirmação de PIX', content: renderPixGeneratedTab() },
  ];

  if (isLoading) {
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
      
      <div className="mt-8 flex justify-end pt-6 border-t border-border-subtle">
        <Button onClick={handleSaveAllConfigs} isLoading={isSaving} disabled={isSaving} size="lg">
          Salvar Todas as Configurações de E-mail
        </Button>
      </div>
    </div>
  );
};

export default EmailAutomationPage;