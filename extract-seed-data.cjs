const fs = require("fs");
const path = require("path");

console.log("🔄 Extraindo dados do seed-complete.cjs...");

// Dados dos centros de custo
const centrosCusto = [
  {
    num_centro_custo: "6.21.01",
    nome_centro_custo: "Centro de Custo UN-BC-LOTE 2",
    status: "Ativo",
  },
  {
    num_centro_custo: "6.21.02",
    nome_centro_custo: "Centro de Custo Descomissionamento",
    status: "Ativo",
  },
  {
    num_centro_custo: "6.21.03",
    nome_centro_custo: "Centro de Custo PERENCO",
    status: "Ativo",
  },
  {
    num_centro_custo: "6.24.01",
    nome_centro_custo: "Centro de Custo UN-BS-O&M",
    status: "Ativo",
  },
  {
    num_centro_custo: "6.24.02",
    nome_centro_custo: "Centro de Custo UN-BS UMS/PAR",
    status: "Ativo",
  },
  {
    num_centro_custo: "6.25.01",
    nome_centro_custo: "Centro de Custo TVD UN-BC",
    status: "Ativo",
  },
];

// Dados dos contratos
const contratos = [
  {
    nome: "UN-BC-LOTE 2",
    numero: "4600677360",
    cliente: "Petrobras",
    dataInicio: "2025-01-01",
    dataFim: "2025-12-01",
    status: "Ativo",
  },
  {
    nome: "DESCOMISSIONAMENTO NO AÇU",
    numero: "4600677361",
    cliente: "Petrobras",
    dataInicio: "2025-01-01",
    dataFim: "2025-12-01",
    status: "Ativo",
  },
  {
    nome: "PERENCO - PCH-1 & PCH-2",
    numero: "4600677362",
    cliente: "Petrobras",
    dataInicio: "2025-01-01",
    dataFim: "2025-12-01",
    status: "Ativo",
  },
  {
    nome: "UN-BS-O&M SANTOS",
    numero: "4600679351",
    cliente: "Petrobras",
    dataInicio: "2025-01-01",
    dataFim: "2025-12-01",
    status: "Ativo",
  },
  {
    nome: "UN-BS | UMS/PAR",
    numero: "4600679352",
    cliente: "Petrobras",
    dataInicio: "2025-01-01",
    dataFim: "2025-12-01",
    status: "Ativo",
  },
  {
    nome: "TVD | UN-BC-LOTE 1",
    numero: "4600680673",
    cliente: "Petrobras",
    dataInicio: "2025-01-01",
    dataFim: "2025-12-01",
    status: "Ativo",
  },
];

// Dados das vinculações (relacionamento entre contratos e centros de custo)
const vinculacoes = [
  {
    contratoNumero: "4600677360",
    centroCustoNum: "6.21.01",
    descricao: "UN-BC-LOTE 2 -> Centro de Custo UN-BC-LOTE 2"
  },
  {
    contratoNumero: "4600677361",
    centroCustoNum: "6.21.02",
    descricao: "DESCOMISSIONAMENTO -> Centro de Custo Descomissionamento"
  },
  {
    contratoNumero: "4600677362",
    centroCustoNum: "6.21.03",
    descricao: "PERENCO -> Centro de Custo PERENCO"
  },
  {
    contratoNumero: "4600679351",
    centroCustoNum: "6.24.01",
    descricao: "UN-BS-O&M -> Centro de Custo UN-BS-O&M"
  },
  {
    contratoNumero: "4600679352",
    centroCustoNum: "6.24.02",
    descricao: "UN-BS UMS/PAR -> Centro de Custo UN-BS UMS/PAR"
  },
  {
    contratoNumero: "4600680673",
    centroCustoNum: "6.25.01",
    descricao: "TVD -> Centro de Custo TVD UN-BC"
  },
];

// Dados das equipes
const equipes = [
  {
    nome: "RH",
    descricao: "Recursos Humanos - Gestão de pessoal e processos administrativos",
  },
  {
    nome: "Treinamento",
    descricao: "Capacitação e desenvolvimento de funcionários",
  },
  {
    nome: "Medicina",
    descricao: "Medicina do trabalho e saúde ocupacional",
  },
  {
    nome: "Logística",
    descricao: "Gestão logística e operacional",
  },
  {
    nome: "Planejamento",
    descricao: "Planejamento estratégico e gestão de contratos",
  },
  {
    nome: "Administração",
    descricao: "Administração geral do sistema",
  },
];

// Dados dos treinamentos
const treinamentos = [
  {
    treinamento: "REGRAS DE OURO",
    cargaHoraria: 60,
    validadeUnidade: "unico",
    validadeValor: 0,
  },
  {
    treinamento: "INTEGRAÇÃO",
    cargaHoraria: 480,
    validadeUnidade: "unico",
    validadeValor: 0,
  },
  {
    treinamento: "DIREÇÃO DEFENSIVA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "NR 10 BÁSICO",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 24,
  },
  {
    treinamento: "NR 10 SEP",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 24,
  },
  {
    treinamento: "NR 10 RECICLAGEM",
    cargaHoraria: 240,
    validadeUnidade: "mes",
    validadeValor: 24,
  },
  {
    treinamento: "NR 11",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "NR 12",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "NR 18",
    cargaHoraria: 360,
    validadeUnidade: "mes",
    validadeValor: 24,
  },
  {
    treinamento: "NR 20",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 36,
  },
  {
    treinamento: "NR 33",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "NR 34",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 36,
  },
  {
    treinamento: "NR 35",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 24,
  },
  {
    treinamento: "OPERADOR DE GUINDASTE",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE EMPILHADEIRA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE PLATAFORMA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE PONTE ROLANTE",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE TALHA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE TRATOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE GUINDAUTO",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE RETROESCAVADEIRA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE ESCAVADEIRA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE ROLO COMPACTADOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE MOTONIVELADORA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE PÁ CARREGADEIRA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE CAMINHÃO FORA DE ESTRADA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE CAMINHÃO MUNK",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE CAMINHÃO BASCULANTE",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE CAMINHÃO BETONEIRA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE CAMINHÃO PIPA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE CAMINHÃO COMBOIO",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE CAMINHÃO PRANCHA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE CAMINHÃO CARROCERIA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE CAMINHÃO BAÚ",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE CAMINHÃO CAÇAMBA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "Curso para Pintores emitido pelo CQ",
    cargaHoraria: 480,
    validadeUnidade: "unico",
    validadeValor: 0,
  },
  {
    treinamento: "PRIMEIROS SOCORROS",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 24,
  },
  {
    treinamento: "BRIGADA DE INCÊNDIO",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "CIPA",
    cargaHoraria: 1200,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "ESPAÇO CONFINADO - SUPERVISOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "ESPAÇO CONFINADO - VIGIA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "ESPAÇO CONFINADO - TRABALHADOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "TRABALHO EM ALTURA - SUPERVISOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 24,
  },
  {
    treinamento: "TRABALHO EM ALTURA - TRABALHADOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 24,
  },
  {
    treinamento: "ELETRICISTA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 24,
  },
  {
    treinamento: "SOLDADOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 36,
  },
  {
    treinamento: "MONTADOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 36,
  },
  {
    treinamento: "CALDEIREIRO",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 36,
  },
  {
    treinamento: "PINTOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 36,
  },
  {
    treinamento: "INSTRUMENTISTA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 36,
  },
  {
    treinamento: "MECÂNICO",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 36,
  },
  {
    treinamento: "ISOLADOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 36,
  },
  {
    treinamento: "ANDAIME",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "RIGGER",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "SINALEIRO",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "AMARRADOR DE CARGA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE GUINCHO",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE BATE ESTACA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE PERFURATRIZ",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE COMPRESSOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE GERADOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE BOMBA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE USINA DE CONCRETO",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE BRITADOR",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE DRAGA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
  {
    treinamento: "OPERADOR DE TRATOR DE ESTEIRA",
    cargaHoraria: 480,
    validadeUnidade: "mes",
    validadeValor: 12,
  },
];

// Dados das tarefas padrão
const tarefasPadrao = [
  // RH
  {
    setor: "RH",
    tipo: "RG",
    descricao: "Verificar e validar documento de identidade (RG)",
  },
  {
    setor: "RH",
    tipo: "CPF",
    descricao: "Verificar e validar CPF do funcionário",
  },
  {
    setor: "RH",
    tipo: "CTPS (ADMISSÃO E PROMOÇÃO)",
    descricao: "Processar Carteira de Trabalho para admissão e promoção",
  },
  {
    setor: "RH",
    tipo: "ESCOLARIDADE",
    descricao: "Verificar e validar comprovantes de escolaridade",
  },
  {
    setor: "RH",
    tipo: "COMPROVANTE DE RESIDÊNCIA",
    descricao: "Verificar e validar comprovante de residência atualizado",
  },
  {
    setor: "RH",
    tipo: "PIS",
    descricao: "Verificar e processar PIS do funcionário",
  },
  {
    setor: "RH",
    tipo: "COMPROVANTE DE QUITAÇÃO DE ANUIDADE (CREA OU CFT)",
    descricao: "Verificar quitação de anuidade do conselho profissional",
  },
  {
    setor: "RH",
    tipo: "CERTIFICADO DE FUNÇÃO (ADMISSÃO E PROMOÇÃO)",
    descricao: "Processar certificado de função para admissão e promoção",
  },
  // MEDICINA
  {
    setor: "MEDICINA",
    tipo: "ASO",
    descricao: "Realizar Atestado de Saúde Ocupacional (ASO)",
  },
  // TREINAMENTO
  {
    setor: "TREINAMENTO",
    tipo: "REGRAS DE OURO",
    descricao: "Treinamento sobre Regras de Ouro",
  },
  {
    setor: "TREINAMENTO",
    tipo: "CUIDADO COM AS MÃOS",
    descricao: "Treinamento de Cuidado com as Mãos",
  },
  {
    setor: "TREINAMENTO",
    tipo: "INTEGRAÇÃO DE SMS",
    descricao: "Integração de Sistema de Gestão de SMS",
  },
  {
    setor: "TREINAMENTO",
    tipo: "CBSP - SALVATAGEM",
    descricao: "Curso Básico de Segurança de Plataforma - Salvatagem",
  },
  {
    setor: "TREINAMENTO",
    tipo: "T-HUET",
    descricao: "Treinamento de Escape Subaquático de Helicóptero",
  },
  {
    setor: "TREINAMENTO",
    tipo: "CESS - CURSO DE EMBARCAÇÕES DE SOBREVIVENCIA E SALVAMENTO",
    descricao: "Curso de Embarcações de Sobrevivência e Salvamento",
  },
  {
    setor: "TREINAMENTO",
    tipo: "CERR - C de Embarc.Rápidas de Resgate",
    descricao: "Curso de Embarcações Rápidas de Resgate",
  },
  {
    setor: "TREINAMENTO",
    tipo: "CACI - CURSO AVANÇADO DE COMBATE A INCENDIO",
    descricao: "Curso Avançado de Combate a Incêndio",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-10 - ELETRICIDADE",
    descricao: "NR-10 - Segurança em Instalações e Serviços em Eletricidade",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-10 - ATM. EXPLOSIVA",
    descricao: "NR-10 - Atmosfera Explosiva",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-12 - MAQUINAS E EQUIPAMENTOS",
    descricao: "NR-12 - Segurança no Trabalho em Máquinas e Equipamentos",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-33 - ESPAÇO CONFINADO",
    descricao: "NR-33 - Segurança e Saúde nos Trabalhos em Espaços Confinados",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-33 EMERGENCIA E RESGATE - LÍDER",
    descricao: "NR-33 Emergência e Resgate - Líder",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-33 EMERGENCIA E RESGATE - OPERACIONAL",
    descricao: "NR-33 Emergência e Resgate - Operacional",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-34 - ADMISSIONAL",
    descricao: "NR-34 - Condições e Meio Ambiente de Trabalho na Indústria da Construção e Reparação Naval - Admissional",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-34 - OBSERVADOR DE TRABALHO À QUENTE",
    descricao: "NR-34 - Observador de Trabalho à Quente",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-34 - CURSO BÁSICO PARA TRABALHOS À QUENTE",
    descricao: "NR-34 - Curso Básico para Trabalhos à Quente",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-34 - CURSO BÁSICO DE SEGURANÇA EM TESTE DE ESTANQUEIDADE",
    descricao: "NR-34 - Curso Básico de Segurança em Teste de Estanqueidade",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-34.11 - CERTIFICADO TREINAMENTO PARA MONTAGEM DE ANDAIMES",
    descricao: "NR-34.11 - Certificado Treinamento para Montagem de Andaimes",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-35 - TRABALHO EM ALTURA",
    descricao: "NR-35 - Trabalho em Altura",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-37 - BÁSICO",
    descricao: "NR-37 - Segurança e Saúde em Plataformas de Petróleo - Básico",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-37 - AVANÇADO",
    descricao: "NR-37 - Segurança e Saúde em Plataformas de Petróleo - Avançado",
  },
  {
    setor: "TREINAMENTO",
    tipo: "NR-37 - MOVIMENTAÇÃO DE CARGA",
    descricao: "NR-37 - Movimentação de Carga",
  },
  {
    setor: "TREINAMENTO",
    tipo: "PE-1PBR-00223 – MS MOVIMENTAÇÃO DE CARGAS (ANEXO J)",
    descricao: "Procedimento de Movimentação de Cargas (Anexo J)",
  },
  {
    setor: "TREINAMENTO",
    tipo: "OPERAÇÃO COM PISTOLA HILTI",
    descricao: "Treinamento de Operação com Pistola Hilti",
  },
  {
    setor: "TREINAMENTO",
    tipo: "OPERAÇÃO COM MÁQUINA DE TORQUE",
    descricao: "Treinamento de Operação com Máquina de Torque",
  },
  {
    setor: "TREINAMENTO",
    tipo: "LIDERANÇA",
    descricao: "Treinamento de Liderança",
  },
  {
    setor: "TREINAMENTO",
    tipo: "ACESSO POR CORDAS",
    descricao: "Treinamento de Acesso por Cordas",
  },
  {
    setor: "TREINAMENTO",
    tipo: "Qualificação para Ajudantes",
    descricao: "Qualificação para Ajudantes",
  },
  {
    setor: "TREINAMENTO",
    tipo: "Qualificação para Inspetores",
    descricao: "Qualificação para Inspetores",
  },
  {
    setor: "TREINAMENTO",
    tipo: "Curso para Pintores emitido pelo CQ",
    descricao: "Curso para Pintores emitido pelo Controle de Qualidade",
  },
  {
    setor: "TREINAMENTO",
    tipo: "FORMAÇÃO HIDROJATISTA",
    descricao: "Formação de Hidrojatista",
  },
  {
    setor: "TREINAMENTO",
    tipo: "EMITENTE DE PT",
    descricao: "Treinamento para Emitente de Permissão de Trabalho",
  },
  {
    setor: "TREINAMENTO",
    tipo: "PERMISSÃO DE TRABALHO - PT",
    descricao: "Treinamento de Permissão de Trabalho",
  },
  {
    setor: "TREINAMENTO",
    tipo: "PROCEDIMENTOS GRANSERVICES",
    descricao: "Treinamento de Procedimentos GranServices",
  },
  {
    setor: "TREINAMENTO",
    tipo: "PROCEDIMENTOS PETROBRAS",
    descricao: "Treinamento de Procedimentos Petrobras",
  },
];

// Dados do funcionário administrador
const funcionarioAdmin = {
  matricula: "ADMIN001",
  nome: "Administrador do Sistema",
  email: "admin@gransystem.com",
  funcao: "Administrador",
  departamento: "TI",
  status: "ATIVO",
  senha: "admin123",
  equipe: "Administração"
};

// Criar diretório se não existir
const seedsDir = path.join(__dirname, "seeds", "data");
if (!fs.existsSync(seedsDir)) {
  fs.mkdirSync(seedsDir, { recursive: true });
}

// Salvar cada conjunto de dados em arquivos JSON separados
const arquivos = [
  { nome: "centros-custo.json", dados: centrosCusto },
  { nome: "contratos.json", dados: contratos },
  { nome: "vinculacoes.json", dados: vinculacoes },
  { nome: "equipes.json", dados: equipes },
  { nome: "treinamentos.json", dados: treinamentos },
  { nome: "tarefas-padrao.json", dados: tarefasPadrao },
  { nome: "funcionario-admin.json", dados: funcionarioAdmin },
];

console.log("📁 Salvando arquivos JSON...");
arquivos.forEach(({ nome, dados }) => {
  const caminho = path.join(seedsDir, nome);
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), "utf8");
  console.log(`✅ ${nome} - ${Array.isArray(dados) ? dados.length : 1} registros`);
});

// Atualizar seed-config.json
const configPath = path.join(__dirname, "seeds", "config", "seed-config.json");
let config = {};
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
}

// Adicionar novos arquivos à configuração
const novosArquivos = {
  "centros-custo.json": {
    path: "data/centros-custo.json",
    description: "Centros de custo do sistema",
    records: centrosCusto.length
  },
  "contratos.json": {
    path: "data/contratos.json", 
    description: "Contratos da empresa",
    records: contratos.length
  },
  "vinculacoes.json": {
    path: "data/vinculacoes.json",
    description: "Vinculações entre contratos e centros de custo",
    records: vinculacoes.length
  },
  "equipes.json": {
    path: "data/equipes.json",
    description: "Equipes do sistema",
    records: equipes.length
  },
  "treinamentos.json": {
    path: "data/treinamentos.json",
    description: "Treinamentos disponíveis",
    records: treinamentos.length
  },
  "tarefas-padrao.json": {
    path: "data/tarefas-padrao.json",
    description: "Tarefas padrão por setor",
    records: tarefasPadrao.length
  },
  "funcionario-admin.json": {
    path: "data/funcionario-admin.json",
    description: "Dados do funcionário administrador",
    records: 1
  }
};

config.files = { ...config.files, ...novosArquivos };
config.version = "2.1.0";
config.lastUpdated = new Date().toISOString();

// Calcular total de registros
const totalRecords = Object.values(config.files).reduce((sum, file) => sum + file.records, 0);
config.totalRecords = totalRecords;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
console.log("✅ seed-config.json atualizado");

console.log("\n🎉 Extração concluída!");
console.log(`📊 Total de registros extraídos: ${totalRecords}`);
console.log("📁 Arquivos criados na pasta seeds/data/");