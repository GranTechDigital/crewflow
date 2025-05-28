'use client';

import { useEffect, useState } from 'react';

type Pessoa = {
  matricula: string;
  cpf: string;
  nome: string;
  funcao: string;
  rg: string;
  orgaoEmissor: string;
  uf: string;
  dataNascimento: string | null;
  email: string;
  telefone: string;
  centroCusto: string;
  departamento: string;
  status: string;
};

// ✅ Função para formatar a data no formato brasileiro
function formatarDataBR(data: string | null): string {
  if (!data) return '';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function Home() {
  const [dados, setDados] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setLoading(true);
    fetch('/api/dados/leitura')
      .then((res) => res.json())
      .then((data) => {
        setDados(data);
        setLoading(false);
        setCurrentPage(1);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
      </div>
    );
  }

  const totalPages = Math.ceil(dados.length / itemsPerPage);

  const dadosPagina = dados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-6 max-w-full">
      <h1 className="text-2xl font-bold mb-4">Tabela de Dados</h1>

      <div className="mb-4 flex items-center gap-2">
        <label>Linhas por página:</label>
        <select
          className="border rounded px-2 py-1"
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
        >
          {[5, 10, 15, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto max-h-[600px] border border-gray-300 rounded">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="border px-2 py-1">Matrícula</th>
              <th className="border px-2 py-1">CPF</th>
              <th className="border px-2 py-1">Nome</th>
              <th className="border px-2 py-1">Função</th>
              <th className="border px-2 py-1">RG</th>
              <th className="border px-2 py-1">Órgão Emissor</th>
              <th className="border px-2 py-1">UF</th>
              <th className="border px-2 py-1">Data Nascimento</th>
              <th className="border px-2 py-1">Email</th>
              <th className="border px-2 py-1">Telefone</th>
              <th className="border px-2 py-1">Centro Custo</th>
              <th className="border px-2 py-1">Departamento</th>
              <th className="border px-2 py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {dadosPagina.map((pessoa, idx) => (
              <tr
                key={idx}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                <td className="border px-2 py-1">{pessoa.matricula}</td>
                <td className="border px-2 py-1">{pessoa.cpf}</td>
                <td className="border px-2 py-1">{pessoa.nome}</td>
                <td className="border px-2 py-1">{pessoa.funcao}</td>
                <td className="border px-2 py-1">{pessoa.rg}</td>
                <td className="border px-2 py-1">{pessoa.orgaoEmissor}</td>
                <td className="border px-2 py-1">{pessoa.uf}</td>
                <td className="border px-2 py-1">
                  {pessoa.dataNascimento ? formatarDataBR(pessoa.dataNascimento) : '-'}
                </td>
                <td className="border px-2 py-1">{pessoa.email}</td>
                <td className="border px-2 py-1">{pessoa.telefone}</td>
                <td className="border px-2 py-1">{pessoa.centroCusto}</td>
                <td className="border px-2 py-1">{pessoa.departamento}</td>
                <td className="border px-2 py-1">{pessoa.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between items-center text-sm">
        <span>
          Página {currentPage} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="bg-gray-200 px-3 py-1 rounded disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="bg-gray-200 px-3 py-1 rounded disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
