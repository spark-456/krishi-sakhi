import os
import requests
import json
import glob

# Dify Knowledge API Configuration
API_URL = "http://localhost/v1"
DATASET_ID = "ca08cbab-3fa7-485e-b893-8a5d760a89a0"
API_KEY = "dataset-UZjS8sG1mO4faXg0CrkOX4u4"

def upload_document(file_path):
    print(f"Uploading {file_path} to Dify Dataset...")
    url = f"{API_URL}/datasets/{DATASET_ID}/document/create_by_file"
    
    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }
    
    # Dify expects the process rule as a JSON string in the 'data' form field
    data = {
        "data": json.dumps({
            "indexing_technique": "high_quality",
            "process_rule": {
                "mode": "automatic"
            }
        })
    }
    
    with open(file_path, 'rb') as f:
        files = {
            'file': (os.path.basename(file_path), f, 'text/markdown')
        }
        
        try:
            response = requests.post(url, headers=headers, data=data, files=files)
            response.raise_for_status()
            print(f"✅ Successfully uploaded: {os.path.basename(file_path)}")
            print(f"   Response: {response.json().get('document', {}).get('id')}")
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to upload {os.path.basename(file_path)}")
            print(f"   Error: {e}")
            if e.response is not None:
                print(f"   Details: {e.response.text}")

if __name__ == "__main__":
    # Find all markdown files in the kb/ directory
    kb_files = glob.glob("kb/*.md")
    
    if not kb_files:
        print("No markdown files found in kb/ directory.")
    else:
        print(f"Found {len(kb_files)} files. Starting upload to Dify...")
        for file in kb_files:
            upload_document(file)
        
        print("\n🎉 Upload complete! Dify will now chunk these documents and store the embeddings in Qdrant (if your Dify instance is configured with VECTOR_STORE=qdrant).")
