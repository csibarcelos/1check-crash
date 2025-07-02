
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Input } from '@/components/ui/Input';
import { User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { UserGroupIcon, SUPER_ADMIN_EMAIL } from '../../constants.tsx'; // Changed UsersIcon to UserGroupIcon
import { superAdminService } from '@/services/superAdminService';
import { Table, TableHeader } from '@/components/ui/Table';

const ITEMS_PER_PAGE = 15;
const DEBOUNCE_DELAY = 300;

interface UserUpdate {
  name?: string;
  isActive?: boolean;
  isSuperAdmin?: boolean;
}

const SuperAdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken, user: loggedInSuperAdmin } = useAuth();
  
  // Modal state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUserDetailsModalOpen, setIsUserDetailsModalOpen] = useState(false);
  const [modalUserName, setModalUserName] = useState('');
  const [modalIsActive, setModalIsActive] = useState(true);
  const [modalIsSuperAdmin, setModalIsSuperAdmin] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Refs para evitar chamadas desnecessárias
  const fetchUsersAbortController = useRef<AbortController | null>(null);
  const lastFetchTime = useRef<number>(0);
  const usersCacheRef = useRef<User[]>([]);

  // Debounced fetch para evitar múltiplas chamadas
  const fetchUsers = useCallback(async (force = false) => {
    if (!accessToken) {
      setError("Autenticação de super admin necessária.");
      setIsLoading(false);
      return;
    }

    const now = Date.now();
    
    // Evita chamadas muito próximas (debounce)
    if (!force && now - lastFetchTime.current < DEBOUNCE_DELAY) {
      return;
    }

    // Cancela requisição anterior se ainda estiver pendente
    if (fetchUsersAbortController.current) {
      fetchUsersAbortController.current.abort();
    }

    fetchUsersAbortController.current = new AbortController();
    lastFetchTime.current = now;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const usersData = await superAdminService.getAllPlatformUsers(
        accessToken,
        { signal: fetchUsersAbortController.current.signal }
      );
      
      // Otimização: só atualiza se os dados realmente mudaram
      const sortedUsers = usersData.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
      
      if (JSON.stringify(usersCacheRef.current) !== JSON.stringify(sortedUsers)) {
        usersCacheRef.current = sortedUsers;
        setUsers(sortedUsers);
      }
    } catch (err: any) {
      // Ignora erros de abort
      if (err.name !== 'AbortError') {
        console.error('Erro ao buscar usuários:', err);
        setError(err.message || 'Falha ao carregar usuários.');
      }
    } finally {
      setIsLoading(false);
      fetchUsersAbortController.current = null;
    }
  }, [accessToken]);

  // Effect otimizado com cleanup
  useEffect(() => {
    fetchUsers();
    
    return () => {
      if (fetchUsersAbortController.current) {
        fetchUsersAbortController.current.abort();
      }
    };
  }, [fetchUsers]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (fetchUsersAbortController.current) {
        fetchUsersAbortController.current.abort();
      }
    };
  }, []);

  // Memoização dos dados paginados
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return users.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [users, currentPage]);

  const totalPages = useMemo(() => Math.ceil(users.length / ITEMS_PER_PAGE), [users.length]);

  // Handlers otimizados
  const handleOpenUserDetails = useCallback((user: User) => {
    setSelectedUser(user);
    setModalUserName(user.name || '');
    setModalIsActive(user.isActive !== undefined ? user.isActive : true);
    setModalIsSuperAdmin(user.isSuperAdmin || false);
    setModalError(null);
    setIsUserDetailsModalOpen(true);
  }, []);

  const handleCloseUserDetails = useCallback(() => {
    setSelectedUser(null);
    setIsUserDetailsModalOpen(false);
    setModalError(null);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Otimização: atualização local primeiro, depois sincronização
  const handleSaveChanges = useCallback(async () => {
    if (!selectedUser || !accessToken) {
      setModalError("Usuário selecionado ou token inválido.");
      return;
    }

    setModalError(null);
    setIsSavingUser(true);

    const updates: UserUpdate = {};
    const originalName = selectedUser.name || '';
    const originalIsActive = selectedUser.isActive !== undefined ? selectedUser.isActive : true;
    const originalIsSuperAdmin = selectedUser.isSuperAdmin || false;

    if (modalUserName !== originalName) {
      updates.name = modalUserName.trim() || undefined;
    }
    if (modalIsActive !== originalIsActive) {
      updates.isActive = modalIsActive;
    }

    const isMainSuperAdmin = selectedUser.email === SUPER_ADMIN_EMAIL;
    if (!isMainSuperAdmin && modalIsSuperAdmin !== originalIsSuperAdmin) {
      updates.isSuperAdmin = modalIsSuperAdmin;
    }

    if (Object.keys(updates).length === 0) {
      setModalError("Nenhuma alteração detectada.");
      setIsSavingUser(false);
      return;
    }

    try {
      // Atualização otimista da UI
      const updatedUser = { ...selectedUser, ...updates };
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === selectedUser.id ? updatedUser : user
        ).sort((a, b) => (a.email || '').localeCompare(b.email || ''))
      );

      const result = await superAdminService.updateUserProfileAsSuperAdmin(
        selectedUser.id, 
        updates, 
        accessToken
      );

      if (result.success) {
        usersCacheRef.current = users.map(user => 
          user.id === selectedUser.id ? updatedUser : user
        );
        handleCloseUserDetails();
      } else {
        // Reverte a atualização otimista em caso de erro
        setUsers(usersCacheRef.current);
        setModalError(result.message || "Falha ao salvar alterações no backend.");
      }
    } catch (err: any) {
      // Reverte a atualização otimista em caso de erro
      setUsers(usersCacheRef.current);
      setModalError(err.message || "Falha ao salvar alterações.");
    } finally {
      setIsSavingUser(false);
    }
  }, [selectedUser, accessToken, modalUserName, modalIsActive, modalIsSuperAdmin, users, handleCloseUserDetails]);

  // Memoização dos headers da tabela
  const userTableHeaders = useMemo((): TableHeader<User>[] => [
    { 
      key: 'name', 
      label: 'Nome', 
      renderCell: (user) => user.name || 'N/A' 
    },
    { 
      key: 'email', 
      label: 'Email' 
    },
    {
      key: 'isActive',
      label: 'Status Ativo',
      renderCell: (user) => {
        const isActive = user.isActive !== undefined ? user.isActive : true;
        return isActive ? (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-status-success/20 text-status-success">
            Sim
          </span>
        ) : (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-status-error/20 text-status-error">
            Não
          </span>
        );
      },
    },
    {
      key: 'isSuperAdmin',
      label: 'Super Admin?',
      renderCell: (user) => user.isSuperAdmin ? (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-accent-blue-neon/20 text-accent-blue-neon">
          Sim
        </span>
      ) : (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-neutral-700 text-text-muted">
          Não
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      renderCell: (user) => (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={(e) => { 
            e.stopPropagation(); 
            handleOpenUserDetails(user); 
          }} 
          className="text-accent-blue-neon hover:text-opacity-80"
        >
          Editar
        </Button>
      ),
    },
  ], [handleOpenUserDetails]);

  // Valores calculados memoizados
  const isCurrentUserSelected = useMemo(() => 
    selectedUser?.id === loggedInSuperAdmin?.id
  , [selectedUser?.id, loggedInSuperAdmin?.id]);

  const isMainSuperAdminSelected = useMemo(() => 
    selectedUser?.email === SUPER_ADMIN_EMAIL
  , [selectedUser?.email]);

  const isSaveDisabled = useMemo(() => 
    isSavingUser ||
    (isMainSuperAdminSelected && modalIsSuperAdmin === false) ||
    (isCurrentUserSelected && isMainSuperAdminSelected && modalIsActive === false)
  , [isSavingUser, isMainSuperAdminSelected, modalIsSuperAdmin, isCurrentUserSelected, modalIsActive]);

  if (isLoading && users.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
        <p className="ml-2 text-text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <UserGroupIcon className="h-8 w-8 text-accent-blue-neon" />
        <h1 className="text-3xl font-display font-bold text-text-strong">
          Todos os Usuários ({users.length})
        </h1>
      </div>

      {error && (
        <p className="text-status-error bg-status-error/10 p-3 rounded-xl border border-status-error/30">
          {error}
        </p>
      )}
      
      <Card className="p-0 sm:p-0">
        <Table<User>
          headers={userTableHeaders}
          data={paginatedUsers}
          rowKey="id"
          isLoading={isLoading}
          onRowClick={handleOpenUserDetails}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          itemsPerPage={ITEMS_PER_PAGE}
          totalItems={users.length}
          emptyStateMessage="Nenhum usuário encontrado na plataforma."
        />
      </Card>

      {selectedUser && (
        <Modal 
          isOpen={isUserDetailsModalOpen} 
          onClose={handleCloseUserDetails} 
          title={`Editar Usuário: ${selectedUser.name || selectedUser.email}`}
        >
          <div className="space-y-4">
            <div>
              <span className="font-semibold text-text-muted">ID:</span>{' '}
              <span className="text-text-default">{selectedUser.id}</span>
            </div>
            <div>
              <span className="font-semibold text-text-muted">Email:</span>{' '}
              <span className="text-text-default">{selectedUser.email}</span>
            </div>
            <Input
              label="Nome"
              value={modalUserName}
              onChange={(e) => setModalUserName(e.target.value)}
              disabled={isSavingUser}
            />
            <ToggleSwitch
              label="Conta Ativa"
              enabled={modalIsActive}
              onEnabledChange={setModalIsActive}
              disabled={isSavingUser || (isCurrentUserSelected && isMainSuperAdminSelected)}
            />
            <ToggleSwitch
              label="Status de Super Admin"
              enabled={modalIsSuperAdmin}
              onEnabledChange={setModalIsSuperAdmin}
              disabled={isSavingUser || isMainSuperAdminSelected}
            />
            
            {modalError && (
              <p className="text-sm text-status-error p-2 bg-status-error/10 rounded-xl border border-status-error/30">
                {modalError}
              </p>
            )}
            
            {isCurrentUserSelected && isMainSuperAdminSelected && (
              <p className="text-xs text-status-warning bg-status-warning/10 p-2 rounded-md border border-status-warning/30">
                As configurações de atividade para o usuário Super Admin principal ({SUPER_ADMIN_EMAIL}) não podem ser alteradas por aqui. O status de Super Admin também é fixo.
              </p>
            )}
            
            {isMainSuperAdminSelected && !isCurrentUserSelected && (
              <p className="text-xs text-status-warning bg-status-warning/10 p-2 rounded-md border border-status-warning/30">
                O status de Super Admin para o e-mail ({SUPER_ADMIN_EMAIL}) é gerenciado automaticamente e não pode ser desmarcado aqui.
              </p>
            )}
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <Button 
              variant="ghost" 
              onClick={handleCloseUserDetails} 
              disabled={isSavingUser}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveChanges}
              isLoading={isSavingUser}
              disabled={isSaveDisabled}
            >
              Salvar Alterações
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SuperAdminUsersPage;
