const https=require('node:https'),dns=require('node:dns/promises'),net=require('node:net'),fs=require('node:fs'),fsp=require('node:fs/promises');
const {Transform}=require('node:stream'),{pipeline}=require('node:stream/promises');
const {validateUrl}=require('./drake-document-delivery.cjs');
const blocked=new net.BlockList();for(const [ip,prefix]of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])blocked.addSubnet(ip,prefix,'ipv4');for(const [ip,prefix]of [['::',128],['::1',128],['fc00::',7],['fe80::',10],['ff00::',8],['2001:db8::',32]])blocked.addSubnet(ip,prefix,'ipv6');
async function target(value,config,lookup=dns.lookup){const url=validateUrl(value,config);let addresses;try{addresses=await lookup(url.hostname,{all:true,verbatim:true});}catch{throw Error('DOWNLOAD_DNS')};if(!addresses.length||addresses.some(row=>net.isIP(row.address)!==row.family||row.address.toLowerCase().startsWith('::ffff:')||blocked.check(row.address,row.family===6?'ipv6':'ipv4')))throw Error('DOWNLOAD_DESTINO_PRIVADO');return {url,address:addresses.find(row=>row.family===4)||addresses[0]};}
async function download(value,destination,config,{lookup=dns.lookup,request=https.request,maxBytes=100*1024*1024,timeoutMs=60000,signal}={},redirects=0){
 if(redirects>3)throw Error('DOWNLOAD_REDIRECTS');const {url,address}=await target(value,config,lookup);
 try{return await new Promise((resolve,reject)=>{
  let deadline;const success=value=>{clearTimeout(deadline);resolve(value);},fail=error=>{clearTimeout(deadline);reject(error);};
  const req=request(url,{method:'GET',headers:{Accept:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/octet-stream'},signal,lookup:(_host,options,callback)=>options?.all?callback(null,[address]):callback(null,address.address,address.family),servername:url.hostname},res=>{
    if([301,302,303,307,308].includes(res.statusCode)){res.resume();if(!res.headers.location)return fail(Error('DOWNLOAD_REDIRECT_INVALIDO'));clearTimeout(deadline);try{return download(new URL(res.headers.location,url).href,destination,config,{lookup,request,maxBytes,timeoutMs,signal},redirects+1).then(success,fail);}catch{return fail(Error('DOWNLOAD_REDIRECT_INVALIDO'));}}
    if(res.statusCode!==200){res.resume();return fail(Error(res.statusCode===429||res.statusCode>=500?'DOWNLOAD_TRANSITORIO':'DOWNLOAD_REJEITADO'));}
    if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.resume();return fail(Error('DOWNLOAD_COMPRESSAO_NAO_PERMITIDA'));}
    if(Number(res.headers['content-length'])>maxBytes){res.destroy();return fail(Error('DOWNLOAD_LIMITE'));}
    let bytes=0;const cap=new Transform({transform(chunk,_encoding,callback){bytes+=chunk.length;callback(bytes>maxBytes?Error('DOWNLOAD_LIMITE'):null,chunk);}});
    pipeline(res,cap,fs.createWriteStream(destination,{flags:'wx',mode:0o600})).then(()=>bytes?success({bytes,lastModified:res.headers['last-modified']||null}):fail(Error('DOWNLOAD_VAZIO')),fail);
  });
  deadline=setTimeout(()=>req.destroy(Error('DOWNLOAD_TIMEOUT')),timeoutMs);
  req.setTimeout(timeoutMs,()=>req.destroy(Error('DOWNLOAD_TIMEOUT')));req.on('error',error=>fail(Error(error.message==='DOWNLOAD_TIMEOUT'?'DOWNLOAD_TIMEOUT':'DOWNLOAD_REDE')));req.end();
 });}catch(error){await fsp.rm(destination,{force:true});throw Error(/^[A-Z_]+$/.test(error.message)?error.message:'DOWNLOAD_REDE');}
}
module.exports={target,download};
