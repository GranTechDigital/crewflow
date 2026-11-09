// Regra única para o app e o worker: contagens e situação do carregamento.
function summarize(groups, batch) {
 const count=status=>groups.find(row=>row.status===status)?._count._all||0;
 const totalPendentes=count('PENDENTE_ENVIO'),totalEnviadas=count('ENVIADO'),totalConfirmadas=count('CONFIRMADO'),totalNaoConfirmadas=count('NAO_CONFIRMADO');
 const totalErroValidacao=count('ERRO_VALIDACAO'),totalErroDrake=count('ERRO_DRAKE'),totalConflitos=count('CONFLITO_ATUALIZACAO')+count('POSSIVEL_DUPLICIDADE')+count('REFERENCIA_INDISPONIVEL');
 const status=batch.status==='SUBSTITUIDO'?'SUBSTITUIDO':batch.envioToken||count('ENVIANDO')?'ENVIANDO':totalErroValidacao+totalErroDrake+totalConflitos+totalNaoConfirmadas+count('DUPLICADO_NO_ARQUIVO')>0?'CONCLUIDO_COM_ERROS':totalPendentes?'AGUARDANDO_CONFIRMACAO':totalEnviadas?'PROCESSANDO_DRAKE':'CONCLUIDO';
 return {status,totalPendentes,totalEnviadas,totalConfirmadas,totalNaoConfirmadas,totalErroValidacao,totalErroDrake,totalConflitos,totalValidas:totalPendentes+totalEnviadas+totalConfirmadas+count('DUPLICADO_JA_PROCESSADO'),totalDuplicadas:count('DUPLICADO_NO_ARQUIVO')+count('DUPLICADO_JA_PROCESSADO'),totalLinhas:groups.reduce((sum,row)=>sum+row._count._all,0)};
}
module.exports={summarize};
