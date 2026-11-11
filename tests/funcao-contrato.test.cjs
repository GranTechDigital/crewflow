const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./certificados-loader.cjs');

test('valida o ID da função no contrato, inclusive vínculo sem treinamento', async () => {
  const funcionarios = [
    { id: 1, nome: 'Ana', matricula: '1', funcaoId: 10, funcaoRef: { ativo: true } },
    { id: 2, nome: 'Bia', matricula: '2', funcaoId: 11, funcaoRef: { ativo: true } },
    { id: 3, nome: 'Caio', matricula: '3', funcaoId: null, funcaoRef: null },
    { id: 4, nome: 'Dora', matricula: '4', funcaoId: 12, funcaoRef: { ativo: false } },
  ];
  const prisma = {
    funcionario: { findMany: async ({ where }) => { assert.deepEqual(where.id.in, [1, 2, 3, 4]); return funcionarios; } },
    matrizTreinamento: { findMany: async ({ where }) => {
      assert.equal(where.contratoId, 5);
      assert.deepEqual(where.funcaoId.in, [10, 11]);
      assert.equal(where.treinamentoId, undefined);
      return [{ funcaoId: 10 }];
    } },
  };
  const { verificarFuncoesContrato } = loader({ '@/lib/prisma': { prisma } })('src/lib/validacaoFuncaoContrato.ts');
  assert.deepEqual(await verificarFuncoesContrato(5, [1, 2, 3, 4]), [
    { id: 2, nome: 'Bia', matricula: '2', motivo: 'FUNCAO_NAO_CADASTRADA' },
    { id: 3, nome: 'Caio', matricula: '3', motivo: 'FUNCAO_INDEFINIDA' },
    { id: 4, nome: 'Dora', matricula: '4', motivo: 'FUNCAO_INDEFINIDA' },
  ]);
});
