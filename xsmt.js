'use strict';
const XSMT = {
 rows: [], loaded: false, busy: false, feed: null,
 provinces: {xstth:'Thừa T. Huế',xspy:'Phú Yên',xsdlk:'Đắk Lắk',xsqnm:'Quảng Nam',xsdng:'Đà Nẵng',xskh:'Khánh Hòa',xsbdi:'Bình Định',xsqt:'Quảng Trị',xsqb:'Quảng Bình',xsgl:'Gia Lai',xsnt:'Ninh Thuận',xsqng:'Quảng Ngãi',xsdno:'Đắk Nông',xskt:'Kon Tum'},
 dateKey(d){const p=d.split('/');return p.length===3?p[2]+p[1]+p[0]:''},
 valid(r){return r&&Object.prototype.hasOwnProperty.call(this.provinces,r.province)&&/^\d{2}\/\d{2}\/\d{4}$/.test(r.date)&&/^\d{6}$/.test(r.special)&&r.tail===r.special.slice(-2)},
 init(){const province=document.getElementById('xsmtProvince');province.innerHTML=Object.entries(this.provinces).map(([id,name])=>`<option value="${id}">${name}</option>`).join('');province.value='xsdng';province.onchange=()=>this.render();document.getElementById('xsmtLimit').onchange=()=>this.render();document.getElementById('xsmtReload').onclick=()=>this.load();},
 async load(){if(this.busy)return;if(!navigator.onLine){document.getElementById('xsmtMessage').textContent='Đang ngoại tuyến; chưa thể đọc dữ liệu miền Trung từ máy chủ.';return}
  this.busy=true;const button=document.getElementById('xsmtReload');button.disabled=true;document.getElementById('xsmtMessage').textContent='Đang đọc các bảng kết quả theo thứ trong tuần…';
  try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),80000);let res;try{res=await fetch('/api/xsmt',{cache:'no-store',signal:controller.signal})}finally{clearTimeout(timer)}if(!res.ok)throw Error('HTTP '+res.status);
   const data=await res.json();this.feed=data;this.rows=Array.isArray(data.rows)?data.rows.filter(r=>this.valid(r)):[];this.loaded=true;this.render();
  }catch(e){document.getElementById('xsmtMessage').textContent='Chưa tải được kết quả miền Trung: '+e.message+'. Hãy thử lại khi có mạng.'}
  finally{this.busy=false;button.disabled=false}
 },
 render(){const feed=this.feed,province=document.getElementById('xsmtProvince').value,limit=document.getElementById('xsmtLimit').value;
  const all=this.rows.filter(r=>r.province===province).sort((a,b)=>this.dateKey(b.date).localeCompare(this.dateKey(a.date)));
  const rows=limit==='all'?all:all.slice(0,Number(limit)),n=rows.length;
  const counts=Array(100).fill(0),heads=Array(10).fill(0),tails=Array(10).fill(0);
  for(const row of rows){const value=Number(row.tail);counts[value]++;heads[Math.floor(value/10)]++;tails[value%10]++}
  const fmt=x=>(100*x).toFixed(1)+'%';
  const source=feed?.fetched_at?new Date(feed.fetched_at).toLocaleString('vi-VN'):'chưa rõ';
  const coverage=feed?`${feed.sources_ok?.length||0}/${feed.sources_expected||7} trang theo thứ đã đọc`:'chưa tải';
  document.getElementById('xsmtMessage').textContent=feed?`${feed.status==='ok'?'Đã đọc':'Dữ liệu chưa đầy đủ'} · ${coverage} · kiểm tra ${source}. ${feed.error?'Một số trang lỗi; kết quả cũ được giữ lại.':''}`:'Chọn đài để đọc kết quả.';
  document.getElementById('xsmtSample').textContent=n?`${this.provinces[province]}: ${n} kỳ thực có trong mẫu, từ ${rows[n-1].date} đến ${rows[0].date}. ${n<30?'Mẫu nhỏ; không thể kết luận số nào có khả năng cao hơn ở kỳ tới.':''}`:`Chưa có kết quả hợp lệ của ${this.provinces[province]}; không tính tần suất.`;
  document.getElementById('xsmtLatest').textContent=n?rows[0].special+' · '+rows[0].date:'—';
  document.getElementById('xsmtCount').textContent=n||'—';
  document.getElementById('xsmtTop').textContent=n?String(Math.max(...counts))+'/'+n:'—';
  const ranked=counts.map((count,i)=>({value:String(i).padStart(2,'0'),count})).filter(r=>r.count).sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value)).slice(0,10);
  document.getElementById('xsmtRanking').innerHTML=ranked.map(r=>`<tr><td><b>${r.value}</b></td><td>${r.count}/${n}</td><td>${fmt(r.count/n)}</td><td>1,00%</td></tr>`).join('')||'<tr><td colspan="4">Chưa đủ dữ liệu.</td></tr>';
  document.getElementById('xsmtDigits').innerHTML=n?Array.from({length:10},(_,i)=>`<tr><td>${i}</td><td>${heads[i]}/${n} (${fmt(heads[i]/n)})</td><td>${tails[i]}/${n} (${fmt(tails[i]/n)})</td><td>10,0%</td></tr>`).join(''):'<tr><td colspan="4">Chưa đủ dữ liệu.</td></tr>';
  document.getElementById('xsmtRecent').innerHTML=rows.slice(0,12).map(r=>`<tr><td>${r.date}</td><td>${r.special}</td><td><b>${r.tail}</b></td></tr>`).join('')||'<tr><td colspan="3">Chưa có kỳ hợp lệ.</td></tr>';
 }
};
