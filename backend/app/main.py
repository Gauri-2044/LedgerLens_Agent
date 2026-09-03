from fastAPI import FastAPI

app = FastAPI(title="LedgerLense AI Agent",
    description="A agent to validate and match transaction records and investagate any fault",
    version="1.0.0")

@app.get('/health')
def check_health():
    return 200, {'message':"OKK Running Perfectly Fine !!"}

