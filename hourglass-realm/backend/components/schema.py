from pydantic import BaseModel
from typing import List, Optional

class UnlockReq(BaseModel):
    passphrase: str

class ChatbotReq(BaseModel):
    image_data: str

class SetTimeReq(BaseModel):
    minutes_from_now: int

class HintReq(BaseModel):
    hint: str

class AdminUpdate(BaseModel):
    target_time: Optional[str] = None
    hints: Optional[List[str]] = None
    passphrase: Optional[str] = None
    puzzle_1b_pins: Optional[List[str]] = None