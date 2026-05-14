import requests

url = "https://nest-61a74-default-rtdb.asia-southeast1.firebasedatabase.app/locks/front_door/status.json"
r = requests.put(url, json="unlocked")
print("Response:", r.text)
