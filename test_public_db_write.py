import requests

db_url = "https://nest-61a74-default-rtdb.asia-southeast1.firebasedatabase.app/test_write.json"
response = requests.put(db_url, json={"test": "hello"})
print("Status Code:", response.status_code)
print("Response:", response.text)
