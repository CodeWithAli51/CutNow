import base64
import io

import qrcode
from qrcode.image.svg import SvgPathImage


def _qr(data):
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=3)
    qr.add_data(data)
    qr.make(fit=True)
    return qr


def png_data_uri(data):
    img = _qr(data).make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def svg_string(data):
    img = _qr(data).make_image(image_factory=SvgPathImage)
    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue().decode("utf-8")