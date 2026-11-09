const fs=require('node:fs');
/** CSV RFC-style com |, aspas duplas, registros multilinha e limite por registro. */
async function* csvRecords(file){
 const stream=fs.createReadStream(file,{encoding:'utf8'});let record=[],field='',state=0,skipLF=false,size=0,firstCharacter=true;
 const finish=()=>{record.push(field);field='';state=0;if(record.length>256)throw Error('CSV excede 256 colunas.');};
 for await(const chunk of stream)for(const ch of chunk){if(firstCharacter){firstCharacter=false;if(ch==='\uFEFF')continue;}if(skipLF){skipLF=false;if(ch==='\n')continue;}if(++size>1024*1024)throw Error('Registro CSV excede 1 MB.');
  if(state===1){if(ch==='"')state=2;else field+=ch;continue;}
  if(state===2&&ch==='"'){field+='"';state=1;continue;}
  if(ch==='|'||ch==='\r'||ch==='\n'){finish();if(ch!=='|'){yield record;record=[];size=0;skipLF=ch==='\r';}continue;}
  if(state===2){if(ch===' '||ch==='\t')continue;throw Error('CSV inválido após aspas.');}
  if(ch==='"'){if(field)throw Error('Aspas CSV inválidas.');state=1;}else field+=ch;
 }
 if(state===1)throw Error('CSV com aspas não encerradas.');if(field||record.length||state===2){finish();yield record;}
}
module.exports={csvRecords};
