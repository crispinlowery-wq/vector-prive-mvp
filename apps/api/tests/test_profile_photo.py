import base64

import pytest
from fastapi import HTTPException

from app.main import decode_profile_photo


def test_profile_photo_accepts_a_small_jpeg() -> None:
    content = b"\xff\xd8\xff" + b"photo"
    data_url = "data:image/jpeg;base64," + base64.b64encode(content).decode("ascii")

    mime, decoded = decode_profile_photo(data_url)

    assert mime == "image/jpeg"
    assert decoded == content


def test_profile_photo_rejects_mismatched_image_content() -> None:
    data_url = "data:image/png;base64," + base64.b64encode(b"not-a-png").decode("ascii")

    with pytest.raises(HTTPException) as caught:
        decode_profile_photo(data_url)

    assert caught.value.status_code == 422
