from pathlib import Path

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import get_settings

_s3_client = None


def is_s3_enabled() -> bool:
    settings = get_settings()
    return bool(settings.s3_endpoint_url.strip() and settings.s3_secret_key.strip())


def get_s3_client():
    global _s3_client
    settings = get_settings()
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url.strip(),
            aws_access_key_id=settings.s3_access_key.strip(),
            aws_secret_access_key=settings.s3_secret_key.strip(),
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
        )
    return _s3_client


def ensure_bucket() -> None:
    if not is_s3_enabled():
        return
    settings = get_settings()
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
    except ClientError:
        client.create_bucket(Bucket=settings.s3_bucket)


def put_object_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    if is_s3_enabled():
        ensure_bucket()
        settings = get_settings()
        get_s3_client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return
    # Local disk fallback when S3/MinIO is not configured
    upload_dir = get_settings().upload_dir.resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    target = (upload_dir / Path(key).name).resolve()
    target.write_bytes(data)


def get_object_bytes(key: str) -> bytes:
    if is_s3_enabled():
        settings = get_settings()
        response = get_s3_client().get_object(Bucket=settings.s3_bucket, Key=key)
        return response["Body"].read()
    upload_dir = get_settings().upload_dir.resolve()
    target = (upload_dir / Path(key).name).resolve()
    return target.read_bytes()


def delete_object(key: str) -> None:
    if is_s3_enabled():
        try:
            get_s3_client().delete_object(Bucket=get_settings().s3_bucket, Key=key)
        except Exception:
            pass
        return
    upload_dir = get_settings().upload_dir.resolve()
    target = (upload_dir / Path(key).name).resolve()
    target.unlink(missing_ok=True)
