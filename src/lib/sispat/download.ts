/** Não transforma respostas de erro ou páginas HTML em arquivos .xlsx. */
export async function readSispatWorkbookDownload(response: Response): Promise<Blob> {
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sessão expirada. Entre novamente para baixar o modelo.');
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.error === 'string' ? body.error : 'Não foi possível baixar o modelo. Tente novamente.');
  }
  if (!response.headers.get('content-type')?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) throw new Error('O servidor não retornou uma planilha XLSX. Tente novamente.');
  const blob = await response.blob();
  const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 0x03 || signature[3] !== 0x04) throw new Error('O modelo recebido não é um XLSX válido. Tente novamente.');
  return blob;
}
