from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
import uuid
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000', '*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# In-memory state (local only)
STATE = {
    'active_token': None,
    'token_claim_time': None,
    'target_time': (datetime.now(timezone.utc) + timedelta(minutes=60)).isoformat(),
    'hints': [],
    'passphrase': os.environ.get('SECRET_PASSPHRASE', 'OPEN'),
    'puzzle_1b': {
        'car': False, 'house': False, 'love': False, 'money': False, 'family': False,
        'real': False, 'count': 2
    }
}

ADMIN_TOKEN = os.environ.get('ADMIN_TOKEN', 'changeme-admin-token')

class UnlockReq(BaseModel):
    passphrase: str

class ChatbotReq(BaseModel):
    image_data: str

class SetTimeReq(BaseModel):
    minutes_from_now: int

class HintReq(BaseModel):
    hint: str

@app.post('/enter')
async def enter():
    tkn = str(uuid.uuid4())
    STATE['active_token'] = tkn
    STATE['token_claim_time'] = datetime.now(timezone.utc).isoformat()
    print(f'New session claimed: {tkn}')
    return {'portalToken': tkn}

@app.get('/data')
async def get_data(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing token')
    tkn = authorization.split(' ')[1]
    if STATE.get('active_token') != tkn:
        raise HTTPException(status_code=403, detail='Invalid or expired session token')
    return {
        'remaining_time': STATE['target_time'],
        'hints': STATE['hints'],
        'puzzle_1b': {
            'count': STATE['puzzle_1b']['count'],
            'real': STATE['puzzle_1b']['real']
        }
    }

@app.post('/unlock')
async def unlock(req: UnlockReq, authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing token')
    tkn = authorization.split(' ')[1]
    if STATE.get('active_token') != tkn:
        raise HTTPException(status_code=403, detail='Invalid session token')
    if req.passphrase.strip().lower() == STATE.get('passphrase', '').lower():
        return JSONResponse({'unlocked': True})
    raise HTTPException(status_code=403, detail='Wrong passphrase')

@app.post('/chatbot')
async def chatbot(req: ChatbotReq, authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing token')
    tkn = authorization.split(' ')[1]
    if STATE.get('active_token') != tkn:
        raise HTTPException(status_code=403, detail='Invalid or expired session token')
    print(f'Received chatbot image data of length {len(req.image_data)}')
    print(req.image_data[:30] + '...' if len(req.image_data) > 30 else req.image_data)
    return {'message': 'This is a placeholder chatbot response.'}

# @app.post('/admin/reset')
# async def admin_reset(authorization: Optional[str] = Header(None)):
#     if authorization != ADMIN_TOKEN:
#         raise HTTPException(status_code=403, detail='Admin token required')
#     STATE['active_token'] = None
#     STATE['token_claim_time'] = None
#     STATE['hints'] = []
#     STATE['target_time'] = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
#     return {'ok': True}

# @app.post('/admin/set_time')
# async def admin_set_time(req: SetTimeReq, authorization: Optional[str] = Header(None)):
#     if authorization != ADMIN_TOKEN:
#         raise HTTPException(status_code=403, detail='Admin token required')
#     STATE['target_time'] = (datetime.now(timezone.utc) + timedelta(minutes=req.minutes_from_now)).isoformat()
#     return {'ok': True, 'target': STATE['target_time']}

# @app.post('/admin/send_hint')
# async def admin_send_hint(req: HintReq, authorization: Optional[str] = Header(None)):
#     if authorization != ADMIN_TOKEN:
#         raise HTTPException(status_code=403, detail='Admin token required')
#     STATE.setdefault('hints', []).append(req.hint)
#     return {'ok': True, 'hints': STATE['hints']}