import logging, os, uuid
import uvicorn

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Any, Optional, Dict
from datetime import datetime, timedelta, timezone

from components.chatbot import chatbot_pipeline, ObjectCategory2
from components.schema import *


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

ADMIN_PASSPHRASE = os.getenv('ADMIN_PASSPHRASE', 'changeme')


# ============== Helper Functions ==============

def reset_game_state() -> Dict[str, Any]:
    return {
        'active_token': str(uuid.uuid4()),
        'token_claim_time': datetime.now(timezone.utc).isoformat(),
        'target_time': (datetime.now(timezone.utc) + timedelta(minutes=60)).isoformat(),
        'hints': [],
        'master_codes': {
            'passphrase': os.getenv('SECRET_PASSPHRASE', 'OPEN'),
            'puzzle_1b_pins': os.getenv('GAME_PUZZLE_1B_STAGE_PINS', '000,000').split(',')
        },
        'puzzle_1b': {
            'stage1_progress': {'CAR': False, 'HOUSE': False, 'LOVE': False, 'MONEY': False, 'FAMILY': False},
            'stage1_count': 0, 'completed_stage': 0, 'pins': [],
        },
        'complete': False,
    }

# In-memory state (local only)
STATE = reset_game_state()

def validate_session_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing token')
    tkn = authorization.split(' ')[1]
    if STATE.get('active_token') != tkn:
        raise HTTPException(status_code=403, detail='Invalid or expired session token')

def validate_admin_passphrase(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Admin passphrase required')
    passphrase = authorization.split(' ')[1]
    if ADMIN_PASSPHRASE != passphrase:
        raise HTTPException(status_code=403, detail='Invalid admin passphrase')


# ============== API Endpoints ==============

@app.get('/health')
async def health_check():
    return {'status': 'ok'}

@app.post('/enter')
async def enter():
    tkn = str(uuid.uuid4())
    STATE['active_token'] = tkn
    STATE['token_claim_time'] = datetime.now(timezone.utc).isoformat()
    print(f'New session claimed: {tkn}')
    return {'portalToken': tkn}

@app.get('/data')
async def get_data(authorization: Optional[str] = Header(None)):
    validate_session_token(authorization)
    return {
        'remaining_time': STATE['target_time'],
        'hints': STATE['hints'],
        'puzzle_1b': {
            'count': STATE['puzzle_1b']['stage1_count'],
            'pins': STATE['puzzle_1b']['pins']
        },
        'complete': STATE['complete'],
    }

@app.post('/unlock')
async def unlock(req: UnlockReq, authorization: Optional[str] = Header(None)):
    validate_session_token(authorization)
    if req.passphrase.strip().lower() == STATE['master_codes']['passphrase'].lower():
        STATE['complete'] = True
        return JSONResponse({'unlocked': True})
    raise HTTPException(status_code=403, detail='Wrong passphrase')

@app.post('/chatbot')
async def chatbot(req: ChatbotReq, authorization: Optional[str] = Header(None)):
    validate_session_token(authorization)
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
                    STATE['puzzle_1b']['pins'].append(STATE['master_codes']['puzzle_1b_pins'][0])
                else:
                    response += f"\n\nYou've found the {category_str} drawing, only {5 - STATE['puzzle_1b']['stage1_count']} more—right? I think so!"
            else:
                response += f"\n\nHeyyy, déjà blue! You’ve drawn {category_str} before—try something new!"
        elif STATE['puzzle_1b']['completed_stage'] == 1:
            response += '\n\nPIN? Oh! I already gave you one! …I think. Maybe. Probably?'
            if category == ObjectCategory2.JESUS:
                response = ''
                STATE['puzzle_1b']['completed_stage'] = 2
                STATE['puzzle_1b']['pins'].append(STATE['master_codes']['puzzle_1b_pins'][1])
    return {'response': response}

@app.get('/admin')
async def get_admin_state(authorization: Optional[str] = Header(None)):
    validate_admin_passphrase(authorization)
    return STATE

@app.post("/admin")
async def update_admin_state(update: AdminUpdate, authorization: Optional[str] = Header(None)):
    validate_admin_passphrase(authorization)
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
            STATE['master_codes']['passphrase'] = update.passphrase
        if update.puzzle_1b_pins is not None:
            if not isinstance(update.puzzle_1b_pins, list):
                raise ValueError("puzzle_1b_pins must be a list")
            STATE['master_codes']['puzzle_1b_pins'] = update.puzzle_1b_pins
        return STATE
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    
@app.post("/reset")
async def reset_admin_state(authorization: Optional[str] = Header(None)):
    validate_admin_passphrase(authorization)
    return reset_game_state()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
