import json
p = json.load(open('data/problems/1004.json', encoding='utf-8'))
p['examples'][0]['output'] = '8'
p['examples'][0]['explanation'] = '整串 8 个元素仅 1 个 0,翻 → 8。'
json.dump(p, open('data/problems/1004.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('1004 fixed')
