import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from config import settings

logger = logging.getLogger("ai_security")
security = HTTPBearer()


def verify_token(auth: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Верифицирует JWT токен, выданный Django.
    Django и FastAPI используют один SECRET_KEY — токен проверяется без обращения к БД.
    """
    try:
        payload = jwt.decode(
            auth.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except JWTError as e:
        logger.warning(f"Authentication failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или просроченный токен.",
            headers={"WWW-Authenticate": "Bearer"},
        )