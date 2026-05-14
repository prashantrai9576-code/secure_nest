import firebase_admin
from firebase_admin import credentials, db, auth
import os

# --- INITIALIZE FIREBASE ---
# Finding your service account file automatically
files = [f for f in os.listdir('.') if f.endswith('.json') and 'firebase-adminsdk' in f]
if not files:
    print("❌ Error: Firebase Service Account JSON not found in current directory.")
    exit()

cred = credentials.Certificate(files[0])
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://nest-61a74-default-rtdb.asia-southeast1.firebasedatabase.app' 
})


def wipe_it_all():
    print("--- Starting Total System Wipe ---")
    
    # 1. Clear Database Nodes
    try:
        db.reference('users').delete()
        print("OK: Users Node: WIPED")
        
        db.reference('access_logs').delete()
        print("OK: Access Logs: WIPED")
        
        db.reference('alerts').delete()
        print("OK: Alerts: WIPED")
        
        db.reference('locks/front_door').set({
            "status": "locked",
            "updated_by": "System Wipe"
        })
        print("OK: Lock State: RESET TO LOCKED")
        
    except Exception as e:
        print(f"ERROR: Database Wipe Failed: {e}")

    # 2. Clear Auth Users (Optional but recommended)
    print("\nNote: You should also manually delete users from the Firebase Console 'Authentication' tab to be 100% clean.")
    
    print("\nSYSTEM IS NOW CLEAN. Please restart your Master script and Sign Up as the first user.")


if __name__ == "__main__":
    wipe_it_all()
