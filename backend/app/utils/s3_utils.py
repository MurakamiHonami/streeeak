import os
import uuid
import boto3
from fastapi import HTTPException

def upload_image_to_s3(file_obj, filename: str, content_type: str, folder: str = "uploads") -> str:
    s3_client = boto3.client("s3", region_name="ap-northeast-1")
    bucket_name = os.environ.get("S3_BUCKET_NAME", "streeeak-frontend-111")
    cdn_domain = os.environ.get("CDN_DOMAIN", "https://streeeak.link")

    ext = ""
    if "." in filename:
        ext = f".{filename.split('.')[-1].lower()}"
    
    file_key = f"{folder}/{uuid.uuid4().hex}{ext}"

    try:
        s3_client.upload_fileobj(
            file_obj,
            bucket_name,
            file_key,
            ExtraArgs={"ContentType": content_type}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"S3 Upload Error: {str(e)}")

    return f"{cdn_domain.rstrip('/')}/{file_key}"