import logging, os, uuid
import uvicorn

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone

from chatbot import chatbot_pipeline, ObjectCategory2


env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    from dotenv import load_dotenv
    load_dotenv(env_path)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
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
    'passphrase': os.getenv('SECRET_PASSPHRASE', 'OPEN'),
    'puzzle_1b': {
        'stage1_progress': {'CAR': False, 'HOUSE': False, 'LOVE': False, 'MONEY': False, 'FAMILY': False},
        'stage1_count': 0, 'completed_stage': 0, 'pins': []
    }
}

ADMIN_PASSPHRASE = os.getenv('ADMIN_PASSPHRASE', 'changeme-admin-token')


class UnlockReq(BaseModel):
    passphrase: str

class ChatbotReq(BaseModel):
    image_data: str

class SetTimeReq(BaseModel):
    minutes_from_now: int

class HintReq(BaseModel):
    hint: str

class AdminUpdate(BaseModel):
    target_time: str = None
    hints: list[str] = None
    passphrase: str = None
    class Config:
        extra = "forbid" # Allow partial updates


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
            'count': STATE['puzzle_1b']['stage1_count'],
            'pins': STATE['puzzle_1b']['pins']
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
    category, response = chatbot_pipeline(req.image_data, completed_stage=STATE['puzzle_1b']['completed_stage'])
    if category:
        if STATE['puzzle_1b']['completed_stage'] == 0:
            category_str = category.value.upper()
            if STATE['puzzle_1b']['stage1_progress'][category_str] is False:
                STATE['puzzle_1b']['stage1_progress'][category_str] = True
                STATE['puzzle_1b']['stage1_count'] += 1
                if STATE['puzzle_1b']['stage1_count'] == 5:
                    response += "\n\nAll five drawings? Wowza! You did it! PIN time—uh, where did I put it again?"
                    STATE['puzzle_1b']['completed_stage'] = 1
                    STATE['puzzle_1b']['pins'].append(os.getenv('GAME_PUZZLE_1B_STAGE_1_PIN', '000'))
                else:
                    response += f"\n\nYou've found the {category_str} drawing, only {5 - STATE['puzzle_1b']['stage1_count']} more—right? I think so!"
            else:
                response += f"\n\nHeyyy, déjà blue! You’ve drawn {category_str} before—try something new!"
        elif STATE['puzzle_1b']['completed_stage'] == 1:
            response += '\n\nPIN? Oh! I already gave you one! …I think. Maybe. Probably?'
            if category == ObjectCategory2.JESUS:
                response = ''
                STATE['puzzle_1b']['completed_stage'] = 2
                STATE['puzzle_1b']['pins'].append(os.getenv('GAME_PUZZLE_1B_STAGE_2_PIN', '000'))
    return {'response': response}

@app.get('/admin')
async def get_admin_state(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Admin passphrase required')
    passphrase = authorization.split(' ')[1]
    if ADMIN_PASSPHRASE != passphrase:
        raise HTTPException(status_code=403, detail='Invalid admin passphrase')
    return STATE

@app.post("/admin")
async def update_admin_state(update: AdminUpdate, authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Admin passphrase required')
    passphrase = authorization.split(' ')[1]
    if ADMIN_PASSPHRASE != passphrase:
        raise HTTPException(status_code=403, detail='Invalid admin passphrase')
    try:
        if update.target_time is not None:
            datetime.fromisoformat(update.target_time)
            STATE['target_time'] = update.target_time
        if update.hints is not None:
            if not isinstance(update.hints, list):
                raise ValueError("hints must be a list")
            STATE['hints'] = update.hints
        if update.passphrase is not None:
            if not isinstance(update.passphrase, str):
                raise ValueError("passphrase must be a string")
            STATE['passphrase'] = update.passphrase
        return STATE   
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
