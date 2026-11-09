import {normalizeCertificateEnvironment} from "../../../scripts/lib/certificate-environment.cjs";
import {CertificadoError} from "./certificadosDrakeShared";
export function certificateEnvironment() {
 const value=normalizeCertificateEnvironment(process.env.DRAKE_ENVIRONMENT);
 if(!value)throw new CertificadoError("Ambiente de certificados não configurado.",503);
 return value;
}
export function assertCertificateEnvironment(value:string) {
 if(value!==certificateEnvironment())throw new CertificadoError("Carregamento de outro ambiente. Operação bloqueada.",409);
}
