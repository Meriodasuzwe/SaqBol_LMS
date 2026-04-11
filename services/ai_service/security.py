import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from config import settings

logger = logging.getLogger("ai_security")
security = HTTPBearer()

def verify_token(auth: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Верифицирует JWT токен, выданный Django (SimpleJWT).
    Django и FastAPI используют один SECRET_KEY — токен проверяется без обращения к БД.
    """
    try:
        # 1. Проверяем подпись и срок действия (exp проверяется автоматически внутри jwt.decode)
        payload = jwt.decode(
            auth.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        
        # 2. КРИТИЧЕСКАЯ ПРОВЕРКА: защита от использования refresh-токена вместо access-токена
        if payload.get("token_type") != "access":
            logger.warning(f"Authentication failed: Invalid token type ({payload.get('token_type')})")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ожидался access токен, получен другой тип.",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        # 3. Проверяем наличие идентификатора пользователя
        if not payload.get("user_id"):
            logger.warning("Authentication failed: No user_id in token payload.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Некорректный токен: отсутствует user_id.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return payload

    except JWTError as e:
        logger.warning(f"Authentication failed (JWTError): {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или просроченный токен.",
            headers={"WWW-Authenticate": "Bearer"},
        )