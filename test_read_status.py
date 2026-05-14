import requests

url = "https://nest-61a74-default-rtdb.asia-southeast1.firebasedatabase.app/locks/front_door/status.json"
r = requests.get(url)
print("Type of data:", type(r.json()))
print("Data:", r.json())
