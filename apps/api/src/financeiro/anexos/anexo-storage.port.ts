// Porta de armazenamento de arquivos. O domínio só conhece esta interface:
// em dev/CI o adapter grava em disco local; em produção troca-se por S3/R2/
// MinIO (mesmo padrão do BankingProviderPort) sem tocar em regra de negócio.
export interface AnexoStoragePort {
  salvar(chave: string, conteudo: Buffer): Promise<void>;
  ler(chave: string): Promise<Buffer>;
  remover(chave: string): Promise<void>;
}

export const ANEXO_STORAGE = Symbol("ANEXO_STORAGE");
