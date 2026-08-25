"""
Wrapper around Supabase Storage.

We use the service_role key here (backend-only, never sent to the
frontend) so the backend has full read/write access to the bucket,
while the bucket itself stays private - users only ever get short-lived
signed URLs, never a permanent public link to someone else's photo.
"""

import uuid

from supabase import Client, create_client

from app.core.config import get_settings

settings = get_settings()

BUCKET_NAME = "generations"

_client: Client | None = None


def get_storage_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


def _safe_filename(original_filename: str) -> str:
    """Never trust the client-supplied filename - generate our own."""
    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "bin"
    ext = "".join(c for c in ext if c.isalnum())[:5] or "bin"
    return f"{uuid.uuid4().hex}.{ext}"


def upload_image(content: bytes, original_filename: str, content_type: str) -> str:
    """
    Uploads image bytes to the private 'generations' bucket.
    Returns the storage path (not a public URL - use get_signed_url to view it).
    """
    client = get_storage_client()
    path = _safe_filename(original_filename)
    client.storage.from_(BUCKET_NAME).upload(
        path=path,
        file=content,
        file_options={"content-type": content_type},
    )
    return path


def get_signed_url(path: str, expires_in_seconds: int = 3600) -> str:
    """Returns a temporary signed URL so the frontend can display/download the image."""
    client = get_storage_client()
    result = client.storage.from_(BUCKET_NAME).create_signed_url(path, expires_in_seconds)
    return result["signedURL"]


def download_image(path: str) -> bytes:
    """Downloads raw image bytes from the private bucket - used by the
    background worker to feed the input image to an AI provider."""
    client = get_storage_client()
    return client.storage.from_(BUCKET_NAME).download(path)
