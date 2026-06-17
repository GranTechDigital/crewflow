export default function RelatoriosIndexPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Relatórios</h1>
        <p className="text-gray-600">Selecione um relatório no menu lateral.</p>
        <div className="mt-4">
          <a
            href="/relatorios/geral"
            className="inline-flex px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 mr-2"
          >
            Relatório Geral de Pendências
          </a>
          <a
            href="/logistica/desempenho-usuarios?aba=logistica&hideTabs=true&secao=desempenho"
            className="inline-flex px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 mr-2"
          >
            Desempenho da Logística
          </a>
          <a
            href="/logistica/desempenho-usuarios?aba=setores&hideTabs=true&secao=desempenho"
            className="inline-flex px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 mr-2"
          >
            Desempenho dos Setores
          </a>
          <a
            href="/logistica/desempenho-usuarios?aba=logistica&hideTabs=true&secao=status-remanejamentos"
            className="inline-flex px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Pendências da Logística
          </a>
          <a
            href="/relatorios/logistica-atuacao-individual"
            className="inline-flex px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 ml-2"
          >
            Atuação Individual Logística
          </a>
        </div>
      </div>
    </div>
  );
}
