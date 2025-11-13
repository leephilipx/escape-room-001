import logging, os, uuid
import base64, re
import uvicorn

import boto3
from botocore.exceptions import ClientError

from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from typing import Any, Optional, Dict
from datetime import datetime, timedelta, timezone
from copy import deepcopy

from components.chatbot import chatbot_pipeline, ObjectCategory2
from components.schema import *


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# DynamoDB Setup
dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.getenv('DYNAMODB_TABLE_NAME', 'escape-room-001')
table = dynamodb.Table(TABLE_NAME)

ADMIN_PASSPHRASE = os.getenv('ADMIN_PASSPHRASE', 'changeme')
GAME_STATE_ID = 'hourglass-realm-game-state'


# ============== Helper Functions ==============

def init_game_state():
    """Initialize game state in DynamoDB if it doesn't exist"""
    try:
        table.put_item(
            Item={
                'pk': GAME_STATE_ID,
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
                    'stage1_count': 0,
                    'completed_stage': 0,
                    'pins': [],
                },
                'complete': False,
                'version': 1,  # For optimistic locking
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat(),
            },
            ConditionExpression='attribute_not_exists(pk)'  # Only create if not exists
        )
    except ClientError as e:
        if e.response['Error']['Code'] != 'ConditionalCheckFailedException':
            raise

def delete_game_state():
    """Delete game state only if it exists"""
    try:
        table.delete_item(
            Key={
                'pk': GAME_STATE_ID
            },
            ConditionExpression='attribute_exists(pk)'
        )
        print(f"Successfully deleted game state: {GAME_STATE_ID}")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            print(f"Game state not found: {GAME_STATE_ID}")
        else:
            raise

def get_game_state(consistent: bool = True) -> Dict[str, Any]:
    """Fetch game state from DynamoDB"""
    try:
        response = table.get_item(
            Key={'pk': GAME_STATE_ID},
            ConsistentRead=consistent
        )
        state = response.get('Item')
        if not state:
            raise HTTPException(status_code=500, detail='Game state not initialized')
        return state
    except ClientError as e:
        logging.error(f"Error fetching game state: {e}")
        raise

def update_game_state(update_data: Dict[str, Any], version: int) -> Dict[str, Any]:
    """
    Update game state with optimistic locking to prevent race conditions
    Raises exception if version mismatch (retry logic should be in caller)
    """
    try:
        response = table.update_item(
            Key={'pk': GAME_STATE_ID},
            UpdateExpression='SET ' + ', '.join([
                f'{k} = :{k}' for k in update_data.keys()
            ]) + ', #v = #v + :inc, updated_at = :updated_at',
            ExpressionAttributeNames={
                '#v': 'version'
            },
            ExpressionAttributeValues={
                **{f':{k}': v for k, v in update_data.items()},
                ':inc': 1,
                ':updated_at': datetime.now(timezone.utc).isoformat(),
                ':expected_version': version
            },
            ConditionExpression='version = :expected_version',
            ReturnValues='ALL_NEW'
        )
        return response['Attributes']
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            raise ValueError("Version mismatch - state was modified. Please retry.")
        raise

def validate_session_token(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    state = get_game_state()
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing token')
    tkn = authorization.split(' ')[1]
    if state.get('active_token') != tkn:
        raise HTTPException(status_code=403, detail='Invalid or expired session token')
    return state

def validate_admin_passphrase(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    state = get_game_state()
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Admin passphrase required')
    passphrase = authorization.split(' ')[1]
    if ADMIN_PASSPHRASE != passphrase:
        raise HTTPException(status_code=403, detail='Invalid admin passphrase')
    return state


# ============== S3 Functions ==============

s3_client = boto3.client('s3')

def upload_response_to_s3(base64_image, chatbot_response):

    # Skip uploading if environment variable is not set
    bucket = os.getenv('S3_BUCKET_NAME', None)
    if bucket is None: return

    try:
        match = re.match(r'data:image/(\w+);base64,(.+)', base64_image)
        image_format, base64_string = match.groups()
        image_bytes = base64.b64decode(base64_string)
        
        content_types = {
            'png': 'image/png',
            'jpeg': 'image/jpeg',
            'jpg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp'
        }
        content_type = content_types.get(image_format.lower(), 'image/png')
        current_datetime = datetime.now().strftime("%Y%m%d-%H%M%S")

        s3_client.put_object(
            Bucket=bucket,
            Key=f'data/{current_datetime}_drawing.{image_format.lower()}',
            Body=image_bytes,
            ContentType=content_type,
        )

        s3_client.put_object(
            Bucket=bucket,
            Key=f'data/{current_datetime}_response.txt',
            Body=chatbot_response,
        )
        
        return True
    
    except Exception as e:
        print(f"Error: {e}")
        return False


# ============== Startup ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_game_state()
    yield
    pass

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


# ============== API Endpoints ==============

@app.get('/health')
async def health_check():
    return {'status': 'ok'}

@app.post('/enter')
async def enter():
    state = get_game_state()
    tkn = str(uuid.uuid4())
    update_data = {
        'active_token': tkn,
        'token_claim_time': datetime.now(timezone.utc).isoformat()
    }
    updated_data = update_game_state(update_data, version=state['version'])
    print(f'New session claimed: {tkn}')
    return {'portalToken': tkn}


@app.get('/data')
async def get_data(authorization: Optional[str] = Header(None)):
    state = validate_session_token(authorization)
    return {
        'remaining_time': state['target_time'],
        'hints': state['hints'],
        'puzzle_1b': {
            'count': state['puzzle_1b']['stage1_count'],
            'pins': state['puzzle_1b']['pins']
        },
        'complete': state['complete'],
    }

@app.post('/unlock')
async def unlock(req: UnlockReq, authorization: Optional[str] = Header(None)):
    state = validate_session_token(authorization)
    if req.passphrase.strip().lower() == state['master_codes']['passphrase'].lower():
        update_data = {'complete': True}
        updated_data = update_game_state(update_data, version=state['version']) 
        return JSONResponse({'unlocked': True})
    raise HTTPException(status_code=403, detail='Wrong passphrase')

@app.post('/chatbot')
async def chatbot(req: ChatbotReq, authorization: Optional[str] = Header(None)):
    state = validate_session_token(authorization)
    category, response = chatbot_pipeline(req.image_data, completed_stage=state['puzzle_1b']['completed_stage'])
    if category:
        update_data = {'puzzle_1b': deepcopy(state['puzzle_1b'])}
        if update_data['puzzle_1b']['completed_stage'] == 0:
            category_str = category.value.upper()
            if update_data['puzzle_1b']['stage1_progress'][category_str] is False:
                update_data['puzzle_1b']['stage1_progress'][category_str] = True
                update_data['puzzle_1b']['stage1_count'] += 1
                if update_data['puzzle_1b']['stage1_count'] == 5:
                    response += "\n\nAll five drawings? Wowza! You did it! PIN time—uh, where did I put it again?"
                    update_data['puzzle_1b']['completed_stage'] = 1
                    update_data['puzzle_1b']['pins'].append(state['master_codes']['puzzle_1b_pins'][0])
                else:
                    response += f"\n\nYou've found the {category_str} drawing, only {5 - update_data['puzzle_1b']['stage1_count']} more—right? I think so!"
            else:
                response += f"\n\nHeyyy, déjà blue! You’ve drawn {category_str} before—try something new!"
        elif update_data['puzzle_1b']['completed_stage'] == 1:
            response += '\n\nPIN? Oh! I already gave you one! …I think. Maybe. Probably?'
            if category == ObjectCategory2.JESUS:
                response = ''
                update_data['puzzle_1b']['completed_stage'] = 2
                update_data['puzzle_1b']['pins'].append(state['master_codes']['puzzle_1b_pins'][1])
        updated_data = update_game_state(update_data, version=state['version'])
    upload_response_to_s3(req.image_data, response)
    return {'response': response}

@app.get('/admin')
async def get_admin_state(authorization: Optional[str] = Header(None)):
    state = validate_admin_passphrase(authorization)
    return state

@app.post("/admin")
async def update_admin_state(update: AdminUpdate, authorization: Optional[str] = Header(None)):
    state = validate_admin_passphrase(authorization)
    try:
        update_data = {'master_codes': deepcopy(state['master_codes'])}
        if update.target_time is not None:
            datetime.fromisoformat(update.target_time)
            update_data['target_time'] = update.target_time
        if update.hints is not None:
            if not isinstance(update.hints, list):
                raise ValueError("hints must be a list")
            update_data['hints'] = update.hints
        if update.passphrase is not None:
            if not isinstance(update.passphrase, str):
                raise ValueError("passphrase must be a string")
            update_data['master_codes']['passphrase'] = update.passphrase
        if update.puzzle_1b_pins is not None:
            if not isinstance(update.puzzle_1b_pins, list):
                raise ValueError("puzzle_1b_pins must be a list")
            update_data['master_codes']['puzzle_1b_pins'] = update.puzzle_1b_pins
        updated_data = update_game_state(update_data, version=state['version'])
        return updated_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/reset")
async def reset_admin_state(authorization: Optional[str] = Header(None)):
    state = validate_admin_passphrase(authorization)
    delete_game_state()
    init_game_state()
    state = get_game_state()
    return state

if __name__ == "__main__":
    uvicorn.run("main_lambda:app", host="0.0.0.0", port=8000, reload=True)
