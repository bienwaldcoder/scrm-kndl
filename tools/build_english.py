"""Generate en.html from the German source and reviewed English translations.
Run: python -m pip install -r tools/requirements.txt && python tools/build_english.py
"""
import json
import re
from pathlib import Path
from urllib.parse import urlencode
from bs4 import BeautifulSoup, Comment, Doctype

ROOT = Path(__file__).resolve().parents[1]
def load(name):
    return json.loads((ROOT / 'translations' / name).read_text())

def build():
    german = load('de-static.json')
    english = load('en-static.json')
    translations = {german[int(i)]: value for i, value in english.items()}
    soup = BeautifulSoup((ROOT / 'index.html').read_text(), 'html.parser')
    soup.html['lang'] = 'en'
    for node in list(soup.find_all(string=True)):
        if node.parent.name in ('script', 'style') or isinstance(node, (Comment, Doctype)):
            continue
        value = str(node)
        if value.strip() in translations:
            node.replace_with(value.replace(value.strip(), translations[value.strip()]))
    for el in soup.find_all(True):
        for attribute in ('alt', 'aria-label', 'title', 'placeholder', 'content'):
            if el.get(attribute) in translations:
                el[attribute] = translations[el[attribute]]
    soup.select_one('.language-switch')['aria-label'] = 'Choose language'
    for link in soup.select('[data-language]'):
        link.attrs.pop('aria-current', None)
        if link['data-language'] == 'en':
            link['aria-current'] = 'page'
    for link in soup.select('a[href^="mailto:"]'):
        if '?subject=' in link['href']:
            link['href'] = 'mailto:bienwaldcoder@gmail.com?' + urlencode({
                'subject': 'Request: application documents (Smart-CRM internship)',
                'body': 'Hi Ronnie,\n\nPlease send me your full application documents.\n\nThank you and best wishes',
            })
    replacements = []
    for line in (ROOT / 'translations/en-script.tsv').read_text().splitlines():
        if line:
            source, target = line.split('\t', 1)
            replacements.append((source, target))
    chat = load('en-chat.json')
    for script in soup.find_all('script', src=False):
        code = script.string or ''
        if 'const CHAT_QA' in code:
            questions = iter(chat['questions'])
            answers = iter(chat['answers'])
            code = re.sub(r"q: '[^'\n]*',", lambda m: 'q: ' + json.dumps(next(questions), ensure_ascii=False) + ',', code)
            code = re.sub(r'a: `[^`]*`,', lambda m: 'a: ' + json.dumps(next(answers), ensure_ascii=False) + ',', code)
            for key in ('greeting', 'closing'):
                code = re.sub(r'const CHAT_' + key.upper() + r' = `[^`]*`;',
                    lambda m: 'const CHAT_' + key.upper() + ' = ' + json.dumps(chat[key], ensure_ascii=False) + ';', code)
            # Longest first, single pass: never translate translated output again.
            mapping = dict(replacements)
            pattern = '|'.join(re.escape(k) for k in sorted(mapping, key=len, reverse=True))
            code = re.sub(pattern, lambda m: mapping[m[0]], code)
            script.string = code
    (ROOT / 'en.html').write_text(str(soup).rstrip() + '\n')
    print('Generated en.html')

if __name__ == '__main__':
    build()
