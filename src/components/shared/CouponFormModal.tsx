
import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Coupon } from '@/types';

export interface CouponFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (coupon: Coupon) => void;
  existingCoupon: Coupon | null;
}

export const CouponFormModal: React.FC<CouponFormModalProps> = ({ isOpen, onClose, onSave, existingCoupon }) => {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isAutomatic, setIsAutomatic] = useState(false);
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    if (isOpen) { 
      if (existingCoupon) {
        setCode(existingCoupon.code);
        setDescription(existingCoupon.description || '');
        setDiscountType(existingCoupon.discountType);
        setDiscountValue(existingCoupon.discountType === 'fixed' ? (existingCoupon.discountValue/100).toFixed(2) : existingCoupon.discountValue.toString());
        setIsActive(existingCoupon.isActive);
        setIsAutomatic(existingCoupon.isAutomatic);
        setMaxUses(existingCoupon.maxUses?.toString() || '');
        setExpiresAt(existingCoupon.expiresAt ? existingCoupon.expiresAt.split('T')[0] : '');
      } else {
        setCode(''); setDescription(''); setDiscountType('percentage'); setDiscountValue('');
        setIsActive(true); setIsAutomatic(false); setMaxUses(''); setExpiresAt('');
      }
      setModalError('');
    }
  }, [existingCoupon, isOpen]);

  const handleSaveCoupon = () => {
    setModalError('');
    if (!code.trim()) { setModalError("Código do cupom é obrigatório."); return; }
    if (!discountValue.trim()) { setModalError("Valor do desconto é obrigatório."); return; }

    const parsedDiscountValue = parseFloat(discountValue.replace(',', '.'));
    if (isNaN(parsedDiscountValue) || parsedDiscountValue <= 0) {
      setModalError("Valor do desconto inválido."); return;
    }
    
    const finalDiscountValue = discountType === 'fixed' ? Math.round(parsedDiscountValue * 100) : parsedDiscountValue;
    if (discountType === 'percentage' && (finalDiscountValue <=0 || finalDiscountValue > 100)) {
      setModalError("Percentual de desconto deve ser entre 1 e 100."); return;
    }

    const couponData: Coupon = {
      id: existingCoupon?.id || `coupon_${Date.now()}`,
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      discountType,
      discountValue: finalDiscountValue,
      isActive,
      isAutomatic,
      maxUses: maxUses ? parseInt(maxUses) : undefined,
      uses: existingCoupon?.uses || 0,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    };
    onSave(couponData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={existingCoupon ? "Editar Cupom" : "Adicionar Novo Cupom"}>
      <div className="space-y-4 text-text-default"> {/* text-text-default para consistência */}
        <Input label="Código do Cupom (Ex: PROMO10)" value={code} onChange={e => setCode(e.target.value)} required />
        <Textarea label="Descrição (Interna, opcional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Ex: Cupom de lançamento para primeiros clientes"/>
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label htmlFor="discountType" className="block text-label-metadata mb-1.5">Tipo de Desconto</label>
            <select 
              id="discountType" 
              value={discountType} 
              onChange={e => setDiscountType(e.target.value as 'percentage' | 'fixed')} 
              className="block w-full px-4 py-3 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-150 ease-in-out bg-white/5 backdrop-blur-sm caret-accent-blue-neon border-border-subtle focus:border-accent-blue-neon focus:ring-2 focus:ring-accent-blue-neon/70 text-text-strong placeholder-text-muted"
            >
              <option value="percentage">Porcentagem (%)</option>
              <option value="fixed">Valor Fixo (R$)</option>
            </select>
          </div>
          <Input label={`Valor ${discountType === 'percentage' ? '(%)' : '(R$)'}`} type="number" step="any" value={discountValue} onChange={e => setDiscountValue(e.target.value)} required className="flex-1" />
        </div>
        <Input label="Máximo de Usos (Opcional)" type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Deixe em branco para ilimitado"/>
        <Input label="Data de Expiração (Opcional)" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} 
               className="bg-white/5 border-border-subtle text-text-strong focus:border-accent-blue-neon focus:ring-accent-blue-neon/70 [&::-webkit-calendar-picker-indicator]:bg-text-muted [&::-webkit-calendar-picker-indicator]:rounded-sm"
        />

        <div className="flex items-center justify-between">
            <label htmlFor="isAutomatic" className="text-sm font-medium text-text-default flex items-center">
                Aplicar automaticamente?
                <input type="checkbox" id="isAutomatic" checked={isAutomatic} onChange={e => setIsAutomatic(e.target.checked)} className="ml-2 h-4 w-4 text-accent-blue-neon border-border-subtle rounded focus:ring-accent-blue-neon bg-white/5 focus:ring-offset-bg-surface"/>
            </label>
             <label htmlFor="isActive" className="text-sm font-medium text-text-default flex items-center">
                Ativo?
                <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="ml-2 h-4 w-4 text-accent-blue-neon border-border-subtle rounded focus:ring-accent-blue-neon bg-white/5 focus:ring-offset-bg-surface"/>
            </label>
        </div>
        {modalError && <p className="text-sm text-status-error p-2 bg-status-error/10 rounded-xl border border-status-error/30">{modalError}</p>}
        <div className="flex justify-end space-x-3 pt-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSaveCoupon}>Salvar Cupom</Button>
        </div>
      </div>
    </Modal>
  );
};
