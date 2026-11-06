import unittest
from unittest.mock import patch

import xsmt


def table(date='05/11/2026', special='055600', other='881888', eighth='63'):
    return f'''<table class="kqxs_content"><thead><tr class="xshead"><td>
        Kết quả xổ số Miền Trung, Thứ năm, ngày {date}</td></tr></thead><tbody>
        <tr class="tendai"><td>Thứ năm</td><th><a href="/xsbdi">Bình Định</a></th>
        <th><a href="/xsqt">Quảng Trị</a></th></tr>
        <tr class="giai_tam"><th>G.Tám</th><td><span class="kq">{eighth}</span></td>
        <td><span class="kq">71</span></td></tr>
        <tr class="giaidb"><th>G.ĐB</th><td><span class="kq">{special}</span></td>
        <td><span class="kq">{other}</span></td></tr></tbody></table>'''


class CentralResultTests(unittest.TestCase):
    def test_complete_prizes_keep_leading_zeros_and_province(self):
        rows = xsmt.parse_page(table())
        self.assertEqual(len(rows), 2)
        bdi = next(r for r in rows if r['province'] == 'xsbdi')
        self.assertEqual((bdi['eighth'], bdi['special'], bdi['tail'], bdi['date']), ('63', '055600', '00', '05/11/2026'))
        self.assertEqual(xsmt.parse_page(table(eighth='03'))[1]['eighth'], '03')

    def test_pending_and_malformed_prizes_are_excluded(self):
        self.assertEqual([r['province'] for r in xsmt.parse_page(table(special='05560'))], ['xsqt'])
        self.assertEqual([r['province'] for r in xsmt.parse_page(table(eighth=''))], ['xsqt'])
        self.assertEqual(xsmt.parse_page(table(date='99/11/2026')), [])

    def test_conflicting_duplicate_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Mâu thuẫn'):
            xsmt.parse_page(table() + table(special='055601'))
        with self.assertRaisesRegex(ValueError, 'Mâu thuẫn'):
            xsmt.parse_page(table() + table(eighth='62'))

    def test_cached_partial_source_is_not_reported_as_complete(self):
        with patch.object(xsmt, '_fetch', side_effect=lambda day: (xsmt.BASE+'/'+day, xsmt.parse_page(table())) if day == 'thu-nam' else (_ for _ in ()).throw(ValueError('offline'))):
            with patch.dict(xsmt._cache, {'rows': [], 'last_attempt': 0, 'sources_ok': [], 'error': None, 'fetched_at': None}):
                payload = xsmt.payload()
        self.assertEqual(payload['status'], 'partial')
        self.assertEqual(payload['sources_expected'], 7)
        self.assertEqual(len(payload['sources_ok']), 1)
        self.assertEqual(len(payload['rows']), 2)
        self.assertTrue(all('eighth' in row for row in payload['rows']))


if __name__ == '__main__':
    unittest.main()
