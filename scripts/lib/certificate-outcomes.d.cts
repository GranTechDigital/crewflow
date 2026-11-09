import type {Prisma,PrismaClient} from '@prisma/client';
export function reconcileAcrossFiles(db:PrismaClient|Prisma.TransactionClient,input:{ambiente:string;usuarioId:number;usuarioNome:string;importacaoId?:number;fonteId?:number;chave?:string;tenantId?:string;sourceIds?:number[]}):Promise<number>;
