import requests

url = "https://nest-61a74-default-rtdb.asia-southeast1.firebasedatabase.app/status.json"
headers = {'Accept': 'text/event-stream'}
r = requests.get(url, headers=headers, stream=True)
print(r.status_code)
for line in r.iter_lines():
    if line:
        print(line.decode('utf-8'))
        break
