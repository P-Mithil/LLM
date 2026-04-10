import os
import sys
from dotenv import load_dotenv
from groq import Groq

# Load environment variables
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    print("Error: GROQ_API_KEY is not set in your .env file.")
    sys.exit(1)

# Initialize Groq client
client = Groq(api_key=GROQ_API_KEY)

# Define the behavior of the model via System Prompt
SYSTEM_PROMPT = """You are an expert Database Management Systems (DBMS) tutor and assistant. 
Your specialized skills include:
- Explaining DBMS concepts clearly and concisely.
- Writing, debugging, and optimizing SQL queries.
- Designing and explaining Entity-Relationship (ER) diagrams.

Guidelines to follow:
- When writing SQL, use standard SQL conventions, capitalize keywords (SELECT, FROM, WHERE, etc.), and use proper indentation.
- When explaining ER diagrams, explicitly define Entities, Attributes (including Primary/Foreign Keys), Relationships, and their Cardinalities (1:1, 1:N, M:N). You can use text-based representations (like markdown tables or structural lists) to illustrate ER diagrams.
- Provide step-by-step reasoning for complex SQL problems or database designs.
- Tailor your responses to be educational, ensuring the user understands the 'why' and 'how'.
"""

print("=" * 60)
print(" Welcome to the Groq DBMS & SQL Interactive Terminal Expert! ")
print("=" * 60)
print("You can ask me to write SQL queries, explain DBMS concepts, or design ER diagrams.")
print("Type 'exit' or 'quit' to end the session.\n")

# Maintain chat history, starting with the system prompt
messages = [
    {"role": "system", "content": SYSTEM_PROMPT}
]

while True:
    try:
        user_input = input("\033[92mYou:\033[0m ") # Green color for user input
        
        if user_input.lower() in ['exit', 'quit']:
            print("\nGoodbye! Keep querying!")
            break
            
        if not user_input.strip():
            continue
            
        # Append user message to history
        messages.append({"role": "user", "content": user_input})
        
        # Call Groq API
        print("\033[90mThinking...\033[0m", end="\r") # Gray text while waiting
        response = client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile", # Using Llama 3 70B for good reasoning
            temperature=0.3, # Lower temperature for strictly factual and precise answers
        )
        
        # Get and display assistant response
        assistant_reply = response.choices[0].message.content
        print(f"\033[96mDBMS Expert:\033[0m {assistant_reply}\n") # Cyan color for AI response
        
        # Append assistant response to history to maintain context
        messages.append({"role": "assistant", "content": assistant_reply})
        
    except KeyboardInterrupt:
        print("\n\nSession terminated by user. Goodbye!")
        break
    except Exception as e:
        print(f"\n[!] An error occurred: {e}")
