"""
AI provider calls for the four generation tools.

Design notes:
  - Image-to-image tools (enhance / remove_bg / style) go through the
    Hugging Face Inference API, using `huggingface_api_token`.
  - caption goes through OpenRouter's chat completions API with a
    vision-capable model, using `openrouter_api_key`.
  - `sber_auth_key` is reserved for a future Kandinsky/GigaChat provider
    swap and isn't wired up yet - see AIProviderNotConfigured below.

If a required API key isn't configured, or the provider call fails, we
raise AIProviderError instead of silently returning the original image.
Pretending a generation succeeded when no real processing happened would
be worse than an honest failure - the caller (generations.py) catches
this, marks the generation "failed", and refunds the user's credit.

Swapping in a different/better model per tool later is a one-line change
here; nothing outside this file needs to know which provider is used.
"""

import base64
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger("vireli.ai")

HF_API_BASE = "https://api-inference.huggingface.co/models"
OPENROUTER_API_BASE = "https://openrouter.ai/api/v1/chat/completions"

# One HF model per image tool. Swap these for whichever models you've
# validated give good results - they're intentionally isolated here.
HF_MODELS = {
    "remove_bg": "briaai/RMBG-1.4",
    "enhance": "caidas/swin2SR-classical-sr-x2-64",
    # img2img style transfer, prompted with the chosen style preset.
    "style": "timbrooks/instruct-pix2pix",
}

CAPTION_MODEL = "openai/gpt-4o-mini"

STYLE_PROMPTS = {
    "clean": "make the image look clean, bright, and minimal",
    "luxury": "make the image look luxurious, elegant, high-end product photography",
    "street": "make the image look like gritty urban street photography",
    "cinematic": "make the image look cinematic, dramatic lighting, film color grade",
    "anime": "turn the image into anime style illustration",
    "editorial": "make the image look like a high-fashion editorial photograph",
}

REQUEST_TIMEOUT_SECONDS = 60.0


class AIProviderError(Exception):
    """Raised when a provider isn't configured or a generation call fails."""


async def _hf_image_call(model: str, image_bytes: bytes, extra_payload: dict | None = None) -> bytes:
    settings = get_settings()
    if not settings.huggingface_api_token:
        raise AIProviderError("HUGGINGFACE_API_TOKEN is not configured on the server")

    headers = {"Authorization": f"Bearer {settings.huggingface_api_token}"}

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        if extra_payload:
            # Some HF pipelines (e.g. instruct-pix2pix) expect JSON with the
            # image base64-encoded inside `inputs`, plus extra parameters.
            payload = {
                "inputs": base64.b64encode(image_bytes).decode("ascii"),
                **extra_payload,
            }
            resp = await client.post(f"{HF_API_BASE}/{model}", headers=headers, json=payload)
        else:
            # Plain image-in / image-out pipelines accept raw bytes.
            headers["Content-Type"] = "application/octet-stream"
            resp = await client.post(f"{HF_API_BASE}/{model}", headers=headers, content=image_bytes)

    if resp.status_code == 503:
        # Model is cold-starting on HF's side.
        raise AIProviderError("AI model is warming up, please try again in a moment")
    if resp.status_code != 200:
        raise AIProviderError(f"AI provider error ({resp.status_code}): {resp.text[:300]}")

    content_type = resp.headers.get("content-type", "")
    if not content_type.startswith("image/"):
        raise AIProviderError(f"Unexpected response from AI provider: {resp.text[:300]}")

    return resp.content


async def process_remove_bg(image_bytes: bytes) -> bytes:
    return await _hf_image_call(HF_MODELS["remove_bg"], image_bytes)


async def process_enhance(image_bytes: bytes) -> bytes:
    return await _hf_image_call(HF_MODELS["enhance"], image_bytes)


async def process_style(image_bytes: bytes, style: str) -> bytes:
    prompt = STYLE_PROMPTS.get(style, STYLE_PROMPTS["clean"])
    return await _hf_image_call(
        HF_MODELS["style"],
        image_bytes,
        extra_payload={"parameters": {"prompt": prompt}},
    )


async def process_caption(image_bytes: bytes, content_type: str) -> str:
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise AIProviderError("OPENROUTER_API_KEY is not configured on the server")

    data_url = f"data:{content_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": CAPTION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Write one short, engaging social media caption (max 2 sentences, "
                            "no hashtags) for this photo, in the same language the viewer would "
                            "expect for this kind of content."
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "max_tokens": 120,
    }

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        resp = await client.post(OPENROUTER_API_BASE, headers=headers, json=payload)

    if resp.status_code != 200:
        raise AIProviderError(f"AI provider error ({resp.status_code}): {resp.text[:300]}")

    body = resp.json()
    try:
        return body["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as exc:
        raise AIProviderError(f"Unexpected response shape from caption model: {body}") from exc
