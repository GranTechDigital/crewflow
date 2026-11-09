function normalizeCertificateEnvironment(value) {
 const text=String(value||'').trim().toLowerCase();
 return text==='hmg'?'hmg':['prd','production'].includes(text)?'prd':null;
}
module.exports={normalizeCertificateEnvironment};
