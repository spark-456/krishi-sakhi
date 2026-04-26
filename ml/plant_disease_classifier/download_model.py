from pathlib import Path

from huggingface_hub import snapshot_download


MODEL_ID = "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"
MODEL_DIR = Path(__file__).resolve().parent / "model"


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=MODEL_ID,
        local_dir=MODEL_DIR,
        local_dir_use_symlinks=False,
        allow_patterns=[
            "config.json",
            "preprocessor_config.json",
            "pytorch_model.bin",
            "model.safetensors",
            "*.safetensors",
            "README.md",
            "*.json",
        ],
    )
    print(f"Downloaded {MODEL_ID} to {MODEL_DIR}")


if __name__ == "__main__":
    main()
