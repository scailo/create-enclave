import asyncio
# Import aiohttp library for async requests
import aiohttp
import os
import sys
import logging
import random
from datetime import datetime
from aiohttp import web
from dotenv import load_dotenv

# Import login module
from scailo_sdk.login_api import AsyncLoginServiceClient, login

# --- Configuration and Globals ---

# Set up basic logging configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

class Config:
    """Holds all necessary environment variables, matching the Go structure."""
    ENCLAVE_NAME: str = ""
    SCAILO_API: str = ""
    PORT: int = 8080 # Default port
    USERNAME: str = ""
    PASSWORD: str = ""

# Global state variables
global_config = Config()
production: bool = False
index_page_cache: str = ""
enclave_prefix: str = ""
auth_token: str = ""

# Constants
LOGIN_INTERVAL_SECONDS = 3600 # 1 hour
INDEX_HTML_FILE = "index.html"

# --- Initialization and Config Loading ---

def load_config():
    """Reads and validates environment variables."""
    load_dotenv(override=True)

    global production
    # Determine production status
    production_flag = os.getenv("PRODUCTION", "false").lower() == "true"
    
    # Matching Go's logic: if GIN_MODE is 'release' OR PRODUCTION is 'true'
    if production_flag:
        production = True
    
    log.info(f"Server operating in Production mode: {production}")

    # 2. Read environment variables
    global_config.ENCLAVE_NAME = os.getenv("ENCLAVE_NAME") or ""
    global_config.SCAILO_API = os.getenv("SCAILO_API") or ""
    global_config.USERNAME = os.getenv("USERNAME") or ""
    global_config.PASSWORD = os.getenv("PASSWORD") or ""

    port_str = os.getenv("PORT", "8080")
    try:
        global_config.PORT = int(port_str)
    except ValueError:
        log.error(f"Invalid PORT value: {port_str}. Using default 8080.")
        global_config.PORT = 8080

    # 3. Validate environment variables (matches Go's exit logic)
    exit_code = 0
    if not global_config.ENCLAVE_NAME:
        log.error("ENCLAVE_NAME not set")
        exit_code = 1
    if not global_config.SCAILO_API:
        log.error("SCAILO_API not set")
        exit_code = 1
    if global_config.PORT == 0:
        log.error("PORT not set or is 0")
        exit_code = 1
    if not global_config.USERNAME:
        log.error("USERNAME not set (required for API login stub)")
        exit_code = 1
    if not global_config.PASSWORD:
        log.error("PASSWORD not set (required for API login stub)")
        exit_code = 1

    global enclave_prefix
    enclave_prefix = f"/enclave/{global_config.ENCLAVE_NAME}"
    
    if exit_code != 0:
        log.error("Configuration errors found. Exiting.")
        sys.exit(exit_code)

async def perform_login():
    global auth_token
    
    log.info(f"Attempting login to API at: {global_config.SCAILO_API} with user: {global_config.USERNAME}")

    async with aiohttp.ClientSession() as http_client:
        # Create the login client
        login_client = AsyncLoginServiceClient(global_config.SCAILO_API, http_client)
        # Call the login method to retrieve the auth token
        login_resp = await login_client.login_as_employee_primary(login.UserLoginRequest(username=global_config.USERNAME, plain_text_password=global_config.PASSWORD))
        if login_resp.auth_token:
            auth_token = login_resp.auth_token
            log.info(f"Successfully logged in...")
    
    
async def login_to_api_task(app: web.Application):
    """
    Background task to perform the login periodically, matching the Go code.
    This runs indefinitely after server startup.
    """
    log.info("Starting recurring API login task...")
    
    # Perform initial login immediately
    await perform_login()

    while True:
        try:
            log.info(f"Waiting {LOGIN_INTERVAL_SECONDS} seconds until next login.")
            await asyncio.sleep(LOGIN_INTERVAL_SECONDS)
            await perform_login()
        except asyncio.CancelledError:
            log.info("API login task cancelled.")
            break
        except Exception as e:
            log.error(f"Error in API login task: {e}")
            await asyncio.sleep(60) # Wait a minute before retrying

# --- HTML & Cache Busting Logic ---

def replace_bundle_caches(page: str) -> str:
    """Implements the cache-busting logic by appending a version number."""
    # Use current timestamp for cache busting version (YYYYMMDDhhmmss format)
    version = datetime.now().strftime("%Y%m%d%H%M%S") 

    log.debug(f"Applying cache-busting version: {version}")

    # Asset paths to replace
    script_preload_old = f'<link rel="preload" as="script" href="{enclave_prefix}/resources/dist/js/bundle.src.min.js">'
    script_preload_new = f'<link rel="preload" as="script" href="{enclave_prefix}/resources/dist/js/bundle.src.min.js?v={version}">'
    
    script_src_old = f'<script src="{enclave_prefix}/resources/dist/js/bundle.src.min.js"></script>'
    script_src_new = f'<script src="{enclave_prefix}/resources/dist/js/bundle.src.min.js?v={version}"></script>'
    
    style_link_old = f'<link rel="stylesheet" href="{enclave_prefix}/resources/dist/css/bundle.css">'
    style_link_new = f'<link rel="stylesheet" href="{enclave_prefix}/resources/dist/css/bundle.css?v={version}">'

    # Replacement execution
    page = page.replace(script_preload_old, script_preload_new)
    page = page.replace(script_src_old, script_src_new)
    page = page.replace(style_link_old, style_link_new)

    return page


async def get_index_page() -> str:
    """Reads index.html, using the cache if in production."""
    global index_page_cache
    
    if production and index_page_cache:
        return index_page_cache
    
    try:
        # For simplicity, we use a direct read as it is only done once in production.
        with open(INDEX_HTML_FILE, 'r') as f:
            content = f.read()
            
        if production:
            index_page_cache = content
            
        return content
            
    except FileNotFoundError:
        log.error(f"Error: {INDEX_HTML_FILE} not found.")
        return "Index page not found."
    except Exception as e:
        log.error(f"Error reading {INDEX_HTML_FILE}: {e}")
        return "Error reading index page."

# --- Request Handlers ---

async def index_handler(request: web.Request):
    """
    The single handler for all root/SPA UI routes (e.g., /enclave/name/ui, /enclave/name/ui/path).
    Serves the cache-busted index.html.
    """
    
    index_content = await get_index_page()

    if index_content.startswith("Error") or index_content.startswith("Index page not found"):
        return web.Response(text=index_content, status=500, content_type='text/plain')
        
    page_with_cache = replace_bundle_caches(index_content)
    
    return web.Response(text=page_with_cache, status=200, content_type='text/html')


async def health_check_handler(request: web.Request):
    return web.json_response({"status": "OK"}, status=200)


async def random_api_handler(request: web.Request):
    """Handles the /api/random endpoint."""
    # Generate a random float between 0.0 and 1.0 (like Math.random())
    random_number = random.random()
    return web.json_response({"random": random_number}, status=200)

async def no_route_handler(request: web.Request):
    """Handles all unmatched routes and redirects them to the UI path."""
    ui_path = f"{enclave_prefix}/ui"
    log.info(f"No route found for {request.path}. Redirecting to {ui_path}")
    raise web.HTTPTemporaryRedirect(location=ui_path)

# --- Background Task Management ---

async def start_background_tasks(app: web.Application):
    """Starts the recurring login task and stores the reference."""
    # Create the task and immediately schedule it, storing the task object
    task = asyncio.create_task(login_to_api_task(app))
    app['login_task'] = task

async def cleanup_background_tasks(app: web.Application):
    """Cancels the recurring login task on application shutdown."""
    task = app.get('login_task')
    if task:
        log.info("Cancelling API login task...")
        task.cancel()
        # Wait for the task to finish, ignoring the expected CancelledError
        await asyncio.gather(task, return_exceptions=True)
        log.info("API login task cancelled successfully.")


# --- Main Application Setup ---

def create_app() -> web.Application:
    """Sets up the aiohttp application with all routes."""
    
    load_config()
    
    # Initialize aiohttp application
    app = web.Application()

    # --- 1. Register Static Routes ---
    static_route_path = f"{enclave_prefix}/resources/dist"
    app.router.add_static(static_route_path, "resources/dist", name="static_resources")
    # log.info(f"Static route registered: {static_route_path} -> resources/dist")

    # --- 2. Health Checks ---
    app.router.add_get(f"{enclave_prefix}/health/startup", health_check_handler)
    app.router.add_get(f"{enclave_prefix}/health/liveliness", health_check_handler)
    app.router.add_get(f"{enclave_prefix}/health/readiness", health_check_handler)
    
    # --- 3. API Endpoint ---
    app.router.add_get(f"{enclave_prefix}/api/random", random_api_handler)
    
    # --- 4. Index Page / SPA Routes ---
    ui_path_root = f"{enclave_prefix}/ui"
    ui_path_spa = f"{enclave_prefix}/ui/{{tail:.*}}"
    
    app.router.add_get(ui_path_root, index_handler)
    app.router.add_get(ui_path_spa, index_handler)
    # log.info(f"UI/SPA routes registered: {ui_path_root} and {ui_path_spa}")

    # --- 5. Not Found Handler (NoRoute replacement) ---
    app.router.add_route('*', '/{tail:.*}', no_route_handler)
    
    # --- 6. Start/Stop the recurring login task ---
    # Use explicit handlers to manage the task's full lifecycle
    app.on_startup.append(start_background_tasks)
    app.on_cleanup.append(cleanup_background_tasks)
    
    return app

# --- Main Entry Point ---

if __name__ == '__main__':
    # Start the application
    app = create_app()
    address = f"0.0.0.0:{global_config.PORT}"
    log.info(f"Server listening on address {address} with Production: {production}")
    
    try:
        web.run_app(app, host='0.0.0.0', port=global_config.PORT)
    except Exception as e:
        log.critical(f"Server failed to start: {e}")
        sys.exit(1)