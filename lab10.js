'use strict';
// Device-local archive. No simulated draw is ever inserted into the history.
const Lab10={
 db:null, persistent:false, candidate:null, receipts:[], issues:[], feed:null, busy:false,
 async open(){
  return new Promise((resolve,reject)=>{
   const request=indexedDB.open('bingo18-lab-archive',1);
   request.onupgradeneeded=()=>{const d=request.result;for(const [name,keyPath] of [['draws','id'],['receipts','target_id'],['issues','id'],['meta','key']])d.createObjectStore(name,{keyPath});};
   request.onsuccess=()=>{this.db=request.result;this.db.onversionchange=()=>{this.db.close();this.persistent=false;this.showError('Kho đã đổi phiên bản. Tải lại trang để tiếp tục lưu.');};this.persistent=true;resolve();};
   request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Đóng tab Bingo18 cũ rồi tải lại trang.'));
  });
 },
 async all(name){return new Promise((resolve,reject)=>{const tx=this.db.transaction(name,'readonly'),r=tx.objectStore(name).getAll();let values;r.onsuccess=()=>{values=r.result};tx.oncomplete=()=>resolve(values);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Không đọc được kho'));});},
 async getMeta(key){const rows=await this.all('meta');return rows.find(r=>r.key===key)?.value;},
 async setMeta(key,value){return new Promise((resolve,reject)=>{const tx=this.db.transaction('meta','readwrite');tx.objectStore('meta').put({key,value});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Không lưu được'));});},
 validDate(s){if(!s)return true;const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);if(!m)return false;const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[1]},
 valid(r){return r&&/^\d{5,10}$/.test(String(r.id))&&Array.isArray(r.nums)&&r.nums.length===3&&r.nums.every(n=>Number.isInteger(n)&&n>=1&&n<=6)&&r.sum===r.nums.reduce((a,b)=>a+b,0)&&typeof r.date==='string'&&this.validDate(r.date);},
 canonical(r){return {id:String(Number(r.id)).padStart(7,'0'),date:r.date||'',nums:[...r.nums],sum:r.sum,source:typeof r.source==='string'?r.source:'Xổ Số Minh Ngọc'};},
 same(a,b){return a.nums.join(',')===b.nums.join(',')&&(!a.date||!b.date||a.date===b.date);},
 async merge(rows, imported=false){
  if(!this.persistent)throw Error('Chưa có kho lưu lâu dài');
  let added=0,duplicates=0,conflicts=0,invalid=0;
  await new Promise((resolve,reject)=>{
   const tx=this.db.transaction(['draws','issues'],'readwrite'),store=tx.objectStore('draws'),issues=tx.objectStore('issues');
   for(const raw of rows){
    if(!this.valid(raw)){invalid++;continue;}
    const row=this.canonical(raw),request=store.get(row.id);
    request.onsuccess=()=>{
     const old=request.result;
     if(!old){store.add({...row,first_seen_at:new Date().toISOString(),imported});added++;}
     else if(!this.same(old,row)){conflicts++;issues.put({id:'conflict:'+row.id+':'+row.nums.join('')+':'+row.date,draw_id:row.id,kind:'conflict',at:new Date().toISOString(),old:{nums:old.nums,date:old.date},incoming:{nums:row.nums,date:row.date}});}
     else{duplicates++;if(!old.date&&row.date)store.put({...old,date:row.date});}
    };
   }
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Giao dịch bị hủy'));
  });
  return {added,duplicates,conflicts,invalid};
 },
 async read(){
  const [draws,receipts,issues]=await Promise.all([this.all('draws'),this.all('receipts'),this.all('issues')]);
  this.receipts=receipts.sort((a,b)=>Number(b.target_id)-Number(a.target_id));this.issues=issues;
  return draws.sort((a,b)=>Number(b.id)-Number(a.id));
 },
 async ingest(rows,feed){
  this.feed=feed;
  if(!this.persistent)return rows.sort((a,b)=>Number(b.id)-Number(a.id));
  let report;try{report=await this.merge(rows);this.storageError=null;}catch(e){this.storageError=e.message||'Kho đầy hoặc bị chặn';this.showError('Chưa lưu được dữ liệu mới: '+this.storageError+'. Hãy sao lưu kho hiện tại.');throw Error('Lưu kho thất bại: '+this.storageError);}this.lastMerge=report;
  const result=await this.read();
  const old=await this.getMeta('latestSeen');
  if(result[0]&&(!old||old.id!==result[0].id))await this.setMeta('latestSeen',{id:result[0].id,at:feed.server_at||new Date().toISOString()});
  this.latestSeen=await this.getMeta('latestSeen');
  await this.setMeta('lastFeed',{...feed,rows:undefined});
  return result;
 },
 gaps(rows){let count=0;const ranges=[];for(let i=1;i<rows.length;i++){const low=Number(rows[i].id)+1,high=Number(rows[i-1].id)-1;if(high>=low){count+=high-low+1;if(ranges.length<8)ranges.push(low===high?String(low):low+'–'+high);}}return {count,ranges};},
 matching(pred,actual){const a=Array(7).fill(0),b=Array(7).fill(0);pred.forEach(n=>a[n]++);actual.forEach(n=>b[n]++);return a.reduce((s,n,i)=>s+Math.min(n,b[i]),0);},
 outcome(receipt,rows){
  const actual=rows.find(r=>r.id===receipt.target_id),conflict=this.issues.some(r=>r.draw_id===receipt.target_id)||(this.feed?.conflicts||[]).includes(receipt.target_id);
  if(conflict)return {state:'conflict',label:'Mâu thuẫn nguồn — chưa đối chiếu'};
  if(!actual)return {state:'pending',label:rows[0]&&Number(rows[0].id)>Number(receipt.target_id)?'Thiếu kết quả kỳ này':'Đang chờ kết quả'};
  const matched=this.matching(receipt.nums,actual.nums),total=receipt.sum===actual.sum;
  return {state:'compared',actual,matched,total,combo:matched===3,label:(total?'Trùng tổng':'Khác tổng')+' · trùng '+matched+'/3 số (không xét thứ tự)'};
 },
 showError(message){this.message=message;const el=document.getElementById('archiveMessage');if(el){el.textContent=message;el.className='warning';}},
 async boot(){
  try{
   await this.open();
   const rows=await this.read();this.feed=await this.getMeta('lastFeed');this.latestSeen=await this.getMeta('latestSeen');
   let client=await this.getMeta('clientId');if(!client){client=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');await this.setMeta('clientId',client);}this.clientId=client;
   if(navigator.storage?.persist)navigator.storage.persist().then(granted=>{this.retentionGranted=granted;this.render();}).catch(()=>{});
   this.bind();return rows;
  }catch(e){this.persistent=false;this.bind();this.showError('Không mở được kho lâu dài: '+e.message+'. Dữ liệu hiện tại chưa được lưu.');return [];}
 },
 bind(){
  document.getElementById('lockSuggestion').onclick=()=>this.lock();
  document.getElementById('backupArchive').onclick=()=>this.backup();
  document.getElementById('restoreArchive').onchange=e=>this.restore(e.target.files[0]).finally(()=>{e.target.value=''});
  document.getElementById('archiveLimit').onchange=()=>this.render();
 },
 async lock(){
  if(this.busy)return;
  this.busy=true;this.render();
  try{
   if(!this.persistent||!this.candidate)throw Error('Chưa có kho hoặc gợi ý để lưu');
   if(!this.feed||this.feed.status!=='ok')throw Error('Cần đồng bộ nguồn thành công trước khi khóa');
   const candidate={...this.candidate,nums:[...this.candidate.nums]};
   if(!candidate.base_id)throw Error('Gợi ý được tạo khi chưa có mốc kỳ. Nhấn Tạo gợi ý khác rồi lưu.');
   if(this.storageError)throw Error('Kho đang gặp lỗi lưu; sao lưu và kiểm tra dung lượng trước khi khóa gợi ý');
   const target=this.feed.pending_id;
   if(this.receipts.some(r=>r.target_id===target))throw Error('Kỳ này đã khóa một gợi ý; không sửa hoặc ghi đè');
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),25000);
   let res;try{res=await fetch('/api/checkpoint',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:this.clientId,base_id:candidate.base_id,nums:candidate.nums}),signal:ctrl.signal});}finally{clearTimeout(timer)}
   const receipt=await res.json();if(!res.ok)throw Error(receipt.error||'Máy chủ từ chối lưu');
   if(receipt.base_id!==candidate.base_id)throw Error('Mốc biên nhận đã thay đổi. Cập nhật nguồn rồi thử lại.');
   const recovered=receipt.nums?.join(',')!==candidate.nums.join(',');
   if(!/^\d{7,10}$/.test(receipt.target_id)||Number(receipt.target_id)!==Number(receipt.base_id)+1||!Array.isArray(receipt.nums)||receipt.nums.length!==3||receipt.nums.some(n=>!Number.isInteger(n)||n<1||n>6)||receipt.sum!==receipt.nums.reduce((a,b)=>a+b,0)||!Number.isFinite(Date.parse(receipt.saved_at)))throw Error('Biên nhận không hợp lệ');
   await new Promise((resolve,reject)=>{const tx=this.db.transaction('receipts','readwrite');tx.objectStore('receipts').add(receipt);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(Error('Kỳ này đã có gợi ý khóa hoặc không đủ chỗ lưu'));});
   await this.read();this.showError((recovered?'Đã lấy lại gợi ý máy chủ đã khóa trước đó cho kỳ #':'Đã khóa gợi ý cho kỳ #')+receipt.target_id+' theo giờ máy chủ. Nguồn chưa xác minh giờ quay.');
  }catch(e){this.showError(e.name==='AbortError'?'Lưu quá thời gian. Có thể máy chủ đã nhận; thử lại với cùng bộ số để lấy biên nhận.':e.message);}
  finally{this.busy=false;this.render();}
 },
 async backup(){
  try{
   if(!this.persistent)throw Error('Chưa có kho để sao lưu');
   const payload={format:'bingo18-lab-backup',version:1,exported_at:new Date().toISOString(),draws:await this.all('draws'),receipts:await this.all('receipts'),issues:await this.all('issues')};
   const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Bingo18_10_backup_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.showError('Đã tạo tệp sao lưu. Giữ tệp để khôi phục khi đổi thiết bị.');
  }catch(e){this.showError('Sao lưu chưa thành công: '+e.message);}
 },
 async restore(file){
  if(!file)return;
  try{
   if(!this.persistent)throw Error('Kho chưa sẵn sàng');if(file.size>20*1024*1024)throw Error('Tệp tối đa 20 MB');
   const data=JSON.parse(await file.text());
   if(data.format!=='bingo18-lab-backup'||data.version!==1||!Array.isArray(data.draws)||!Array.isArray(data.receipts)||data.draws.length>100000||data.receipts.length>100000)throw Error('Sai định dạng sao lưu');
   if(data.draws.some(r=>!this.valid(r)))throw Error('Tệp chứa kết quả không hợp lệ; chưa nhập dữ liệu');
   const validReceipt=r=>r&&/^\d{7,10}$/.test(r.target_id)&&/^\d{7,10}$/.test(r.base_id)&&Number(r.target_id)===Number(r.base_id)+1&&Array.isArray(r.nums)&&r.nums.length===3&&r.nums.every(n=>Number.isInteger(n)&&n>=1&&n<=6)&&r.sum===r.nums.reduce((a,b)=>a+b,0)&&Number.isFinite(Date.parse(r.saved_at));
   if(data.receipts.some(r=>!validReceipt(r)))throw Error('Gợi ý trong tệp không hợp lệ; chưa nhập dữ liệu');
   const importedIssues=(Array.isArray(data.issues)?data.issues:[]).filter(i=>i&&/^\d{5,10}$/.test(String(i.draw_id))&&Array.isArray(i.old?.nums)&&Array.isArray(i.incoming?.nums)&&[i.old.nums,i.incoming.nums].every(a=>a.length===3&&a.every(n=>Number.isInteger(n)&&n>=1&&n<=6))).map(i=>({id:'import-conflict:'+String(Number(i.draw_id)).padStart(7,'0')+':'+i.incoming.nums.join(''),draw_id:String(Number(i.draw_id)).padStart(7,'0'),kind:'conflict',at:new Date().toISOString(),old:{nums:i.old.nums},incoming:{nums:i.incoming.nums}}));
   let added=0;const report=await this.merge(data.draws,true);
   await new Promise((resolve,reject)=>{const tx=this.db.transaction(['receipts','issues'],'readwrite'),s=tx.objectStore('receipts');for(const i of importedIssues)tx.objectStore('issues').put(i);for(const r of data.receipts){const q=s.get(r.target_id);q.onsuccess=()=>{if(!q.result){s.add({target_id:r.target_id,base_id:r.base_id,nums:[...r.nums],sum:r.sum,saved_at:r.saved_at,source_checked_at:r.source_checked_at||null,fingerprint:typeof r.fingerprint==='string'?r.fingerprint.slice(0,64):'',imported:true,timing_status:'unverified'});added++;}}}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Không khôi phục được gợi ý'));});
   current=await this.read();render();this.showError(`Đã bổ sung ${report.added} kỳ, ${added} gợi ý; bỏ ${report.duplicates} kỳ trùng; giữ nguyên ${report.conflicts} kỳ mâu thuẫn. Gợi ý từ sao lưu chỉ dùng tham khảo, chưa xác minh thời điểm.`);
  }catch(e){this.showError('Khôi phục chưa hoàn tất: '+e.message);}
 },
 render(){
  const el=document.getElementById('archiveSummary');if(!el)return;
  const n=current.length,gaps=this.gaps(current),feed=this.feed,sourceAt=feed?.fetched_at;
  const age=sourceAt?Math.max(0,(Date.now()-Date.parse(sourceAt))/60000):null;
  el.textContent=(this.storageError?'Lần lưu mới thất bại — giữ nguyên kho cũ':this.persistent?'Đang lưu lâu dài trên trình duyệt này':'Chưa có lưu lâu dài')+` · ${n} kỳ · ${this.receipts.length} gợi ý khóa. `+(n?`Phạm vi #${current[n-1].id} → #${current[0].id}.`:'Chưa có lịch sử.');
  document.getElementById('archiveRetention').textContent='Dữ liệu còn sau khi tải lại trang hoặc Render khởi động lại; không tự đồng bộ giữa thiết bị. '+(this.retentionGranted?'Trình duyệt đã cấp bảo vệ lưu trữ.':'Trình duyệt có thể thu hồi bộ nhớ khi thiếu dung lượng. ')+ 'Xóa dữ liệu trang web hoặc dùng chế độ riêng tư có thể mất kho; nên sao lưu định kỳ. Chỉ tích lũy các kỳ ứng dụng đã tải, không tự lấp kỳ thiếu khi đóng app.';
  document.getElementById('integritySummary').textContent=`${gaps.count} kỳ chưa có trong phạm vi lưu · ${this.issues.length} mâu thuẫn cần kiểm tra. `+(this.lastMerge?`Lần nhập gần nhất: +${this.lastMerge.added} mới; ${this.lastMerge.duplicates} trùng được bỏ; ${this.lastMerge.invalid} không hợp lệ.`:'');
  document.getElementById('missingRanges').textContent=gaps.count?'Các khoảng thiếu (tối đa 8): '+gaps.ranges.join(', ')+'. Không tạo kết quả giả để lấp.':'Không thấy khoảng trống giữa các mã kỳ đã lưu. Không chứng minh đã có toàn bộ lịch sử.';
  const checks=feed?.source_checks;
  document.getElementById('sourceQuality').textContent=(sourceAt?'Lần đọc nguồn thành công: '+new Date(sourceAt).toLocaleString('vi-VN')+(age>3?' — đã quá 3 phút, dữ liệu có thể cũ.':' — vừa kiểm tra nguồn.'):'Chưa có lần đọc nguồn thành công.')+(checks?` Nguồn: ${checks.cards||0} thẻ, ${checks.incomplete||0} chưa đủ số, ${checks.invalid||0} không hợp lệ, ${checks.duplicates||0} mã lặp.`:'')+(feed?.error?' Lỗi: '+feed.error:'')+(feed?.conflicts?.length?' Máy chủ phát hiện mâu thuẫn ở #'+feed.conflicts.join(', #'):'');
  document.getElementById('latestProgress').textContent=this.latestSeen?'Lần thiết bị này nhận kỳ mới: '+new Date(this.latestSeen.at).toLocaleString('vi-VN')+'. Nguồn đọc được nhưng không có kỳ mới không đồng nghĩa lỗi; có thể ngoài giờ quay.':'';
  document.getElementById('issueRows').innerHTML=this.issues.slice(-20).reverse().map(i=>`<tr><td>#${esc(i.draw_id)}</td><td>${esc(i.old.nums.join('–'))}</td><td>${esc(i.incoming.nums.join('–'))}</td><td>Giữ nguyên bản đã lưu</td></tr>`).join('')||'<tr><td colspan="4">Chưa phát hiện mâu thuẫn trong kho thiết bị.</td></tr>';
  document.getElementById('archiveRows').innerHTML=current.slice(0,Number(document.getElementById('archiveLimit').value)).map(r=>`<tr><td>#${esc(r.id)}</td><td>${esc(r.date)}</td><td>${r.nums.join(' – ')}</td><td>${r.sum}</td><td>${r.imported?'Sao lưu':'Nguồn đã tải'}</td></tr>`).join('')||'<tr><td colspan="5">Chưa có dữ liệu.</td></tr>';
  const evaluated=this.receipts.map(r=>({r,o:this.outcome(r,current)})),done=evaluated.filter(x=>x.o.state==='compared');
  document.getElementById('reviewSummary').textContent=`${this.receipts.length} gợi ý khóa · ${done.length} đã có kết quả · ${evaluated.filter(x=>x.o.state==='pending').length} đang chờ/thiếu · ${done.filter(x=>x.o.total).length} trùng tổng · ${done.filter(x=>x.o.combo).length} trùng đủ bộ số (không xét thứ tự). Các đối chiếu đều chưa xác minh giờ quay; không tính là thành tích dự báo đã kiểm chứng.`;
  document.getElementById('reviewRows').innerHTML=evaluated.slice(0,100).map(({r,o})=>`<tr><td>#${esc(r.target_id)}<small style="display:block">${esc(new Date(r.saved_at).toLocaleString('vi-VN'))}</small></td><td>${r.nums.join('–')}<small style="display:block">Tổng ${r.sum}</small></td><td>${o.actual?o.actual.nums.join('–')+' · '+o.actual.sum:'—'}</td><td>${esc(o.label)}<small style="display:block">${r.imported?'Từ sao lưu · ':''}Chưa xác minh giờ quay</small></td></tr>`).join('')||'<tr><td colspan="4">Chưa lưu gợi ý. Tạo gợi ý rồi nhấn Lưu và khóa.</td></tr>';
  const lock=document.getElementById('lockSuggestion'),target=feed?.pending_id,locked=this.receipts.find(r=>r.target_id===target),already=!!locked;
  lock.disabled=this.busy||!!this.storageError||!this.persistent||!this.candidate||!this.candidate.base_id||!feed||feed.status!=='ok'||!target||already;
  document.getElementById('randomize').disabled=this.busy;
  lock.textContent=this.busy?'Đang lưu…':already?'Đã khóa kỳ #'+target:'Lưu và khóa gợi ý';
  document.getElementById('lockHint').textContent=(locked?'Gợi ý đã khóa cho #'+target+': '+locked.nums.join(' – ')+' · Tổng '+locked.sum+'. Gợi ý ngẫu nhiên đang xem không thay đổi bản đã khóa. ':target?'Kỳ nguồn đang chờ: #'+target+'. Mỗi thiết bị chỉ khóa một gợi ý cho mỗi kỳ. ':'Chưa xác định kỳ đang chờ từ nguồn; tạm chưa thể khóa gợi ý. ')+'Chưa xác minh lưu trước giờ quay thực tế.'+(this.message?' '+this.message:'');
  document.getElementById('backupArchive').disabled=!this.persistent;
 }
};
