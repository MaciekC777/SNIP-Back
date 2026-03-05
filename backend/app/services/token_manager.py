"""AES-256-GCM token encryption via Fernet (cryptography library)."""

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _get_fernet() -> Fernet:
    key = settings.encryption_key.encode()
    return Fernet(key)


def encrypt_token(plaintext: str) -> str:
    """Encrypt a plaintext token string. Returns URL-safe base64 ciphertext."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a ciphertext string back to plaintext token."""
    f = _get_fernet()
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken as e:
        raise ValueError("Token decryption failed — invalid key or corrupted data") from e
