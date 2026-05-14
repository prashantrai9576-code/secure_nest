import firebase_admin
from firebase_admin import credentials, db
import os
import time

# Find credentials
files = [f for f in os.listdir('.') if f.endswith('.json') and 'firebase-adminsdk' in f]
cred = credentials.Certificate(files[0])
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://nest-61a74-default-rtdb.asia-southeast1.firebasedatabase.app'
})

print("SECURE NEST DEMONSTRATION MODE")
print("---------------------------------")

# 1. Simulate a Known Visitor
print("[STEP 1] Simulating Known Visitor: Harsh Raj...")
db.reference('alerts').push({
    "title": "Harsh Raj is at the gate. Open the door?",
    "type": "face_alert",
    "timestamp": time.time() * 1000
})
time.sleep(5)

# 2. Simulate a Tamper Alert
print("[STEP 2] Simulating Security Breach: Tamper Detected...")
db.reference('alerts').push({
    "title": "Security Breach: Tamper Detected!",
    "type": "vibration_alert",
    "timestamp": time.time() * 1000
})
time.sleep(5)

# 3. Simulate Door Opening (Status Update)
print("[STEP 3] Updating Gate Status: OPEN...")
db.reference('status/door').set('open')
time.sleep(3)

# 4. Simulate Door Closing
print("[STEP 4] Updating Gate Status: CLOSED...")
db.reference('status/door').set('closed')

print("DONE: DEMO DATA PUSHED. Check your dashboard!")
