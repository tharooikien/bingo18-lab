#!/usr/bin/env python3
"""Bingo18 research proxy. Run: python server.py. Requires requests and beautifulsoup4.
No claim of affiliation with data publishers. Respect access permissions/rate limits.
"""
import json, re, time, threading, datetime, os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
SOURCES = [
 'https://xosominhngoc.net.vn/kqxs-bingo18',
 'https://xosominhngoc.net.vn/bingo18',
]
_CACHE = {'rows': [], 'fetched_at': None, 'source': None, 'error': 'Chưa kết nối nguồn', 'last_attempt': 0}
_LOCK = threading.Lock()
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

def fetch_live():
    errors=[]
    for url in SOURCES:
        try:
            resp=requests.get(url,headers={'User-Agent':'Bingo18Research/1.0 (educational statistics; contact site operator for access)'},timeout=TIMEOUT)
            resp.raise_for_status()
            rows=parse_results(resp.text)
            if not rows: raise ValueError('Không tìm được kỳ quay và 3 số hợp lệ trên trang; có thể website đã đổi cấu trúc hoặc tải nội dung bằng JavaScript')
            return rows,url,None
        except Exception as e: errors.append(type(e).__name__+': '+str(e)[:170])
    return None,None,' | '.join(errors)

def refresh(force=False):
    now=time.time()
    with _LOCK:
        if now-_CACHE['last_attempt']<INTERVAL: return dict(_CACHE)
        _CACHE['last_attempt']=now
    rows,url,error=fetch_live()
    with _LOCK:
        if rows is not None:
            existing={r['id']:r for r in _CACHE['rows']}
            conflicts=[]
            for r in rows:
                old=existing.get(r['id'])
                if old and old['nums']!=r['nums']: conflicts.append(r['id'])
                else: existing[r['id']]=r
            if conflicts: error='Mã kỳ có kết quả khác dữ liệu đã lưu: '+', '.join(conflicts[:6])+'. Không ghi đè các kỳ này.'
            _CACHE['rows']=sorted(existing.values(),key=lambda r:int(r['id']),reverse=True)[:2000]
            _CACHE['fetched_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
            _CACHE['source']=url
        _CACHE['error']=error
        return dict(_CACHE)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        path=urlparse(self.path).path
        if path=='/healthz':
            raw=b'{"ok":true}'
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
        elif path=='/api/results':
            state=refresh(); rows=state['rows'];payload={
                'status': 'ok' if state['error'] is None else ('stale' if rows else 'unavailable'),
                'fetched_at':state['fetched_at'],'source_url':state['source'],
                'last_attempt': datetime.datetime.fromtimestamp(state['last_attempt'],datetime.timezone.utc).isoformat(),
                'error':state['error'], 'count':len(rows),'rows':rows[:500],
                'notice':'Dữ liệu từ website bên thứ ba; độ trễ có thể cao hơn lịch quay. Không phải API chính thức của Vietlott.'}
            raw=json.dumps(payload,ensure_ascii=False).encode('utf-8')
            self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
        else: super().do_GET()

def main():
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=int(os.environ.get('PORT',8765)));p.add_argument('--host',default=os.environ.get('HOST','0.0.0.0'));args=p.parse_args()
    print(f'Open http://{args.host}:{args.port} in your browser')
    print('Requests to source are rate-limited to every 90 seconds per server instance.')
    ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
if __name__=='__main__':main()
