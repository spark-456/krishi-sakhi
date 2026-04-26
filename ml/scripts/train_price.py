import pandas as pd
import numpy as np
import os

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASETS_DIR = os.path.join(BASE_DIR, "..", "..", "pavan-drive-ml", "datasets")
OUTPUT_DIR = os.path.join(BASE_DIR, "..", "price_forecaster")

def main():
    print("--- Krishi Sakhi: Price Forecaster Pre-processor ---")
    
    # 1. Load Data
    print("Loading daily prices dataset...")
    prices_path = os.path.join(DATASETS_DIR, "combined day prices.csv")
    
    if not os.path.exists(prices_path):
        print(f"Error: Dataset not found at {prices_path}")
        return
        
    # Read only required columns to save memory during preprocessing
    df = pd.read_csv(prices_path, usecols=["AmcName", "CommName", "Minimum", "Maximum", "Model", "DDate"])
    
    # 2. Pre-processing & Aggregations
    # Instead of training a heavy time-series model (which requires dynamic live API inputs to work well),
    # The API is currently designed to provide Historical Data Driven momentum signals.
    # Therefore, our "training" process is calculating clean aggregations to save API compute time.
    
    print("Calculating historical trends and moving averages...")
    
    # Clean string data
    df["CommName"] = df["CommName"].astype(str).str.strip().str.lower()
    df["AmcName"] = df["AmcName"].astype(str).str.strip().str.lower()
    df["DDate"] = pd.to_datetime(df["DDate"], errors='coerce')
    
    # We can calculate momentum by comparing the last 30 days vs the historical average
    # For now, let's create a robust summary table group by Crop and Market
    
    summary_df = df.groupby(["CommName", "AmcName"]).agg(
        historical_min=("Minimum", "mean"),
        historical_max=("Maximum", "mean"),
        historical_avg=("Model", "mean"),
        record_count=("Model", "count")
    ).reset_index()
    
    # Filter out markets with very little data
    summary_df = summary_df[summary_df["record_count"] > 10]
    
    # 3. Export for API usage
    # Saving this lightweight aggregated CSV so the FastApi `price_forecaster` 
    # doesn't need to load the full 25MB raw file on every boot!
    print("Exporting processed forecast weights...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    output_file = os.path.join(OUTPUT_DIR, "price_historical_model.csv")
    summary_df.to_csv(output_file, index=False)
    
    print(f"Success! Model prepared and saved to {output_file}")
    print("Note: To use this directly, you can modify `ml/price_forecaster/main.py` to read `price_historical_model.csv` instead of the raw dataset.")

if __name__ == "__main__":
    main()
