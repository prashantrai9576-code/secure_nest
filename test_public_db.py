import requests

db_url = "https://nest-61a74-default-rtdb.asia-southeast1.firebasedatabase.app/status.json"
response = requests.get(db_url)
print("Status Code:", response.status_code)
print("Response:", response.text)
