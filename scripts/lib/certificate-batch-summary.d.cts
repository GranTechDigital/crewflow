export function summarize(groups:{status:string;_count:{_all:number}}[],batch:{status:string;envioToken:string|null}):{
 status:string;totalPendentes:number;totalEnviadas:number;totalConfirmadas:number;totalNaoConfirmadas:number;totalErroValidacao:number;totalErroDrake:number;totalConflitos:number;totalValidas:number;totalDuplicadas:number;totalLinhas:number;
};
