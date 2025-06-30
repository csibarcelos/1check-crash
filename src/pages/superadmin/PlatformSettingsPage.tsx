
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { settingsService } from '@/services/settingsService';
import { PlatformSettings } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { CogIcon, CurrencyDollarIcon, KeyIcon } from '../../constants.tsx'; 

const PlatformSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [commissionPercentage, setCommissionPercentage] = useState('');
  const [fixedFeeInCents, setFixedFeeInCents] = useState('');
  const [platformAccountId, setPlatformAccountId] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { accessToken } = useAuth();

  const fetchPlatformSettings = useCallback(async () => {
    if (!accessToken) {
        setIsLoading(false);
        setError("Autenticação de super admin necessária.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedSettings = await settingsService.getPlatformSettings();
      setSettings(fetchedSettings);
      setCommissionPercentage((fetchedSettings.platformCommissionPercentage * 100).toFixed(2)); 
      setFixedFeeInCents((fetchedSettings.platformFixedFeeInCents / 100).toFixed(2)); 
      setPlatformAccountId(fetchedSettings.platformAccountIdPushInPay);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar configurações da plataforma.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchPlatformSettings();
  }, [fetchPlatformSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setError("Autenticação de super admin necessária para salvar.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    const parsedPercentage = parseFloat(commissionPercentage.replace(',', '.')) / 100;
    const parsedFixedFee = Math.round(parseFloat(fixedFeeInCents.replace(',', '.')) * 100);

    if (isNaN(parsedPercentage) || parsedPercentage < 0 || parsedPercentage > 1) {
      setError("Percentual de comissão inválido. Deve ser entre 0 e 100%.");
      setIsSaving(false);
      return;
    }
    if (isNaN(parsedFixedFee) || parsedFixedFee < 0) {
      setError("Taxa fixa inválida.");
      setIsSaving(false);
      return;
    }
    if (!platformAccountId.trim()) {
        setError("ID da Conta PushInPay da Plataforma é obrigatório.");
        setIsSaving(false);
        return;
    }

    try {
      const settingsToSave: Partial<PlatformSettings> = {
        platformCommissionPercentage: parsedPercentage,
        platformFixedFeeInCents: parsedFixedFee,
        platformAccountIdPushInPay: platformAccountId.trim(),
      };
      await settingsService.savePlatformSettings(settingsToSave);
      setSuccessMessage('Configurações da plataforma salvas com sucesso!');
      if (settings) { 
        setSettings(prev => prev ? ({...prev, ...settingsToSave, id: 'global'}) : null);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar configurações da plataforma.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /><p className="ml-2 text-text-muted">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <CogIcon className="h-8 w-8 text-accent-blue-neon" />
        <h1 className="text-3xl font-display font-bold text-text-strong">Configurações da Plataforma</h1>
      </div>

      <Card title="Definições de Comissão e Pagamento">
        <form onSubmit={handleSubmit} className="space-y-6">
          <p className="text-sm text-text-muted">
            Defina as taxas de comissão da plataforma e a conta para recebimento.
          </p>
          
          <Input
            label="Comissão da Plataforma (%)"
            name="commissionPercentage"
            type="text"
            value={commissionPercentage}
            onChange={(e) => setCommissionPercentage(e.target.value)}
            placeholder="Ex: 1.00 para 1%"
            icon={<CurrencyDollarIcon className="h-5 w-5 text-text-muted" />}
            disabled={isSaving}
          />
          <Input
            label="Taxa Fixa da Plataforma (R$)"
            name="fixedFeeInCents"
            type="text"
            value={fixedFeeInCents}
            onChange={(e) => setFixedFeeInCents(e.target.value)}
            placeholder="Ex: 1,00 para R$1,00"
            icon={<CurrencyDollarIcon className="h-5 w-5 text-text-muted" />}
            disabled={isSaving}
          />
           <Input
            label="ID da Conta PushInPay da Plataforma"
            name="platformAccountId"
            type="text"
            value={platformAccountId}
            onChange={(e) => setPlatformAccountId(e.target.value)}
            placeholder="UUID da conta PushInPay"
            icon={<KeyIcon className="h-5 w-5 text-text-muted" />}
            disabled={isSaving}
          />

          {error && <p className="text-sm text-status-error p-3 bg-status-error/10 rounded-xl border border-status-error/30">{error}</p>}
          {successMessage && <p className="text-sm text-status-success p-3 bg-status-success/10 rounded-xl border border-status-success/30">{successMessage}</p>}
          
          <div className="flex justify-end pt-4 border-t border-border-subtle">
            <Button type="submit" variant="primary" isLoading={isSaving} disabled={isSaving}>
              Salvar Configurações da Plataforma
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default PlatformSettingsPage;
