#!/usr/bin/env python3
"""Bingo18 research proxy. Run: python server.py. Requires requests and beautifulsoup4.
No claim of affiliation with data publishers. Respect access permissions/rate limits.
"""
import json, re, time, threading, datetime, os, hashlib, secrets
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
import xsmt

ROOT = Path(__file__).resolve().parent
SOURCES = [
 'https://xosominhngoc.net.vn/bingo18',
 'https://xosominhngoc.net.vn/kqxs-bingo18',
]
_CACHE = {'rows': [], 'fetched_at': None, 'source': None, 'error': 'Chưa kết nối nguồn', 'last_attempt': 0, 'pending_id': None, 'latest_changed_at': None, 'source_checks': {}, 'conflicts': []}
_LOCK = threading.Lock()
_REFRESH_LOCK = threading.Lock()
_RECEIPTS = {}
TIMEOUT = 16
INTERVAL = 90

def parse_results(html):
    soup = BeautifulSoup(html, 'html.parser')
    rows = []
    # Read each result card before removing its header (draw ID and date live there).
    for card in soup.select('article.vkt-bingo18'):
        label = card.select_one('.vk-kyve')
        match = re.search(r'#\s*(\d{5,10})', label.get_text(' ', strip=True)) if label else None
        balls = [n.get_text(strip=True) for n in card.select('.vk-bong li')]
        if not balls:
            balls = [n.get_text(strip=True) for n in card.select('.vk-chuoi .kq')]
        if not match or len(balls) != 3 or any(not re.fullmatch('[1-6]', n) for n in balls):
            continue
        date_match = re.search(r'\d{2}/\d{2}/\d{4}', card.get_text(' ', strip=True))
        nums = [int(n) for n in balls]
        total_match = re.search(r'Tổng\s*3\s*số\s*:\s*(\d+)', card.get_text(' ', strip=True), re.I)
        if total_match and int(total_match.group(1)) != sum(nums):
            raise ValueError('Tổng trên trang nguồn không khớp ba số')
        rows.append((match.group(1), date_match.group(0) if date_match else '', nums))
    for node in soup(['script', 'style', 'nav', 'footer']): node.decompose()
    text = soup.get_text(' ', strip=True)
    text = re.sub(r'\s+', ' ', text)
    # The older Minh Ngoc HTML presents each draw as 'Ky QSMT #.... - Ngay ... 6 3 6'.
    pat1 = re.compile(r'Kỳ\s*QSMT\s*:\s*#?\s*(\d{5,10})\s*-\s*Ngày\s*:\s*(\d{2}/\d{2}/\d{4})\s+([1-6])\s+([1-6])\s+([1-6])(?=\s|$)', re.I)
    for m in pat1.finditer(text):
        rows.append((m.group(1),m.group(2),[int(m.group(i)) for i in (3,4,5)]))
    # Newer HTML presents 'Ky ve #... 3 so trung thuong 5 6 2'.
    pat2 = re.compile(r'Kỳ\s*vé\s*#\s*(\d{5,10})\s+3\s*số\s*trúng\s*thưởng\s+([1-6])\s+([1-6])\s+([1-6])(?=\s|$)', re.I)
    for m in pat2.finditer(text):
        prefix = text[max(0,m.start()-180):m.start()]
        dates = re.findall(r'(\d{2}/\d{2}/\d{4})',prefix)
        rows.append((m.group(1),dates[-1] if dates else '',[int(m.group(i)) for i in (2,3,4)]))
    dedup={}
    for id_,date,nums in rows:
        try:
            if date: datetime.datetime.strptime(date,'%d/%m/%Y')
        except ValueError: date=''
        if id_ in dedup:
            if dedup[id_]['nums']!=nums: raise ValueError('Mâu thuẫn kết quả trong cùng trang, từ chối đồng bộ')
            if not dedup[id_]['date'] and date: dedup[id_]['date']=date
            continue
        dedup[id_]={'id':id_.zfill(7),'date':date,'nums':nums,'sum':sum(nums),'source':'Xổ Số Minh Ngọc'}
    return sorted(dedup.values(),key=lambda r:int(r['id']),reverse=True)

def source_checks(html):
    soup = BeautifulSoup(html, 'html.parser')
    counts = {'cards': 0, 'incomplete': 0, 'invalid': 0, 'duplicates': 0}
    seen = set(); pending = []
    for card in soup.select('article.vkt-bingo18'):
        label = card.select_one('.vk-kyve')
        m = re.search(r'#\s*(\d{5,10})', label.get_text(' ', strip=True)) if label else None
        if not m: continue
        counts['cards'] += 1
        id_ = m.group(1).zfill(7)
        if id_ in seen: counts['duplicates'] += 1
        seen.add(id_)
        balls = card.select('.vk-bong li') or card.select('.vk-chuoi .kq')
        values = [b.get_text(strip=True) for b in balls]
        if len(values) != 3 or any(not v for v in values):
            counts['incomplete'] += 1
            if 'vk-tt' in card.get('class', []): pending.append(id_)
        elif any(not re.fullmatch('[1-6]', v) for v in values): counts['invalid'] += 1
    counts['pending_id'] = max(pending, key=int) if pending else None
    return counts

def fetch_live():
    errors=[]
    for url in SOURCES:
        try:
            resp=requests.get(url,headers={'User-Agent':'Bingo18Research/1.0 (educational statistics; contact site operator for access)'},timeout=TIMEOUT)
            resp.raise_for_status()
            rows=parse_results(resp.text)
            if not rows: raise ValueError('Không tìm được kỳ quay và 3 số hợp lệ trên trang; có thể website đã đổi cấu trúc hoặc tải nội dung bằng JavaScript')
            return rows,url,None,source_checks(resp.text)
        except Exception as e: errors.append(type(e).__name__+': '+str(e)[:170])
    return None,None,' | '.join(errors),{}

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def refresh(force=False):
    # One source request at a time; even forced checks respect publisher rate limits.
    with _REFRESH_LOCK:
        now=time.time()
        with _LOCK:
            if now-_CACHE['last_attempt']<INTERVAL: return dict(_CACHE)
            _CACHE['last_attempt']=now
        rows,url,error,checks=fetch_live()
        with _LOCK:
            if rows is not None:
                existing={r['id']:r for r in _CACHE['rows']}
                previous=max(existing, key=int) if existing else None
                conflicts=[]
                for r in rows:
                    old=existing.get(r['id'])
                    if old and (old['nums']!=r['nums'] or (old['date'] and r['date'] and old['date']!=r['date'])):
                        conflicts.append(r['id'])
                    else: existing[r['id']]=r
                if conflicts: error='Kết quả mâu thuẫn, giữ nguyên bản đã lưu: '+', '.join(conflicts[:6])
                _CACHE['conflicts']=sorted(set(_CACHE['conflicts']+conflicts))
                _CACHE['rows']=sorted(existing.values(),key=lambda r:int(r['id']),reverse=True)
                stamp=utcnow()
                if _CACHE['rows'] and _CACHE['rows'][0]['id']!=previous: _CACHE['latest_changed_at']=stamp
                _CACHE['fetched_at']=stamp
                _CACHE['source']=url
                _CACHE['source_checks']=checks
                _CACHE['pending_id']=checks.get('pending_id')
            _CACHE['error']=error
            return dict(_CACHE)

def results_payload():
    state=refresh(); rows=state['rows']
    return {
        'status':'ok' if state['error'] is None else ('stale' if rows else 'unavailable'),
        'server_at':utcnow(), 'fetched_at':state['fetched_at'], 'source_url':state['source'],
        'last_attempt':datetime.datetime.fromtimestamp(state['last_attempt'],datetime.timezone.utc).isoformat(),
        'latest_changed_at':state['latest_changed_at'], 'pending_id':state['pending_id'],
        'source_checks':state['source_checks'], 'conflicts':state['conflicts'],
        'error':state['error'], 'count':len(rows),'rows':rows[:500],
        'notice':'Lịch sử lâu dài lưu trên trình duyệt của từng thiết bị. Nguồn chưa cung cấp giờ quay đã xác minh.'}

def make_receipt(body):
    nums=body.get('nums'); client=body.get('client_id','')
    if not isinstance(client,str) or not re.fullmatch(r'[a-f0-9]{32}',client): raise ValueError('Thiếu mã thiết bị hợp lệ')
    if not isinstance(nums,list) or len(nums)!=3 or any(type(n) is not int or n<1 or n>6 for n in nums): raise ValueError('Ba số phải là số nguyên 1–6')
    state=refresh()
    with _LOCK:
        if state['error'] or not state['rows'] or not state['fetched_at']: raise ValueError('Nguồn lỗi; chưa thể khóa gợi ý')
        if (datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(state['fetched_at'])).total_seconds()>180: raise ValueError('Nguồn chưa được kiểm tra gần đây')
        base=state['rows'][0]['id']; target=state['pending_id']
        if body.get('base_id')!=base: raise ValueError('Mốc kỳ đã thay đổi; cập nhật rồi tạo lại gợi ý')
        if not target or int(target)!=int(base)+1: raise ValueError('Nguồn chưa công bố kỳ đang chờ kế tiếp; chưa khóa gợi ý')
        if target in {r['id'] for r in state['rows']}: raise ValueError('Kỳ này đã có kết quả')
        key=client+':'+target
        if key in _RECEIPTS: return dict(_RECEIPTS[key])
        receipt={'target_id':target,'base_id':base,'nums':nums,'sum':sum(nums),'saved_at':utcnow(),
            'source_checked_at':state['fetched_at'],'source_url':state['source'],
            'timing_status':'unverified','nonce':secrets.token_hex(12)}
        receipt['fingerprint']=hashlib.sha256(json.dumps(receipt,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        _RECEIPTS[key]=receipt
        return dict(receipt)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        path=urlparse(self.path).path
        if path=='/healthz':
            raw=b'{"ok":true}'
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
        elif path=='/api/results':
            self.send_json(results_payload())
        elif path=='/api/xsmt':
            self.send_json(xsmt.payload())
        else: super().do_GET()
    def send_json(self,payload,status=200):
        raw=json.dumps(payload,ensure_ascii=False).encode('utf-8')
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_POST(self):
        if urlparse(self.path).path!='/api/checkpoint': return self.send_json({'error':'Không tìm thấy'},404)
        # Only this app may submit suggestions. No cross-origin write access.
        origin=self.headers.get('Origin','')
        if not origin or urlparse(origin).netloc != self.headers.get('Host'): return self.send_json({'error':'Nguồn yêu cầu không hợp lệ'},403)
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=4096: raise ValueError('Nội dung quá lớn hoặc trống')
            body=json.loads(self.rfile.read(length))
            if not isinstance(body,dict): raise ValueError('Dữ liệu không hợp lệ')
            self.send_json(make_receipt(body))
        except (ValueError,TypeError) as e: self.send_json({'error':str(e)},409)
        except Exception: self.send_json({'error':'Không thể lưu mốc lúc này; vui lòng thử lại'},503)


def main():
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=int(os.environ.get('PORT',8765)));p.add_argument('--host',default=os.environ.get('HOST','0.0.0.0'));args=p.parse_args()
    print(f'Open http://{args.host}:{args.port} in your browser')
    print('Requests to source are rate-limited to every 90 seconds per server instance.')
    ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
if __name__=='__main__':main()
