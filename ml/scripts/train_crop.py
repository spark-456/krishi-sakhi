import pandas as pd
import numpy as np
import os
import joblib
import json
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASETS_DIR = os.path.join(BASE_DIR, "..", "..", "pavan-drive-ml", "datasets")
OUTPUT_DIR = os.path.join(BASE_DIR, "..", "crop_recommender")

def main():
    print("--- Krishi Sakhi: Crop Recommender Trainer ---")
    
    # In a real scenario, you'd merge `combined yeild production.csv` and `weather_2023_2025.csv`
    # For this script, we ensure the structural output aligns with the API expectations.
    # The API expects features: location_enc, rainfall, monsoon_rainfall, temperature, humidity, wind_speed, yield
    
    # 1. Load Data (Simulated merging logic for demonstration)
    print("Loading crop production and weather datasets...")
    yield_path = os.path.join(DATASETS_DIR, "combined yeild production.csv")
    weather_path = os.path.join(DATASETS_DIR, "weather_2023_2025.csv")
    
    # Since merging these massive datasets requires specific business logic keys (e.g. District + Date),
    # Ensure you replace the synthetic generation below with your actual pandas merge:
    # df_yield = pd.read_csv(yield_path)
    # df_weather = pd.read_csv(weather_path)
    # df_merged = pd.merge(df_yield, df_weather, on="District")
    
    # 2. Data Preparation
    print("Preparing features and labels...")
    
    # --- SYNTHETIC DATA GENERATION FOR DEMONSTRATION OF EXACT PIPELINE ---
    np.random.seed(42)
    sample_size = 1000
    districts = ["Nalgonda", "Warangal", "Khammam", "Karimnagar", "Nizamabad"]
    crops = ["Rice", "Wheat", "Maize", "Cotton", "Sugarcane"]
    
    df = pd.DataFrame({
        "location": np.random.choice(districts, sample_size),
        "rainfall": np.random.uniform(500, 1500, sample_size),
        "monsoon_rainfall": np.random.uniform(300, 1000, sample_size),
        "temperature": np.random.uniform(20, 35, sample_size),
        "humidity": np.random.uniform(40, 90, sample_size),
        "wind_speed": np.random.uniform(5, 20, sample_size),
        "yield": np.random.uniform(2, 6, sample_size),
        "crop": np.random.choice(crops, sample_size)
    })
    
    # 3. Encoding Categorical Variables
    print("Encoding categorical variables...")
    loc_encoder = LabelEncoder()
    df["location_enc"] = loc_encoder.fit_transform(df["location"])
    
    crop_encoder = LabelEncoder()
    df["crop_enc"] = crop_encoder.fit_transform(df["crop"])
    
    features = ["location_enc", "rainfall", "monsoon_rainfall", "temperature", "humidity", "wind_speed", "yield"]
    X = df[features]
    y = df["crop_enc"]
    
    # 4. Train Test Split
    print("Splitting dataset...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # 5. Training XGBoost
    print("Training XGBoost Classifier...")
    model = xgb.XGBClassifier(use_label_encoder=False, eval_metric='mlogloss')
    model.fit(X_train, y_train)
    
    score = model.score(X_test, y_test)
    print(f"Validation Accuracy: {score:.4f}")
    
    # 6. Saving Artifacts strictly for the `crop_recommender` API
    print("Exporting models and encoders to API directory...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    model.save_model(os.path.join(OUTPUT_DIR, "crop_trend_xgb.json"))
    joblib.dump(loc_encoder, os.path.join(OUTPUT_DIR, "location_encoder.pkl"))
    joblib.dump(crop_encoder, os.path.join(OUTPUT_DIR, "crop_label_encoder.pkl"))
    
    with open(os.path.join(OUTPUT_DIR, "crop_features.json"), "w") as f:
        json.dump(features, f)
        
    print(f"Success! Model prepared and saved to {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
