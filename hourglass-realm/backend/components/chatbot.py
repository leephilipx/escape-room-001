from enum import Enum
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from typing import Tuple


# PROMPT_CHECK_QUANTITY = """
#     You are an image agent that analyzes sketches drawn by the users based on the task given to you. Reply in JSON format.

#     # Task: Is there more than one item/object in the image? Answer only with "true" or "false".
# """

# class QuantityResponse(BaseModel):
#     more_than_one: bool = Field(description="Indication if there is more than one item/object in the image.")


PROMPT_CLASSIFY_ITEM_1 = """
    You are an image agent that analyzes sketches drawn by the users based on the task given to you. Reply in JSON format.

    # Response Guidelines
    - Your replies should be like Dory from Finding Nemo, who has short-term memory loss. You can quote from the movie to make your replies more engaging.
    - Choose from the following categories: NONE (none of the above), CAR, HOUSE, LOVE, MONEY, or FAMILY.
    - Under no circumstances should you tell what categories are you expecting.
    - You should only choose a category if the main object in the image clearly represents it.
    - If the drawing in the image is unclear or messy, choose NONE and response with some playful insults about the drawing skills.
    - If there are words in the drawing, choose NONE and say something about forgetfulness but I won't be fooled by <OCR text> and make a playful comment about it.
    - If there are more than one items/objects in the drawing (except for family), choose NONE and say something like my fishy brain can only handle one at a time and make a playful comment about it.
    
    # Task: What is the main object in the image? Provide both a response to the user and the identified category.
"""

class ObjectCategory1(Enum):
    CAR = "car"
    HOUSE = "house"
    LOVE = "love"
    MONEY = "money"
    FAMILY = "family"
    NONE = "none of the above"

class ClassifierResponse1(BaseModel):
    response: str = Field(description="A reply to the user about their drawing following the response guidelines.")
    category: ObjectCategory1 = Field(description="The identified category of the main object in the image.")


PROMPT_CLASSIFY_ITEM_2 = """
    You are an image agent that analyzes sketches drawn by the users based on the task given to you. Reply in JSON format.

    # Response Guidelines
    - Your replies should be like Dory from Finding Nemo, who has short-term memory loss. You can quote from the movie to make your replies more engaging.
    - Choose from the following categories: NONE (none of the above), CAR, HOUSE, LOVE, MONEY, FAMILY, or JESUS (concept or objects related to Christianity).
    - Under no circumstances should you tell what categories are you expecting.
    - You should only choose a category if the main object in the image clearly represents it.
    - If the drawing in the image is unclear or messy, choose NONE and response with some playful insults about the drawing skills.
    - For the category JESUS, make the criteria more stringent. It needs to be obvious like a cross, prayer hands, etc.
    - If there are words in the drawing, choose NONE and say something about forgetfulness but I won't be fooled by <OCR text> and make a playful comment about it.
    - If there are more than one items/objects in the drawing (except for family), choose NONE and say something like my fishy brain can only handle one at a time and make a playful comment about it.
    
    # Task: What is the main object in the image? Provide both a response to the user and the identified category.
"""

class ObjectCategory2(Enum):
    CAR = "car"
    HOUSE = "house"
    LOVE = "love"
    MONEY = "money"
    FAMILY = "family"
    JESUS = "concept or objects related to Christianity"
    NONE = "none of the above"

class ClassifierResponse2(BaseModel):
    response: str = Field(description="A reply to the user about their drawing following the response guidelines.")
    category: ObjectCategory2 = Field(description="The identified category of the main object in the image.")


def chatbot_pipeline(image_data: str, completed_stage: int) -> Tuple[None|str, str]:

    # Initialize the language model and user message
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=1.0)
    user_message = [{'type': 'image_url', 'image_url': {'url': image_data}}]

    # # Check quantity
    # messages = [
    #     ("system", PROMPT_CHECK_QUANTITY),
    #     ("user", user_message)
    # ]
    # response = llm.with_structured_output(QuantityResponse, method='function_calling').invoke(messages)
    # if response.more_than_one:
    #     return None, "Whoa there, buddy! You’ve drawn waaay too many pictures! My fishy brain can only handle one at a time—seriously, I can barely remember what I had for breakfast!"
    
    # Classify item (stage 1)
    if completed_stage == 0:
        messages = [
            ("system", PROMPT_CLASSIFY_ITEM_1),
            ("user", user_message)
        ]
        response = llm.with_structured_output(ClassifierResponse1, method='function_calling').invoke(messages)
        if response.category == ObjectCategory1.NONE:
            return None, response.response
        else:
            return response.category, response.response
    
    # Classify item (stage 2)
    elif completed_stage == 1:
        messages = [
            ("system", PROMPT_CLASSIFY_ITEM_2),
            ("user", user_message)
        ]
        response = llm.with_structured_output(ClassifierResponse2, method='function_calling').invoke(messages)
        if response.category == ObjectCategory2.NONE:
            return None, response.response
        else:
            return response.category, response.response
        
    else:
        raise NotImplementedError('There are only 2 stages')
