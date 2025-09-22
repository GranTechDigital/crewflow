// Store global para manter o progresso de uploads ativos
const uploadProgress = new Map<string, {
  total: number;
  processed: number;
  stage: string;
  message: string;
  completed: boolean;
  error?: string;
}>();

// Função para atualizar progresso
export function updateProgress(uploadId: string, progress: {
  total?: number;
  processed?: number;
  stage?: string;
  message?: string;
  completed?: boolean;
  error?: string;
}) {
  const current = uploadProgress.get(uploadId) || {
    total: 0,
    processed: 0,
    stage: 'starting',
    message: 'Iniciando...',
    completed: false
  };
  
  uploadProgress.set(uploadId, { ...current, ...progress });
  console.log(`[PROGRESS] ${uploadId}: ${progress.message || current.message} (${progress.processed || current.processed}/${progress.total || current.total})`);
}

// Função para inicializar progresso
export function initProgress(uploadId: string, total: number) {
  uploadProgress.set(uploadId, {
    total,
    processed: 0,
    stage: 'processing',
    message: 'Processando arquivo...',
    completed: false
  });
  console.log(`[PROGRESS] ${uploadId}: Iniciado com ${total} registros`);
}

// Função para finalizar progresso
export function completeProgress(uploadId: string, message: string) {
  const current = uploadProgress.get(uploadId);
  if (current) {
    uploadProgress.set(uploadId, {
      ...current,
      completed: true,
      message,
      processed: current.total
    });
    console.log(`[PROGRESS] ${uploadId}: Concluído - ${message}`);
  }
}

// Função para marcar erro
export function errorProgress(uploadId: string, error: string) {
  const current = uploadProgress.get(uploadId);
  if (current) {
    uploadProgress.set(uploadId, {
      ...current,
      error,
      message: `Erro: ${error}`
    });
    console.log(`[PROGRESS] ${uploadId}: Erro - ${error}`);
  }
}

// Função para obter progresso
export function getProgress(uploadId: string) {
  return uploadProgress.get(uploadId);
}

// Função para remover progresso
export function removeProgress(uploadId: string) {
  uploadProgress.delete(uploadId);
  console.log(`[PROGRESS] ${uploadId}: Removido`);
}