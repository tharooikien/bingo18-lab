"""Read public Central Vietnam result tables for descriptive research.

Only the last two digits of a province's six-digit special prize are analyzed.
The publisher's statistics endpoints are deliberately not queried.
"""
import datetime
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

BASE = 'https://xosominhngoc.net.vn/kqxs-mien-trung'
WEEKDAYS = ('thu-hai', 'thu-ba', 'thu-tu', 'thu-nam', 'thu-sau', 'thu-bay', 'chu-nhat')
PROVINCES = {
    'xstth': 'Thừa T. Huế', 'xspy': 'Phú Yên', 'xsdlk': 'Đắk Lắk',
    'xsqnm': 'Quảng Nam', 'xsdng': 'Đà Nẵng', 'xskh': 'Khánh Hòa',
    'xsbdi': 'Bình Định', 'xsqt': 'Quảng Trị', 'xsqb': 'Quảng Bình',
    'xsgl': 'Gia Lai', 'xsnt': 'Ninh Thuận', 'xsqng': 'Quảng Ngãi',
    'xsdno': 'Đắk Nông', 'xskt': 'Kon Tum',
}
INTERVAL = 3600  # No more than seven source pages per hour and server instance.
_cache = {'rows': [], 'fetched_at': None, 'last_attempt': 0, 'error': None, 'sources_ok': []}
_lock = threading.Lock()
_refresh_lock = threading.Lock()


def parse_page(html):
    """Return complete date/province/special-prize observations; ignore partial draws."""
    soup = BeautifulSoup(html, 'html.parser')
    results = {}
    for table in soup.select('table.kqxs_content'):
        header = table.select_one('thead tr.xshead')
        province = table.select_one('tr.tendai')
        special = table.select_one('tr.giaidb')
        eighth = table.select_one('tr.giai_tam')
        if not all((header, province, special, eighth)):
            continue
        match = re.search(r'\b(\d{2}/\d{2}/\d{4})\b', header.get_text(' ', strip=True))
        if not match:
            continue
        date = match.group(1)
        try:
            day = datetime.datetime.strptime(date, '%d/%m/%Y').date()
            if day > datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date():
                continue
        except ValueError:
            continue
        names = [a.get('href', '').strip('/').lower() for a in province.select('th a[href]')]
        prizes = special.select('td')
        checks = eighth.select('td')
        if not names or len(names) != len(prizes) or len(checks) != len(names):
            continue
        for code, cell, check in zip(names, prizes, checks):
            if code not in PROVINCES:
                continue
            numbers = [n.get_text(strip=True) for n in cell.select('.kq')]
            eighth_numbers = [n.get_text(strip=True) for n in check.select('.kq')]
            if len(numbers) != 1 or not re.fullmatch(r'\d{6}', numbers[0]):
                continue
            if len(eighth_numbers) != 1 or not re.fullmatch(r'\d{2}', eighth_numbers[0]):
                continue
            key = (date, code)
            row = {'date': date, 'province': code, 'name': PROVINCES[code],
                   'special': numbers[0], 'tail': numbers[0][-2:]}
            if key in results and results[key]['special'] != row['special']:
                raise ValueError('Mâu thuẫn giải đặc biệt cùng ngày và đài')
            results[key] = row
    return sorted(results.values(), key=lambda r: (datetime.datetime.strptime(r['date'], '%d/%m/%Y'), r['province']), reverse=True)


def _fetch(weekday):
    url = BASE + '/' + weekday
    response = requests.get(url, timeout=14, headers={
        'User-Agent': 'Bingo18LAB/1.0 (descriptive result research; source cited in app)'})
    response.raise_for_status()
    rows = parse_page(response.text)
    if not rows:
        raise ValueError('Không đọc được giải đặc biệt đã hoàn thành')
    return url, rows


def payload():
    with _refresh_lock:
        now = time.time()
        with _lock:
            due = now - _cache['last_attempt'] >= INTERVAL
            if due:
                _cache['last_attempt'] = now
        if due:
            incoming, ok, errors = {}, [], []
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = {pool.submit(_fetch, day): day for day in WEEKDAYS}
                for future in as_completed(futures):
                    day = futures[future]
                    try:
                        url, rows = future.result()
                        for row in rows:
                            key = (row['date'], row['province'])
                            if key in incoming and incoming[key]['special'] != row['special']:
                                raise ValueError('Mâu thuẫn kết quả giữa các trang')
                            incoming[key] = row
                        ok.append(url)
                    except Exception as exc:
                        errors.append(day + ': ' + type(exc).__name__)
            with _lock:
                if incoming:
                    existing = {(r['date'], r['province']): r for r in _cache['rows']}
                    for key, row in incoming.items():
                        if key in existing and existing[key]['special'] != row['special']:
                            errors.append(key[0] + ' ' + key[1] + ': dữ liệu thay đổi')
                        else:
                            existing[key] = row
                    # Old observations can be retained only as a clearly identified accumulated sample.
                    _cache['rows'] = sorted(existing.values(), key=lambda r: (datetime.datetime.strptime(r['date'], '%d/%m/%Y'), r['province']), reverse=True)[:1500]
                    _cache['fetched_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                _cache['sources_ok'] = sorted(ok)
                _cache['error'] = '; '.join(errors) if errors else None
        with _lock:
            state = dict(_cache)
    return {'status': 'ok' if state['rows'] and not state['error'] else ('partial' if state['rows'] else 'unavailable'),
            'fetched_at': state['fetched_at'], 'source_url': BASE,
            'sources_ok': state['sources_ok'], 'sources_expected': len(WEEKDAYS),
            'error': state['error'], 'rows': state['rows'],
            'notice': 'Hai số cuối giải đặc biệt theo từng đài; tần suất mẫu không phải xác suất dự đoán.'}
