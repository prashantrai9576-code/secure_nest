import firebase_admin
from firebase_admin import credentials, db
import os

# Find credentials
files = [f for f in os.listdir('.') if f.endswith('.json') and 'firebase-adminsdk' in f]
cred = credentials.Certificate(files[0])
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://nest-61a74-default-rtdb.asia-southeast1.firebasedatabase.app'
})

print("--- SENDING DIRECT UNLOCK SIGNAL TO ASIA REGION ---")
db.reference('locks/front_door/status').set('unlocked')
print("DONE: SIGNAL SENT. If the gate didn't click, your ESP32 is not connected to WiFi or the Database.")

