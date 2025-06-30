
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { settingsService } from '@/services/settingsService';
import { AppSettings, PixelIntegration, PixelType } from '@/types';
import { LinkIcon, KeyIcon, PlusIcon, PencilIcon, TrashIcon, TagIcon } from '../constants.tsx';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/contexts/ToastContext'; 

const PIXEL_TYPES: PixelType[] = ['Facebook Pixel', 'Google Ads', 'GTM', 'TikTok Pixel'];

const IntegracoesPage: React.FC = () => {
  const { appSettings, isLoading, error: dataError, refreshData } = useData();
  
  const [pushinPayToken, setPushinPayToken] = useState('');
  const [utmifyToken, setUtmifyToken] = useState('');
  const [pushinPayEnabled, setPushinPayEnabled] = useState(false);
  const [utmifyEnabled, setUtmifyEnabled] = useState(false);
  const [pixelIntegrations, setPixelIntegrations] = useState<PixelIntegration[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  const [isPixelModalOpen, setIsPixelModalOpen] = useState(false);
  const [editingPixel, setEditingPixel] = useState<PixelIntegration | null>(null);
  const [currentPixelType, setCurrentPixelType] = useState<PixelType>(PIXEL_TYPES[0]);
  const [currentPixelSettings, setCurrentPixelSettings] = useState<Record<string, string>>({});
  const [currentPixelEnabled, setCurrentPixelEnabled] = useState(true);
  const [pixelModalError, setPixelModalError] = useState<string | null>(null);

  const { showToast } = useToast(); 

  useEffect(() => {
    if (appSettings) {
      setPushinPayToken(appSettings.apiTokens?.pushinPay || '');
      setUtmifyToken(appSettings.apiTokens?.utmify || '');
      setPushinPayEnabled(appSettings.apiTokens?.pushinPayEnabled || false);
      setUtmifyEnabled(appSettings.apiTokens?.utmifyEnabled || false);
      setPixelIntegrations(appSettings.pixelIntegrations || []);
    }
    if (dataError) {
      showToast({ title: "Erro ao Carregar", description: dataError, variant: "error" });
    }
  }, [appSettings, dataError, showToast]);


  const handleSubmitApiTokens = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!appSettings) return;

    setIsSaving(true);

    try {
      const settingsToSave: AppSettings = {
        ...appSettings,
        apiTokens: {
            pushinPay: pushinPayToken.trim(),
            utmify: utmifyToken.trim(),
            pushinPayEnabled: pushinPayEnabled,
            utmifyEnabled: utmifyEnabled,
        },
      };
      
      await settingsService.saveAppSettings(settingsToSave);
      await refreshData();
      showToast({ title: "Sucesso!", description: 'Configurações de API salvas com sucesso!', variant: "success" });
    } catch (err: any) {
      showToast({ title: "Erro ao Salvar", description: err.message || 'Falha ao salvar tokens de API.', variant: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const openPixelModal = (pixel?: PixelIntegration) => {
    setEditingPixel(pixel || null);
    const typeToSet = pixel?.type || PIXEL_TYPES[0];
    setCurrentPixelType(typeToSet);
    
    let initialSettings: Record<string, string> = {};
    switch(typeToSet) {
        case 'Facebook Pixel': initialSettings = { pixelId: '' }; break;
        case 'Google Ads': initialSettings = { conversionId: '', conversionLabel: '' }; break;
        case 'GTM': initialSettings = { containerId: '' }; break;
        case 'TikTok Pixel': initialSettings = { pixelId: '' }; break;
    }

    setCurrentPixelSettings(pixel?.settings || initialSettings);
    setCurrentPixelEnabled(pixel ? pixel.enabled : true);
    setPixelModalError(null);
    setIsPixelModalOpen(true);
  };

  const closePixelModal = () => {
    setIsPixelModalOpen(false);
    setEditingPixel(null);
    setPixelModalError(null);
  };

  const handleSavePixel = async () => {
    if (!appSettings) return;
    
    setPixelModalError(null);
    let requiredSettingsMet = true;
    switch(currentPixelType) {
        case 'Facebook Pixel': if(!currentPixelSettings.pixelId?.trim()) requiredSettingsMet = false; break;
        case 'Google Ads': if(!currentPixelSettings.conversionId?.trim() || !currentPixelSettings.conversionLabel?.trim()) requiredSettingsMet = false; break;
        case 'GTM': if(!currentPixelSettings.containerId?.trim()) requiredSettingsMet = false; break;
        case 'TikTok Pixel': if(!currentPixelSettings.pixelId?.trim()) requiredSettingsMet = false; break;
    }
    if(!requiredSettingsMet) {
        setPixelModalError("Preencha todos os campos obrigatórios para este tipo de pixel.");
        return;
    }

    let updatedPixelsList;
    if (editingPixel) {
      updatedPixelsList = pixelIntegrations.map(p =>
        p.id === editingPixel.id ? { ...p, type: currentPixelType, settings: currentPixelSettings, enabled: currentPixelEnabled } : p
      );
    } else {
      const newPixel: PixelIntegration = {
        id: `pixel_${Date.now()}`,
        type: currentPixelType,
        settings: currentPixelSettings,
        enabled: currentPixelEnabled,
      };
      updatedPixelsList = [...pixelIntegrations, newPixel];
    }
    
    setIsSaving(true); 
    try {
        const settingsToSave: AppSettings = { ...appSettings, pixelIntegrations: updatedPixelsList };
        
        await settingsService.saveAppSettings(settingsToSave);
        await refreshData();
        showToast({ title: "Sucesso!", description: 'Pixel salvo com sucesso!', variant: "success" });
        closePixelModal();
    } catch (err: any) {
      showToast({ title: "Erro ao Salvar Pixel", description: err.message || 'Falha ao salvar pixel.', variant: "error" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeletePixel = async (pixelId: string) => {
    if (!appSettings) return;
    const updatedPixelsList = pixelIntegrations.filter(p => p.id !== pixelId);
    
    setIsSaving(true);
    try {
        const settingsToSave: AppSettings = { ...appSettings, pixelIntegrations: updatedPixelsList };
        
        await settingsService.saveAppSettings(settingsToSave);
        await refreshData();
        showToast({ title: "Sucesso!", description: 'Pixel excluído com sucesso!', variant: "success" });
    } catch (err: any) {
      showToast({ title: "Erro ao Excluir", description: err.message || 'Falha ao excluir pixel.', variant: "error" });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handlePixelSettingChange = (key: string, value: string) => {
    setCurrentPixelSettings(prev => ({...prev, [key]: value}));
  };

  const handlePixelTypeChange = (newType: PixelType) => {
    setCurrentPixelType(newType);
    let initialSettings: Record<string, string> = {};
     switch(newType) {
        case 'Facebook Pixel': initialSettings = { pixelId: '' }; break;
        case 'Google Ads': initialSettings = { conversionId: '', conversionLabel: '' }; break;
        case 'GTM': initialSettings = { containerId: '' }; break;
        case 'TikTok Pixel': initialSettings = { pixelId: '' }; break;
    }
    setCurrentPixelSettings(initialSettings);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
        <p className="ml-3 text-text-muted">Carregando integrações...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-8 text-text-default">
      <div className="flex items-center space-x-3">
        <LinkIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-text-strong">Integrações</h1>
      </div>

      <form onSubmit={handleSubmitApiTokens}>
        <Card title="Chaves de API (Tokens)">
            <div className="space-y-6">
                <div className="space-y-3 p-4 border border-border-subtle rounded-lg bg-bg-surface">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-text-strong">PushInPay (Gateway de Pagamento PIX)</h3>
                        <ToggleSwitch label="Habilitar" srLabel="Habilitar PushInPay" enabled={pushinPayEnabled} onEnabledChange={setPushinPayEnabled} disabled={isSaving}/>
                    </div>
                    <Input
                        label="Token da API PushInPay"
                        name="pushinPayToken"
                        type="password"
                        value={pushinPayToken}
                        onChange={(e) => setPushinPayToken(e.target.value)}
                        placeholder="Cole seu token da API PushInPay aqui"
                        icon={<KeyIcon className="h-5 w-5 text-text-muted" />}
                        disabled={isSaving || !pushinPayEnabled}
                        autoComplete="new-password"
                    />
                     <p className="text-xs text-text-muted">Integração para processamento de pagamentos PIX.</p>
                </div>

                 <div className="space-y-3 p-4 border border-border-subtle rounded-lg bg-bg-surface">
                    <div className="flex justify-between items-center">
                         <h3 className="text-lg font-semibold text-text-strong">UTMify (Rastreamento Avançado)</h3>
                        <ToggleSwitch label="Habilitar" srLabel="Habilitar UTMify" enabled={utmifyEnabled} onEnabledChange={setUtmifyEnabled} disabled={isSaving}/>
                    </div>
                    <Input
                        label="Token da API UTMify"
                        name="utmifyToken"
                        type="password"
                        value={utmifyToken}
                        onChange={(e) => setUtmifyToken(e.target.value)}
                        placeholder="Cole seu token da API UTMify aqui"
                        icon={<KeyIcon className="h-5 w-5 text-text-muted" />}
                        disabled={isSaving || !utmifyEnabled}
                        autoComplete="new-password"
                    />
                    <p className="text-xs text-text-muted">Integração para rastreamento de UTMs e comissões.</p>
                </div>
            </div>
             <div className="mt-6 flex justify-end pt-4 border-t border-border-subtle">
                <Button type="submit" variant="primary" isLoading={isSaving} disabled={isSaving}>
                    Salvar Chaves de API
                </Button>
            </div>
        </Card>
      </form>
      
      <Card title="Pixels de Rastreamento">
        <div className="space-y-4">
            {pixelIntegrations.length === 0 && <p className="text-text-muted">Nenhum pixel de rastreamento configurado.</p>}
            {pixelIntegrations.map(pixel => (
                <div key={pixel.id} className="p-4 border border-border-subtle rounded-lg bg-bg-surface flex justify-between items-center">
                    <div>
                        <h4 className="text-md font-semibold text-text-strong flex items-center">
                           <TagIcon className="h-5 w-5 mr-2 text-primary"/> {pixel.type}
                        </h4>
                        <p className="text-xs text-text-muted">
                            {Object.entries(pixel.settings).map(([key, val]) => `${key}: ${(val as string).substring(0,20)}${(val as string).length > 20 ? '...' : ''}`).join(', ')}
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${pixel.enabled ? 'bg-status-success/20 text-status-success' : 'bg-neutral-700 text-text-muted'}`}>
                            {pixel.enabled ? 'Ativo' : 'Inativo'}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => openPixelModal(pixel)} title="Editar Pixel"><PencilIcon className="h-5 w-5"/></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePixel(pixel.id)} title="Excluir Pixel" className="text-status-error hover:text-opacity-80"><TrashIcon className="h-5 w-5"/></Button>
                    </div>
                </div>
            ))}
             <Button variant="secondary" onClick={() => openPixelModal()} leftIcon={<PlusIcon className="h-5 w-5"/>} className="w-full mt-2">
                Adicionar Novo Pixel
            </Button>
        </div>
      </Card>
      
      {isPixelModalOpen && (
         <Modal isOpen={isPixelModalOpen} onClose={closePixelModal} title={editingPixel ? "Editar Pixel" : "Adicionar Novo Pixel"} size="lg">
            <div className="space-y-4 text-text-default">
                 <div>
                    <label htmlFor="pixelType" className="block text-sm font-medium mb-1">Tipo de Pixel</label>
                    <select 
                        id="pixelType" 
                        value={currentPixelType}
                        onChange={(e) => handlePixelTypeChange(e.target.value as PixelType)}
                        className="block w-full p-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-150 ease-in-out bg-white/5 backdrop-blur-sm border-border-subtle focus:border-accent-blue-neon focus:ring-2 focus:ring-accent-blue-neon/70 text-text-strong placeholder-text-muted"
                        disabled={isSaving}
                    >
                        {PIXEL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                 </div>

                {currentPixelType === 'Facebook Pixel' && (
                    <Input label="ID do Pixel do Facebook" value={currentPixelSettings.pixelId || ''} onChange={(e) => handlePixelSettingChange('pixelId', e.target.value)} placeholder="Ex: 123456789012345" disabled={isSaving}/>
                )}
                {currentPixelType === 'Google Ads' && (<>
                    <Input label="ID de Conversão Google Ads" value={currentPixelSettings.conversionId || ''} onChange={(e) => handlePixelSettingChange('conversionId', e.target.value)} placeholder="Ex: AW-123456789" disabled={isSaving}/>
                    <Input label="Rótulo de Conversão Google Ads" value={currentPixelSettings.conversionLabel || ''} onChange={(e) => handlePixelSettingChange('conversionLabel', e.target.value)} placeholder="Ex: abcDEfghiJKLmnopQRS" disabled={isSaving}/>
                </>)}
                {currentPixelType === 'GTM' && (
                    <Input label="ID do Contêiner GTM" value={currentPixelSettings.containerId || ''} onChange={(e) => handlePixelSettingChange('containerId', e.target.value)} placeholder="Ex: GTM-XXXXXXX" disabled={isSaving}/>
                )}
                {currentPixelType === 'TikTok Pixel' && (
                     <Input label="ID do Pixel do TikTok" value={currentPixelSettings.pixelId || ''} onChange={(e) => handlePixelSettingChange('pixelId', e.target.value)} placeholder="Ex: ABCDEFGHIJKLMN" disabled={isSaving}/>
                )}
                
                <ToggleSwitch label="Habilitar Pixel" enabled={currentPixelEnabled} onEnabledChange={setCurrentPixelEnabled} disabled={isSaving}/>
                
                {pixelModalError && <p className="text-sm text-status-error p-2 bg-status-error/10 rounded-md border border-status-error/30">{pixelModalError}</p>}

                <div className="flex justify-end space-x-3 pt-3">
                    <Button variant="ghost" onClick={closePixelModal} disabled={isSaving}>Cancelar</Button>
                    <Button variant="primary" onClick={handleSavePixel} isLoading={isSaving} disabled={isSaving}>Salvar Pixel</Button>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default IntegracoesPage;
