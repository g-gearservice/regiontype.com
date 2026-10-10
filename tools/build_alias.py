"""영어권 코스의 약칭을 바로잡는다. build_world.py 다음에 돌린다.

Natural Earth postal 은 틀린 곳이 많다(호주 QL·NS, 필리핀 MM 스무 곳). 여기 적은
코스는 이 표로 약칭을 통째로 갈아 끼운다. 악센트·하이픈·아포스트로피를 뺀 철자는
판정 엔진(app.js foldKey)이 맡으므로 적지 않는다. 지어낸 별명은 넣지 않는다.

    python3 tools/build_alias.py
"""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data'

ALIASES = {
    'us-admin': {
        'Hawaii': ['HI'], 'California': ['CA'], 'Oregon': ['OR'], 'Washington': ['WA'], 'Idaho': ['ID'],
        'Wyoming': ['WY'], 'Colorado': ['CO'], 'New Mexico': ['NM'], 'Arizona': ['AZ'], 'Nevada': ['NV'],
        'Kansas': ['KS'], 'Oklahoma': ['OK'], 'Mississippi': ['MS'], 'Georgia': ['GA'], 'Indiana': ['IN'],
        'Arkansas': ['AR'], 'Iowa': ['IA'], 'Michigan': ['MI'], 'Minnesota': ['MN'], 'Wisconsin': ['WI'],
        'North Dakota': ['ND'], 'Nebraska': ['NE'], 'Montana': ['MT'], 'South Dakota': ['SD'],
        'Illinois': ['IL'], 'District of Columbia': ['DC'], 'New Jersey': ['NJ'], 'West Virginia': ['WV'],
        'South Carolina': ['SC'], 'Alabama': ['AL'], 'Florida': ['FL'], 'Texas': ['TX'], 'Missouri': ['MO'],
        'Utah': ['UT'], 'Louisiana': ['LA'], 'Kentucky': ['KY'], 'Tennessee': ['TN'],
        'North Carolina': ['NC'], 'Maryland': ['MD'], 'Virginia': ['VA'], 'Pennsylvania': ['PA'],
        'Ohio': ['OH'], 'Vermont': ['VT'], 'New York': ['NY'], 'Massachusetts': ['MA'],
        'New Hampshire': ['NH'], 'Maine': ['ME'], 'Connecticut': ['CT'], 'Delaware': ['DE'],
        'Rhode Island': ['RI'], 'Alaska': ['AK'],
    },
    'ca-admin': {
        'Yukon': ['YT'], 'Northwest Territories': ['NT'], 'Alberta': ['AB'], 'Saskatchewan': ['SK'],
        'Manitoba': ['MB'], 'Ontario': ['ON'], 'Québec': ['QC'],
        'Newfoundland and Labrador': ['NL', 'Newfoundland'], 'Prince Edward Island': ['PE', 'PEI'],
        'New Brunswick': ['NB'], 'Nova Scotia': ['NS'], 'Nunavut': ['NU'], 'British Columbia': ['BC'],
    },
    'au-admin': {
        'Western Australia': ['WA'], 'Northern Territory': ['NT'], 'Queensland': ['QLD'],
        'New South Wales': ['NSW'], 'Jervis Bay Territory': ['JBT', 'Jervis Bay'],
        'Australian Capital Territory': ['ACT'], 'Victoria': ['VIC'], 'Tasmania': ['TAS'],
        'Lord Howe Island': ['Lord Howe'], 'South Australia': ['SA'], 'Macquarie Island': ['Macquarie'],
    },
    # ISO 세 글자(WGN·OTA 따위)는 공식이지만 아무도 안 친다 — BOP·HB 만 둔다
    'nz-admin': {
        'Chatham Islands Territory': ['Chatham Islands', 'Chatham'], 'Kermadec Islands': ['Kermadec'],
        'Bay of Plenty': ['BOP'], 'Manawatu-Wanganui': ['Manawatu'], 'Tasman District': ['Tasman'],
        'Marlborough District': ['Marlborough'], 'Three Kings Islands': ['Three Kings'],
        'Gisborne District': ['Gisborne'], "Hawke's Bay": ['HB'], 'The Snares': ['Snares'],
        'Campbell Islands': ['Campbell Island'], 'Antipodes Islands': ['Antipodes'],
        'Nelson City': ['Nelson'],
    },
    'ie-admin': {
        'Kerry': ['KY'], 'Cork': ['CK'], 'Limerick': ['LK'], 'Clare': ['CE'], 'Galway': ['GY'],
        'Roscommon': ['RN'], 'Longford': ['LD'], 'Westmeath': ['WH'], 'Offaly': ['OY'],
        'Laoighis': ['Laois', 'LS'], 'Carlow': ['CW'], 'Kilkenny': ['KK'], 'Waterford': ['WD'],
        'Wexford': ['WX'], 'Wicklow': ['WW'], 'Dún Laoghaire–Rathdown': ['Dún Laoghaire'],
        'Meath': ['MH'], 'Louth': ['LH'], 'Monaghan': ['MN'], 'Cavan': ['CN'], 'Leitrim': ['LM'],
        'Sligo': ['SO'], 'Mayo': ['MO'], 'Kildare': ['KE'], 'Donegal': ['DL'],
    },
    'in-admin': {
        'Gujarat': ['GJ'], 'Dadra and Nagar Haveli and Daman and Diu': ['DH'], 'Maharashtra': ['MH'],
        'Telangana': ['TG', 'TS'], 'Andhra Pradesh': ['AP'], 'Puducherry': ['PY'], 'Tamil Nadu': ['TN'],
        'Kerala': ['KL'], 'Lakshadweep': ['LD'], 'Goa': ['GA'], 'Karnataka': ['KA'],
        'Chhattisgarh': ['CG'], 'Odisha': ['OD', 'OR'], 'Jharkhand': ['JH'], 'Bihar': ['BR'],
        'West Bengal': ['WB'], 'Tripura': ['TR'], 'Mizoram': ['MZ'], 'Manipur': ['MN'],
        'Nagaland': ['NL'], 'Assam': ['AS'], 'Meghalaya': ['ML'], 'Sikkim': ['SK'],
        'Arunachal Pradesh': ['AR'], 'Uttar Pradesh': ['UP'], 'Uttarakhand': ['UK', 'UA'],
        'Chandigarh': ['CH'], 'Himachal Pradesh': ['HP'], 'Ladakh': ['LA'], 'Jammu and Kashmir': ['JK'],
        'Punjab': ['PB'], 'Haryana': ['HR'], 'Delhi': ['DL'], 'Rajasthan': ['RJ'],
        'Madhya Pradesh': ['MP'], 'Andaman and Nicobar': ['AN'],
    },
    # 필리핀에는 두 글자 주 약칭 관례가 없다. 실제로 쓰는 것만
    'ph-admin': {
        'Camarines Sur': ['CamSur'], 'Quezon City': ['QC'], 'Mandaluyong City': ['Mandaluyong'],
        'Mindoro Oriental': ['Oriental Mindoro'], 'Mindoro Occidental': ['Occidental Mindoro'],
        'Samar': ['Western Samar'], 'Cagayan de Oro': ['CDO'], 'Zamboanga': ['Zamboanga City'],
        'General Santos': ['GenSan'], 'Davao': ['Davao City'], 'Compostela Valley': ['Davao de Oro'],
    },
    'za-admin': {
        'Western Cape': ['WC'], 'Northern Cape': ['NC'], 'Free State': ['FS'], 'Gauteng': ['GP', 'GT'],
        'Mpumalanga': ['MP'], 'Limpopo': ['LP'], 'North West': ['NW'], 'KwaZulu-Natal': ['KZN'],
        'Eastern Cape': ['EC'],
    },
    'gb-admin': {
        'Northern Ireland': ['NI', 'NIR'], 'Scotland': ['SCT'], 'Wales': ['WLS'], 'England': ['ENG'],
    },
}


def apply(course, table):
    names = {it['name'] for it in course['items']}
    unknown = set(table) - names
    assert not unknown, f"{course['slug']}: 코스에 없는 이름 {unknown}"
    seen = {}
    for it in course['items']:
        for a in table.get(it['name'], []):
            assert a not in names, f'{a}: 다른 곳의 이름과 같다'
            seen[a] = seen.get(a, 0) + 1
    dup = [a for a, n in seen.items() if n > 1]
    assert not dup, f"{course['slug']}: 겹치는 약칭 {dup}"
    for it in course['items']:
        a = table.get(it['name'])
        if a:
            it['aliases'] = a
        else:
            it.pop('aliases', None)


if __name__ == '__main__':
    for slug, table in ALIASES.items():
        path = DATA / f'{slug}.course.json'
        course = json.loads(path.read_text())
        apply(course, table)
        path.write_text(json.dumps(course, ensure_ascii=False, separators=(',', ':')))
        print(slug, sum(1 for it in course['items'] if it.get('aliases')), '/', len(course['items']))
