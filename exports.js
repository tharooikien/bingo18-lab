'use strict';
const Export11={
 xml:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,''),
 csvCell(v){let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'},
 csv(rows){return '\ufeff'+rows.map(r=>r.map(v=>this.csvCell(v)).join(';')).join('\r\n')},
 parseCsv(text){
  text=text.replace(/^\ufeff/,'');const delimiter=text.split(/\r?\n/,1)[0].includes(';')?';':',';
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=ch;}
   else if(ch==='"'&&!cell&&!closed)quoted=true;else if(ch===delimiter){row.push(cell);cell='';closed=false;}
   else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';closed=false;}
   else{if(closed)throw Error('CSV có ký tự sau dấu đóng ngoặc kép');if(ch==='"')throw Error('CSV có dấu ngoặc kép sai vị trí');cell+=ch;}
  }
  if(quoted)throw Error('CSV thiếu dấu đóng ngoặc kép');row.push(cell);if(row.some(v=>v!==''))rows.push(row);return rows;
 },
 datasets(draws,receipts){
  const history=[['Ma ky','Ngay','So 1','So 2','So 3','Tong','Loai','Nguon'],...draws.map(r=>[r.id,r.date,...r.nums,r.sum,type(r.sum),r.source||'Minh Ngọc'])];
  const stats=[['Tong','So ky','Ty le mau','Xac suat ly thuyet','So ky mau'],...T.map(t=>{const n=draws.filter(r=>r.sum===t).length;return [t,n,draws.length?n/draws.length:0,ways[t]/216,draws.length]})];
  const reviews=[['Ma ky','Gio luu UTC','So 1','So 2','So 3','Tong goi y','Ket qua','Tong thuc','Trung tong','So trung','Trang thai','Xac minh gio quay'],...receipts.map(r=>{const o=Lab10.outcome(r,draws);return [r.target_id,r.saved_at,...r.nums,r.sum,o.actual?.nums.join('-')||'',o.actual?.sum??'',o.state==='compared'?(o.total?'Có':'Không'):'',o.matched??'',o.label,'Chưa xác minh']})];
  return [{name:'Lich su',rows:history},{name:'Thong ke',rows:stats},{name:'Doi chieu',rows:reviews}];
 },
 // ZIP with uncompressed entries: native XLSX, no third-party CDN or network required.
 zip(files){
  const enc=new TextEncoder(),parts=[],central=[];let offset=0;
  const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0};
  const header=(size,fields)=>{const a=new Uint8Array(size),v=new DataView(a.buffer);for(const [at,n,width] of fields)width===2?v.setUint16(at,n,true):v.setUint32(at,n,true);return a};
  for(const [name,text] of files){const n=enc.encode(name),b=enc.encode(text),sum=crc(b);
   const local=header(30,[[0,0x04034b50,4],[4,20,2],[10,0,2],[12,33,2],[14,sum,4],[18,b.length,4],[22,b.length,4],[26,n.length,2]]);
   parts.push(local,n,b);central.push(header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[12,0,2],[14,33,2],[16,sum,4],[20,b.length,4],[24,b.length,4],[28,n.length,2],[42,offset,4]]),n);offset+=30+n.length+b.length;
  }
  const centralSize=central.reduce((n,a)=>n+a.length,0),end=header(22,[[0,0x06054b50,4],[8,files.length,2],[10,files.length,2],[12,centralSize,4],[16,offset,4]]);
  return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 },
 xlsx(sheets){
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships',xml=this.xml;
  const files=[['[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>'],
  ['_rels/.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ['xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="${rel}/styles" Target="styles.xml"/>${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`]];
  files.push(['xl/styles.xml',`<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF126346"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="10" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`]);
  const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
  sheets.forEach((s,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${s.rows[0].length}" width="28" customWidth="1"/></cols><sheetData>${s.rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>typeof v==='number'&&Number.isFinite(v)?`<c r="${col(ci)}${ri+1}" s="${ri===0?1:s.name==='Thong ke'&&(ci===2||ci===3)?2:0}"><v>${v}</v></c>`:`<c r="${col(ci)}${ri+1}" s="${ri===0?1:0}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${col(s.rows[0].length-1)}${s.rows.length}"/></worksheet>`]));
  return this.zip(files);
 },
 download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)},
 async export(format){try{const draws=Lab10.persistent?await Lab10.all('draws'):current,receipts=Lab10.persistent?await Lab10.all('receipts'):Lab10.receipts;draws.sort((a,b)=>Number(b.id)-Number(a.id));const sheets=this.datasets(draws,receipts),date=new Date().toISOString().slice(0,10);if(format==='xlsx')this.download(this.xlsx(sheets),'Bingo18_'+date+'.xlsx');else{const i=Number(document.getElementById('csvDataset').value);this.download(new Blob([this.csv(sheets[i].rows)],{type:'text/csv;charset=utf-8'}),'Bingo18_'+['lich_su','thong_ke','doi_chieu'][i]+'_'+date+'.csv')}Lab10.showError('Đã tạo tệp xuất. Kiểm tra thư mục tải xuống của trình duyệt.');}catch(e){Lab10.showError('Xuất chưa thành công: '+e.message)}},
 async importCsv(file){if(!file)return;try{if(!Lab10.persistent)throw Error('Kho chưa sẵn sàng');if(file.size>20*1024*1024)throw Error('Tệp tối đa 20 MB');const rows=this.parseCsv(await file.text());const headers=['Ma ky','Ngay','So 1','So 2','So 3','Tong','Loai','Nguon'];if(rows[0]?.join('|')!==headers.join('|'))throw Error('Dùng CSV lịch sử do ứng dụng xuất, giữ nguyên hàng tiêu đề');if(rows.length>100001)throw Error('Tối đa 100.000 dòng');const data=rows.slice(1).map(r=>{if(r.length!==8)throw Error('Dòng CSV không đủ 8 cột');return {id:r[0],date:r[1],nums:r.slice(2,5).map(Number),sum:Number(r[5]),source:r[7]}});if(data.some(r=>!Lab10.valid(r)))throw Error('Có dòng sai mã kỳ, ngày hoặc ba số/tổng; chưa nhập dữ liệu');const report=await Lab10.merge(data,true);current=await Lab10.read();render();Lab10.showError(`Đã nhập ${report.added} kỳ; bỏ ${report.duplicates} trùng; giữ nguyên ${report.conflicts} mâu thuẫn. CSV không khôi phục gợi ý khóa; dùng JSON cho toàn bộ kho.`)}catch(e){Lab10.showError('Nhập CSV chưa thành công: '+e.message)}},
 bind(){document.getElementById('exportXlsx').onclick=()=>this.export('xlsx');document.getElementById('exportCsv').onclick=()=>this.export('csv');document.getElementById('importCsv').onchange=e=>this.importCsv(e.target.files[0]).finally(()=>{e.target.value=''})}
};
