import firebase_admin
from firebase_admin import credentials, auth
import os

# Initialize app
cred = credentials.Certificate(r"C:\Users\QING\Desktop\Qing\sentinel-mesh\sentinel-mesh-firebase-adminsdk-fbsvc-6f485fbfa4.json")
firebase_admin.initialize_app(cred)

users = [
    {"email": "admin@ncdc.gov.ng", "password": "password123", "role": "super_admin"},
    {"email": "chew@ncdc.gov.ng", "password": "password123", "role": "chew"},
    {"email": "community@ncdc.gov.ng", "password": "password123", "role": "community"}
]

for u in users:
    try:
        user = auth.create_user(
            email=u["email"],
            password=u["password"],
            email_verified=True
        )
        print(f"Created user {u['email']} with ID {user.uid}")
        auth.set_custom_user_claims(user.uid, {"role": u["role"]})
    except Exception as e:
        if "EMAIL_EXISTS" in str(e):
            print(f"User {u['email']} already exists. Updating claims...")
            user = auth.get_user_by_email(u["email"])
            auth.update_user(user.uid, password=u["password"])
            auth.set_custom_user_claims(user.uid, {"role": u["role"]})
        else:
            print(f"Error creating {u['email']}: {e}")

print("Done setting up default users.")
