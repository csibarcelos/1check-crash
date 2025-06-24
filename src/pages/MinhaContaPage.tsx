
import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { UserCircleIcon, LockClosedIcon } from '../constants.tsx'; 

const MinhaContaPage: React.FC = () => {
  const { user, updateUserPassword, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await updateUserPassword(newPassword);
      showToast({
        title: 'Senha Alterada!',
        description: 'Sua senha foi atualizada com sucesso.',
        variant: 'success',
      });
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      setPasswordError(error.message || 'Falha ao alterar senha. Tente novamente.');
      showToast({
        title: 'Erro ao Alterar Senha',
        description: error.message || 'Não foi possível atualizar sua senha.',
        variant: 'error',
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3">
        <UserCircleIcon className="h-8 w-8 text-accent-blue-neon" />
        <h1 className="text-3xl font-display font-bold text-text-strong">Minha Conta</h1>
      </div>

      <Card title="Informações do Usuário">
        <div className="space-y-3 text-text-default">
          <div>
            <label className="block text-sm font-medium text-text-muted">Nome:</label>
            <p className="text-lg">{user?.name || 'Não informado'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">Email:</label>
            <p className="text-lg">{user?.email}</p>
          </div>
           {/* Adicionar mais campos do perfil aqui no futuro, se necessário */}
        </div>
      </Card>

      <Card title="Alterar Senha">
        <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
          <Input
            label="Nova Senha"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            icon={<LockClosedIcon className="h-5 w-5" />}
            placeholder="Digite sua nova senha"
            disabled={isSavingPassword || authLoading}
            required
          />
          <Input
            label="Confirmar Nova Senha"
            name="confirmNewPassword"
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            icon={<LockClosedIcon className="h-5 w-5" />}
            placeholder="Confirme sua nova senha"
            disabled={isSavingPassword || authLoading}
            required
          />
          {passwordError && <p className="text-sm text-status-error">{passwordError}</p>}
          <div className="flex justify-end pt-3">
            <Button type="submit" variant="primary" isLoading={isSavingPassword || authLoading} disabled={isSavingPassword || authLoading}>
              Salvar Nova Senha
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default MinhaContaPage;
