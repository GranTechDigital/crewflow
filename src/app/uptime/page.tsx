'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { read, utils } from 'xlsx';

interface UptimeData {
  data: string;
  sistema: string;
  status: string;
  uptime: number;
  observacoes?: string;
}

export default function UptimePage() {
  const { user } = useAuth();
  const [uptimeData, setUptimeData] = useState<UptimeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadExcelData() {
      try {
        setLoading(true);
        const response = await fetch('/Uptime 26.08.2025.xlsx');
        
        if (!response.ok) {
          throw new Error('Não foi possível carregar o arquivo de uptime');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = read(arrayBuffer);
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = utils.sheet_to_json<UptimeData>(worksheet);
        setUptimeData(jsonData);
      } catch (err) {
        console.error('Erro ao carregar dados de uptime:', err);
        setError('Não foi possível carregar os dados de uptime. Por favor, tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    }
    
    loadExcelData();
  }, []);

  if (!user) {
    return <div className="p-8">Você precisa estar logado para acessar esta página.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Monitoramento de Uptime dos Sistemas</h1>
      
      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border-b text-left">Data</th>
                <th className="py-2 px-4 border-b text-left">Sistema</th>
                <th className="py-2 px-4 border-b text-left">Status</th>
                <th className="py-2 px-4 border-b text-left">Uptime (%)</th>
                <th className="py-2 px-4 border-b text-left">Observações</th>
              </tr>
            </thead>
            <tbody>
              {uptimeData.length > 0 ? (
                uptimeData.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 px-4 border-b">{item.data}</td>
                    <td className="py-2 px-4 border-b">{item.sistema}</td>
                    <td className="py-2 px-4 border-b">
                      <span 
                        className={`inline-block px-2 py-1 rounded ${item.status === 'Online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2 px-4 border-b">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${item.uptime > 99 ? 'bg-green-500' : item.uptime > 95 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                          style={{ width: `${item.uptime}%` }}
                        ></div>
                      </div>
                      <span className="text-sm ml-1">{item.uptime}%</span>
                    </td>
                    <td className="py-2 px-4 border-b">{item.observacoes || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-500">
                    Nenhum dado de uptime disponível
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}