interface SyncOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  onProgress?: (message: string) => void;
}

interface SyncResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const syncWithRetry = async (options: SyncOptions = {}): Promise<SyncResult> => {
  const {
    maxRetries = 3,
    retryDelay = 2000,
    timeout = 60000, // 60 segundos
    onProgress
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      onProgress?.(`Tentativa ${attempt}/${maxRetries} - Iniciando sincronização...`);
      
      // Criar um AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch('/api/dados/sincronizar', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        },
        cache: 'no-store' // Evitar cache
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      
      // Verificar se a resposta contém um erro
      if (data.error) {
        throw new Error(data.error);
      }

      onProgress?.('Sincronização concluída com sucesso!');
      
      return {
        success: true,
        data
      };

    } catch (error) {
      lastError = error as Error;
      
      // Se foi cancelado por timeout
      if (error instanceof Error && error.name === 'AbortError') {
        onProgress?.(`Tentativa ${attempt} - Timeout na sincronização (${timeout/1000}s)`);
      } else {
        onProgress?.(`Tentativa ${attempt} - Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }

      // Se não é a última tentativa, aguarda antes de tentar novamente
      if (attempt < maxRetries) {
        const waitTime = retryDelay * Math.pow(2, attempt - 1); // Backoff exponencial
        onProgress?.(`Aguardando ${waitTime/1000} segundos antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  const errorMessage = lastError?.message || 'Erro desconhecido após todas as tentativas';
  onProgress?.(`Falha na sincronização: ${errorMessage}`);

  return {
    success: false,
    error: errorMessage
  };
};

export const formatSyncMessage = (data: any): string => {
  if (!data) return 'Sincronização concluída';
  
  const parts = [];
  if (data.adicionados) parts.push(`${data.adicionados} funcionários adicionados`);
  if (data.atualizados) parts.push(`${data.atualizados} funcionários atualizados`);
  if (data.demitidos) parts.push(`${data.demitidos} funcionários demitidos`);
  
  return parts.length > 0 
    ? `Sincronização concluída: ${parts.join(', ')}.`
    : 'Sincronização concluída sem alterações.';
};