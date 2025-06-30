
import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AuditLogEntry } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { TableCellsIcon } from '@heroicons/react/24/outline';
import { superAdminService } from '@/services/superAdminService';
import { Table, TableHeader } from '@/components/ui/Table'; // Import Table

const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const actionTypeLabels: Record<string, string> = {
    PLATFORM_SETTINGS_UPDATE: "Atualização Config. Plataforma",
    USER_STATUS_CHANGE: "Mudança Status Usuário",
    USER_SUPERADMIN_CHANGE: "Mudança Permissão Super Admin",
    USER_DETAILS_UPDATE: "Atualização Detalhes Usuário",
};

const getActionTypeLabel = (actionType: string): string => {
    return actionTypeLabels[actionType] || actionType;
};

const SuperAdminAuditLogPage: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuth();

  const [selectedLogEntry, setSelectedLogEntry] = useState<AuditLogEntry | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    if (!accessToken) {
      setError("Autenticação de super admin necessária.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const logsData = await superAdminService.getAllAuditLogs(accessToken);
      setAuditLogs(logsData);
    } catch (err: any) {
      if (err.message && err.message.includes('relation "public.audit_log_entries" does not exist') || (err.code && err.code === '42P01')) {
        setError("A tabela de logs de auditoria (audit_log_entries) parece não existir no banco de dados. Por favor, crie-a para visualizar os logs.");
      } else {
        setError(err.message || 'Falha ao carregar logs de auditoria.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleOpenDetailsModal = (logEntry: AuditLogEntry) => {
    setSelectedLogEntry(logEntry);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedLogEntry(null);
    setIsDetailsModalOpen(false);
  };

  const auditLogTableHeaders: TableHeader<AuditLogEntry>[] = [
    { key: 'timestamp', label: 'Data/Hora', renderCell: (log) => formatTimestamp(log.timestamp) },
    { key: 'actorEmail', label: 'Ator (Email)' },
    { key: 'actionType', label: 'Tipo de Ação', renderCell: (log) => getActionTypeLabel(log.actionType) },
    { key: 'description', label: 'Descrição', className: 'max-w-md' },
    {
      key: 'target',
      label: 'Alvo',
      renderCell: (log) => (
        log.targetEntityType && log.targetEntityId ? `${log.targetEntityType}: ${log.targetEntityId.substring(0,15)}...` : 'N/A'
      ),
    },
    {
      key: 'details',
      label: 'Detalhes',
      renderCell: (log) => (
        log.details && Object.keys(log.details).length > 0 && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenDetailsModal(log); }} className="text-accent-blue-neon hover:text-opacity-80">
            Ver Detalhes
          </Button>
        )
      ),
    },
  ];

  if (isLoading && auditLogs.length === 0) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /><p className="ml-2 text-text-muted">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <TableCellsIcon className="h-8 w-8 text-accent-blue-neon" />
        <h1 className="text-3xl font-display font-bold text-text-strong">Log de Auditoria ({auditLogs.length})</h1>
      </div>

      {error && <p className="text-status-error bg-status-error/10 p-3 rounded-xl border border-status-error/30">{error}</p>}

      <Card className="p-0 sm:p-0">
        <Table<AuditLogEntry>
            headers={auditLogTableHeaders}
            data={auditLogs}
            rowKey="id"
            isLoading={isLoading}
            emptyStateMessage={error || "Nenhuma entrada de log de auditoria encontrada."}
        />
      </Card>

      {selectedLogEntry && selectedLogEntry.details && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={handleCloseDetailsModal}
          title={`Detalhes do Log: ${selectedLogEntry.id.substring(0,10)}...`}
          size="lg"
        >
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <h4 className="font-semibold text-accent-gold">Detalhes da Ação:</h4>
            <pre className="bg-bg-main p-3 rounded-md text-xs whitespace-pre-wrap break-all border border-border-subtle text-text-default">
              {JSON.stringify(selectedLogEntry.details, null, 2)}
            </pre>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={handleCloseDetailsModal}>Fechar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SuperAdminAuditLogPage;
