from pydantic import BaseModel
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token


class AuthRegisterRequest(UserCreate):
    pass


class AuthLoginRequest(UserLogin):
    pass


class AuthSessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
