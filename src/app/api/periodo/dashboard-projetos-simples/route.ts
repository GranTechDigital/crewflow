import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mesReferencia = parseInt(searchParams.get('mesReferencia') || '0');
    const anoReferencia = parseInt(searchParams.get('anoReferencia') || '0');
    const regimeTrabalho = searchParams.get('regimeTrabalho');
    const projetos = searchParams.get('projetos');
    const status = searchParams.get('status');
    const statusFolha = searchParams.get('statusFolha');

    // Construir filtros WHERE
    const whereClause: Prisma.PeriodoSheetWhereInput = {};

    // Filtro de regime de trabalho (offshore/onshore) - usando regimeTratado padronizado
    if (regimeTrabalho) {
      whereClause.regimeTratado = regimeTrabalho.toUpperCase();
    }

    // Filtro de projetos (usando tabela otimizada)
    if (projetos) {
      const projetoIds = projetos.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (projetoIds.length > 0) {
        whereClause.projetoId = {
          in: projetoIds
        };
      }
    }

    // Filtro de status (usando tabela otimizada)
    if (status) {
      const statusIds = status.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (statusIds.length > 0) {
        whereClause.statusId = {
          in: statusIds
        };
      }
    }

    // Filtro de statusFolha
    if (statusFolha) {
      const statusFolhaValues = statusFolha.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (statusFolhaValues.length > 0) {
        whereClause.statusFolha = {
          in: statusFolhaValues
        };
      }
    }

    // Filtro de período
    if (mesReferencia && anoReferencia) {
      whereClause.mesReferencia = mesReferencia;
      whereClause.anoReferencia = anoReferencia;
    } else if (anoReferencia) {
      whereClause.anoReferencia = anoReferencia;
    }

    // Buscar informações do período para filtrar funcionários demitidos
    let periodoInicial: Date | null = null;
    let periodoFinal: Date | null = null;
    
    if (mesReferencia && anoReferencia) {
      const periodoUpload = await prisma.periodoUpload.findFirst({
        where: {
          mesReferencia: mesReferencia,
          anoReferencia: anoReferencia
        },
        select: {
          periodoInicial: true,
          periodoFinal: true
        },
        orderBy: {
          dataUpload: 'desc'
        }
      });
      
      if (periodoUpload) {
        periodoInicial = periodoUpload.periodoInicial;
        periodoFinal = periodoUpload.periodoFinal;
      }
    }

    // Buscar dados filtrados da tabela periodoSheet com relacionamentos
    const dados = await prisma.periodoSheet.findMany({
      where: whereClause,
      select: {
        matricula: true,
        nome: true,
        funcao: true,
        totalDiasPeriodo: true,
        regimeTrabalho: true,
        regimeTratado: true,
        statusFolha: true,
        mesReferencia: true,
        anoReferencia: true,
        dataDemissao: true, // Incluir data de demissão
        dataAdmissao: true, // Incluir data de admissão para cálculo
        status: {
          select: {
            id: true,
            categoria: true,
          },
        },
        projeto: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    // Filtrar funcionários demitidos dentro do período
    const dadosFiltrados = dados.filter((registro) => {
      // Se não há data de demissão, incluir o funcionário
      if (!registro.dataDemissao) {
        return true;
      }

      // Se não temos informações do período, incluir o funcionário (fallback)
      if (!periodoInicial || !periodoFinal) {
        return true;
      }

      // Verificar se a data de demissão é menor ou igual ao período final
      const dataDemissao = new Date(registro.dataDemissao);
      const isDemissaoAntesPeriodoFinal = dataDemissao <= periodoFinal;

      // Se a demissão foi antes ou durante o período, excluir o funcionário
      // Se a demissão é posterior ao período, manter (será tratado no próximo período)
      return !isDemissaoAntesPeriodoFinal;
    });

    console.log(`📊 Total de registros antes do filtro: ${dados.length}`);
    console.log(`📊 Total de registros após filtrar demitidos: ${dadosFiltrados.length}`);
    console.log(`📊 Funcionários demitidos no período excluídos: ${dados.length - dadosFiltrados.length}`);

    // Função para calcular dias do período baseado na data de admissão
    const calcularDiasPeriodo = (dataAdmissao: Date | null, mesReferencia: number, anoReferencia: number): number => {
      if (!dataAdmissao) {
        // Se não há data de admissão, assumir período completo
        return new Date(anoReferencia, mesReferencia, 0).getDate(); // Último dia do mês
      }

      const inicioMes = new Date(anoReferencia, mesReferencia - 1, 1);
      const fimMes = new Date(anoReferencia, mesReferencia, 0);
      
      // Se admissão foi antes do período, considerar período completo
      if (dataAdmissao <= inicioMes) {
        return fimMes.getDate();
      }
      
      // Se admissão foi durante o período, calcular dias restantes
      if (dataAdmissao >= inicioMes && dataAdmissao <= fimMes) {
        return fimMes.getDate() - dataAdmissao.getDate() + 1;
      }
      
      // Se admissão foi após o período, retornar 0
      return 0;
    };

    // Primeiro, agrupar dados por funcionário para calcular totais
    const funcionariosPorMatricula: Record<string, typeof dadosFiltrados> = {};
    
    dadosFiltrados.forEach((registro) => {
      if (!funcionariosPorMatricula[registro.matricula]) {
        funcionariosPorMatricula[registro.matricula] = [];
      }
      funcionariosPorMatricula[registro.matricula].push(registro);
    });

    // Agrupar por projeto e status, somando totalDiasPeriodo e coletando funcionários
    const dadosAgrupados: { [projeto: string]: { [status: string]: number } } = {};
    const funcionariosPorProjeto: Record<string, Map<string, {
      matricula: string;
      nome: string | null;
      funcao: string | null;
      status: string;
      totalDiasPeriodo: number;
    }>> = {};

    // Processar cada funcionário para calcular aguardando embarque corrigido
    Object.entries(funcionariosPorMatricula).forEach(([matricula, registros]) => {
      // Agrupar registros do funcionário por projeto
      const registrosPorProjeto: Record<string, typeof dadosFiltrados> = {};
      
      registros.forEach((registro) => {
        const projeto = registro.projeto?.nome || 'Projeto não definido';
        if (!registrosPorProjeto[projeto]) {
          registrosPorProjeto[projeto] = [];
        }
        registrosPorProjeto[projeto].push(registro);
      });

      // Processar cada projeto do funcionário
      Object.entries(registrosPorProjeto).forEach(([projeto, registrosProjeto]) => {
        // Calcular total de dias contabilizados para este funcionário neste projeto
        let totalDiasContabilizados = 0;
        let aguardandoEmbarqueAtual = 0;
        const dadosReferencia = registrosProjeto[0]; // Para pegar dados gerais do funcionário

        registrosProjeto.forEach((registro) => {
          let status = registro.status?.categoria || 'Status não definido';
          
          // Somar "Não Identificado" ao "Aguardando embarque"
          if (status === 'Não Identificado') {
            status = 'Aguardando embarque';
          }

          const totalDiasPeriodo = registro.totalDiasPeriodo || 0;
          totalDiasContabilizados += totalDiasPeriodo;

          // Guardar valor atual de aguardando embarque
          if (status === 'Aguardando embarque') {
            aguardandoEmbarqueAtual += totalDiasPeriodo;
          }
        });

        // Calcular total de dias esperados baseado na data de admissão
        const diasEsperados = calcularDiasPeriodo(
          dadosReferencia.dataAdmissao, 
          dadosReferencia.mesReferencia, 
          dadosReferencia.anoReferencia
        );

        // Calcular dias não contabilizados
         const diasNaoContabilizados = Math.max(0, diasEsperados - totalDiasContabilizados);
         let diasNaoContabilizadosRestantes = diasNaoContabilizados;

         // Processar cada registro normalmente, mas ajustar aguardando embarque
         registrosProjeto.forEach((registro) => {
           let status = registro.status?.categoria || 'Status não definido';
           
           // Somar "Não Identificado" ao "Aguardando embarque"
           if (status === 'Não Identificado') {
             status = 'Aguardando embarque';
           }
           
           let totalDiasPeriodo = registro.totalDiasPeriodo || 0;

           // Se for aguardando embarque, somar os dias não contabilizados
           if (status === 'Aguardando embarque' && diasNaoContabilizadosRestantes > 0) {
             totalDiasPeriodo += diasNaoContabilizadosRestantes;
             // Zerar para não somar novamente em outros registros do mesmo funcionário
             diasNaoContabilizadosRestantes = 0;
           }

          // Inicializar projeto se não existir
          if (!dadosAgrupados[projeto]) {
            dadosAgrupados[projeto] = {};
            funcionariosPorProjeto[projeto] = new Map();
          }

          // Inicializar status se não existir
          if (!dadosAgrupados[projeto][status]) {
            dadosAgrupados[projeto][status] = 0;
          }

          // Somar totalDiasPeriodo
          dadosAgrupados[projeto][status] += totalDiasPeriodo;

          // Agrupar funcionários por matrícula para evitar duplicatas
          const funcionarioKey = `${registro.matricula}-${status}`;
          if (funcionariosPorProjeto[projeto].has(funcionarioKey)) {
            // Se já existe, somar os dias
            const funcionarioExistente = funcionariosPorProjeto[projeto].get(funcionarioKey);
            if (funcionarioExistente) {
              funcionarioExistente.totalDiasPeriodo += totalDiasPeriodo;
            }
          } else {
            // Se não existe, adicionar novo
            funcionariosPorProjeto[projeto].set(funcionarioKey, {
              matricula: registro.matricula,
              nome: registro.nome,
              funcao: registro.funcao,
              status: status,
              totalDiasPeriodo: totalDiasPeriodo
            });
          }
        });

        // Se não havia registro de aguardando embarque mas há dias não contabilizados, criar um
         if (aguardandoEmbarqueAtual === 0 && diasNaoContabilizadosRestantes > 0) {
          const status = 'Aguardando embarque';
          
          // Inicializar projeto se não existir
          if (!dadosAgrupados[projeto]) {
            dadosAgrupados[projeto] = {};
            funcionariosPorProjeto[projeto] = new Map();
          }

          // Inicializar status se não existir
          if (!dadosAgrupados[projeto][status]) {
            dadosAgrupados[projeto][status] = 0;
          }

          // Somar dias não contabilizados
           dadosAgrupados[projeto][status] += diasNaoContabilizadosRestantes;

           // Adicionar funcionário
           const funcionarioKey = `${dadosReferencia.matricula}-${status}`;
           funcionariosPorProjeto[projeto].set(funcionarioKey, {
             matricula: dadosReferencia.matricula,
             nome: dadosReferencia.nome,
             funcao: dadosReferencia.funcao,
             status: status,
             totalDiasPeriodo: diasNaoContabilizadosRestantes
           });
        }
      });
    });

    // Buscar dados de uptime/downtime da tabela DowntimeSheet
    const downtimeData = await prisma.downtimeSheet.findMany({
      select: {
        codProjeto: true,
        nomeProjeto: true,
        uptime: true,
        downtime: true
      },
      orderBy: {
        dataUpload: 'desc'
      }
    });

    // Criar mapa de uptime/downtime por projeto
    const uptimeDowntimeMap = new Map();
    downtimeData.forEach(item => {
      const key = item.nomeProjeto || item.codProjeto;
      if (key && !uptimeDowntimeMap.has(key)) {
        uptimeDowntimeMap.set(key, {
          codProjeto: item.codProjeto,
          uptime: item.uptime || 0,
          downtime: item.downtime || 0
        });
      }
    });

    // Colunas específicas que queremos exibir SEMPRE (removendo Folga, Férias e Embarcado)
    const colunasDesejadas = [
      'Quantidade Efetivo',
      'Total Previsto',
      'Total Real',
      'Aguardando embarque',
      'Cadastro',
      'Medicina',
      'Treinamento',
      'Atestado',
      'Falta',
      'Processo de Demissão',
      'Uptime',
      'Downtime'
    ];

    // Converter para array de objetos para facilitar o uso no frontend
    const resultado = Object.entries(dadosAgrupados).map(([projeto, statusData]) => {
      const uptimeDowntime = uptimeDowntimeMap.get(projeto) || { codProjeto: '', uptime: 0, downtime: 0 };
      
      // Garantir que todas as colunas desejadas tenham valores (0 se não existirem)
      const statusDataCompleto: { [key: string]: number } = {};
      colunasDesejadas.forEach(coluna => {
        if (coluna === 'Quantidade Efetivo') {
          // Calcular quantidade de matrículas distintas
          const matriculasDistintas = new Set(
            Array.from(funcionariosPorProjeto[projeto].values()).map(func => func.matricula)
          );
          statusDataCompleto[coluna] = matriculasDistintas.size;
        } else if (coluna === 'Total Previsto') {
          // Calcular Total Previsto = dias do período * quantidade efetivo (matrículas únicas)
          const matriculasUnicas = new Set(
            Array.from(funcionariosPorProjeto[projeto].values()).map(func => func.matricula)
          );
          const quantidadeEfetivo = matriculasUnicas.size;
          
          // Calcular dias do período (assumindo período completo se não há filtros específicos)
          const mesRef = mesReferencia || new Date().getMonth() + 1;
          const anoRef = anoReferencia || new Date().getFullYear();
          const diasPeriodo = new Date(anoRef, mesRef, 0).getDate();
          
          statusDataCompleto[coluna] = diasPeriodo * quantidadeEfetivo;
        } else if (coluna === 'Total Real') {
          // Calcular Total Real = soma dos status: Pré-embarque, Embarcado, Folga, Férias, Base
          const statusParaSomar = ['Pré-embarque', 'Embarcado', 'Folga', 'Férias', 'Base'];
          statusDataCompleto[coluna] = statusParaSomar.reduce((soma, status) => {
            return soma + (statusData[status] || 0);
          }, 0);
        } else {
          statusDataCompleto[coluna] = statusData[coluna] || 0;
        }
      });

      // Calcular Uptime e Downtime
      const totalPrevisto = statusDataCompleto['Total Previsto'] || 0;
      const totalReal = statusDataCompleto['Total Real'] || 0;
      
      if (totalPrevisto > 0) {
        const uptime = (totalReal / totalPrevisto) * 100;
        const downtime = 100 - uptime;
        
        statusDataCompleto['Uptime'] = Math.round(uptime * 100) / 100; // Arredondar para 2 casas decimais
        statusDataCompleto['Downtime'] = Math.round(downtime * 100) / 100; // Arredondar para 2 casas decimais
      } else {
        statusDataCompleto['Uptime'] = 0;
        statusDataCompleto['Downtime'] = 0;
      }
      
      return {
        projeto,
        codProjeto: uptimeDowntime.codProjeto || '',
        statusData: statusDataCompleto,
        totalProjeto: Object.values(statusDataCompleto).reduce((sum, dias) => sum + dias, 0),
        funcionarios: Array.from(funcionariosPorProjeto[projeto].values()),
        uptime: statusDataCompleto['Uptime'] || 0,
        downtime: statusDataCompleto['Downtime'] || 0
      };
    });

    // Ordenar por total de dias do projeto (decrescente)
    resultado.sort((a, b) => b.totalProjeto - a.totalProjeto);
    
    // Usar sempre todas as colunas desejadas, independente se têm dados ou não
    const statusUnicos = colunasDesejadas;

    // Calcular totais gerais por status (garantindo que todas as colunas apareçam)
    const totaisGerais: { [status: string]: number } = {};
    statusUnicos.forEach(status => {
      if (status === 'Quantidade Efetivo') {
        // Para quantidade efetivo, contar matrículas únicas globalmente
        const todasMatriculas = new Set();
        resultado.forEach(projeto => {
          projeto.funcionarios.forEach(func => {
            todasMatriculas.add(func.matricula);
          });
        });
        totaisGerais[status] = todasMatriculas.size;
      } else if (status === 'Total Previsto') {
        // Para Total Previsto, somar todos os valores calculados por projeto
        // (cada projeto já calculou corretamente: dias do período * funcionários únicos do projeto)
        totaisGerais[status] = resultado.reduce((sum, projeto) => {
          return sum + (projeto.statusData[status] || 0);
        }, 0);
      } else if (status === 'Total Real') {
        // Para Total Real, somar todos os valores calculados por projeto
        // (cada projeto já calculou corretamente: soma dos status específicos)
        totaisGerais[status] = resultado.reduce((sum, projeto) => {
          return sum + (projeto.statusData[status] || 0);
        }, 0);
      } else if (status === 'Uptime') {
        // Para Uptime, calcular baseado nos totais gerais
        const totalPrevistoGeral = totaisGerais['Total Previsto'] || 0;
        const totalRealGeral = totaisGerais['Total Real'] || 0;
        if (totalPrevistoGeral > 0) {
          const uptimeGeral = (totalRealGeral / totalPrevistoGeral) * 100;
          totaisGerais[status] = Math.round(uptimeGeral * 100) / 100;
        } else {
          totaisGerais[status] = 0;
        }
      } else if (status === 'Downtime') {
        // Para Downtime, calcular baseado no Uptime geral
        const uptimeGeral = totaisGerais['Uptime'] || 0;
        totaisGerais[status] = Math.round((100 - uptimeGeral) * 100) / 100;
      } else {
        totaisGerais[status] = resultado.reduce((sum, projeto) => {
          return sum + (projeto.statusData[status] || 0);
        }, 0);
      }
    });

    // Buscar opções para os filtros
    
    // 1. Projetos disponíveis (apenas os que existem na tabela periodoSheet)
    const projetosUsados = await prisma.periodoSheet.findMany({
      where: {
        projetoId: {
          not: null
        }
      },
      select: {
        projetoId: true,
        projeto: {
          select: {
            id: true,
            nome: true
          }
        }
      },
      distinct: ['projetoId']
    });

    // Agrupar projetos únicos por ID (para manter projetos com mesmo nome mas IDs diferentes)
    const projetosUnicos = new Map();
    projetosUsados.forEach(item => {
      if (item.projeto && !projetosUnicos.has(item.projeto.id)) {
        projetosUnicos.set(item.projeto.id, {
          id: item.projeto.id,
          projeto: item.projeto.nome
        });
      }
    });
    const projetosDisponiveis = Array.from(projetosUnicos.values());

    // 2. Status disponíveis (apenas os que existem na tabela periodoSheet)
    const statusUsados = await prisma.periodoSheet.findMany({
      where: {
        statusId: {
          not: null
        }
      },
      select: {
        statusId: true,
        status: {
          select: {
            id: true,
            categoria: true
          }
        }
      },
      distinct: ['statusId']
    });

    // Agrupar status únicos por categoria (apenas os que existem nos dados)
    const statusUnicosMap = new Map();
    statusUsados.forEach(item => {
      if (item.status && !statusUnicosMap.has(item.status.categoria)) {
        statusUnicosMap.set(item.status.categoria, {
          id: item.status.id,
          categoria: item.status.categoria
        });
      }
    });
    const statusDisponiveis = Array.from(statusUnicosMap.values());

    // 3. StatusFolha disponíveis
    const statusFolhaDisponiveis = await prisma.periodoSheet.findMany({
      where: {
        statusFolha: {
          not: null
        }
      },
      select: {
        statusFolha: true
      },
      distinct: ['statusFolha'],
      orderBy: {
        statusFolha: 'asc'
      }
    });

    // 4. Períodos disponíveis
    const periodosDisponiveis = await prisma.periodoSheet.findMany({
      select: {
        mesReferencia: true,
        anoReferencia: true
      },
      distinct: ['mesReferencia', 'anoReferencia'],
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' }
      ]
    });

    return NextResponse.json({
      projetos: resultado,
      statusDisponiveis: statusUnicos,
      totaisGerais,
      resumo: {
        totalProjetos: resultado.length,
        totalRegistros: dadosFiltrados.length,
        totalDiasGeral: Object.values(totaisGerais).reduce((sum, dias) => sum + dias, 0)
      },
      filtros: {
        projetos: projetosDisponiveis,
        status: statusDisponiveis,
        statusFolha: statusFolhaDisponiveis.map(item => item.statusFolha).filter(Boolean),
        periodos: periodosDisponiveis,
        regimeTrabalho: ['OFFSHORE', 'ONSHORE']
      },
      filtrosAplicados: {
        regimeTrabalho,
        projetos: projetos ? 
          projetos.split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id))
            .map(id => {
              const projeto = projetosDisponiveis.find(p => p.id === id);
              return projeto ? projeto.projeto : `ID: ${id}`;
            }) : [],
        status: status ? 
          status.split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id))
            .map(id => {
              const statusItem = statusDisponiveis.find(s => s.id === id);
              return statusItem ? statusItem.categoria : `ID: ${id}`;
            }) : [],
        statusFolha: statusFolha ? statusFolha.split(',').map(s => s.trim()).filter(s => s.length > 0) : [],
        mesReferencia: mesReferencia || null,
        anoReferencia: anoReferencia || null,
        periodo: (mesReferencia && anoReferencia) ? `${mesReferencia}/${anoReferencia}` : null
      }
    });



  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}