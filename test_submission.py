import requests
import os

# Create a dummy image
img_path = "test_image.jpg"
with open(img_path, "wb") as f:
    f.write(b"fake image content")

url = "http://localhost:8000/submit_report"
files = {'file': open(img_path, 'rb')}
data = {'latitude': -4.325, 'longitude': 15.322}

try:
    response = requests.post(url, files=files, data=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200:
        resp_json = response.json()
        saved_path = resp_json.get("image_saved_at")
        print(f"Saved Path: {saved_path}")
        
        if os.path.exists(saved_path):
            print("SUCCESS: File exists at saved path.")
        else:
            print("FAILURE: File NOT found at saved path.")
            
        if ".." in saved_path:
             print("FAILURE: Path contains '..'")
        else:
             print("SUCCESS: Path is absolute/clean.")
    else:
        print("FAILURE: API Request failed")

except Exception as e:
    print(f"Error: {e}")

finally:
    if os.path.exists(img_path):
        os.remove(img_path)
