import type {PrismaClient} from "@prisma/client";
export type DeliveryConfig={environment:string;tenantId:string;token:string;key:Buffer;hosts:string[];reportName:string|null;windowHours:number;captureUnknownStorage:boolean};
export function configuration(env?:NodeJS.ProcessEnv):DeliveryConfig;
export function authorized(header:string|null,token:string):boolean;
export function receive(db:PrismaClient,body:unknown,config:DeliveryConfig):Promise<{id:string;status:string;repetido:boolean;pendencia:string|null}>;
