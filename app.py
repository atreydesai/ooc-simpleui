import os
import json
import subprocess
import sys
from typing import Dict, List, Any, Tuple, Optional
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from urllib.parse import urlparse
import logging
import shlex

import requests
from bs4 import BeautifulSoup
import re

# Selenium imports for AFP (optional - will fallback gracefully if not installed)
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.common.by import By
    from selenium.common.exceptions import TimeoutException, WebDriverException
    from webdriver_manager.chrome import ChromeDriverManager
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False
    logging.warning("Selenium not available. AFP link scraping will not work. Install with: pip install selenium webdriver-manager")

app = Flask(__name__)
app.secret_key = os.urandom(24)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Display which Python is being used
print("=" * 80)
print(f"Using Python: {sys.executable}")
print(f"Python Version: {sys.version}")
print(f"Selenium Available: {SELENIUM_AVAILABLE}")
print("=" * 80)

DATA_FILE = 'data.json'
DOWNLOAD_DIR = 'downloads'
MAX_VIDEO_DURATION_SECONDS = 600
BROWSER_FOR_COOKIES = 'chrome'

EVIDENCE_CRITERIA_KEYS = [
    'author_expertise', 'source_reputation', 'neutrality_fairness',
    'fact_vs_opinion', 'purpose', 'definitive_proof', 'direct_connection',
    'source_transparency', 'evidence_integrity', 'fact_verifiability',
    'clarity_relevance'
]


def load_data() -> List[Dict[str, Any]]:
    """
    Loads data from the JSON file.
    
    Returns:
        List[Dict[str, Any]]: List of data entries, empty list if file doesn't exist or error occurs
    """
    if not os.path.exists(DATA_FILE):
        logging.info(f"Data file '{DATA_FILE}' not found, returning empty list.")
        return []
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
            if not content.strip():
                logging.info(f"Data file '{DATA_FILE}' is empty, returning empty list.")
                return []
            data = json.loads(content)
            # Ensure essential keys exist with default values
            for item in data:
                item.setdefault('politifact_headline', '')
                item.setdefault('politifact_subheadline', '')
                item.setdefault('social_platform', '')
                item.setdefault('social_duration', 0.0)
                item.setdefault('social_text', '')
                item.setdefault('download_success', False)
                item.setdefault('download_message', '')
                item.setdefault('drive_path', '')
                item.setdefault('external_links_info', [])
                item.setdefault('ooc_temporal_misattribution', False)
                item.setdefault('ooc_geographical_misattribution', False)
                item.setdefault('ooc_person_misidentification', False)
                item.setdefault('ooc_contextual_misrepresentation', False)
                item.setdefault('ooc_exaggeration_scale', False)
                item.setdefault('ooc_exaggeration_urgency', False)
                item.setdefault('ooc_fabricated_consequences', False)
                item.setdefault('ooc_misleading_intent', False)
                item.setdefault('ooc_misleading_emotional_framing', False)
                item.setdefault('ooc_causal_misattribution', False)

                if isinstance(item.get('external_links_info'), list):
                    for link_info in item['external_links_info']:
                        if isinstance(link_info, dict):
                            link_info.setdefault('url', '')
                            link_info.setdefault('description', '')
                            link_info.setdefault('checklist', {})
                            if isinstance(link_info['checklist'], dict):
                                for key in EVIDENCE_CRITERIA_KEYS:
                                    link_info['checklist'].setdefault(key, False)

            logging.info(f"Successfully loaded {len(data)} items from '{DATA_FILE}'.")
            return data
    except json.JSONDecodeError as e:
        logging.error(f"Error decoding JSON from data file '{DATA_FILE}': {e}")
        return []
    except Exception as e:
        logging.error(f"An unexpected error occurred loading data from '{DATA_FILE}': {e}")
        return []


def save_data(data: List[Dict[str, Any]]) -> bool:
    """
    Saves data to the JSON file, preserving stable IDs.
    
    Args:
        data: List of entry dictionaries to save
        
    Returns:
        bool: True if save successful, False otherwise
    """
    try:
        # Clean up checklist data but preserve IDs
        for i, item in enumerate(data):
            if isinstance(item, dict):
                # Ensure item has an ID - if not, this is a critical error
                if 'id' not in item or item['id'] is None:
                    logging.error(f"Item at index {i} is missing ID field. This should not happen.")
                    return False
                    
                # Clean up external links checklist data
                if isinstance(item.get('external_links_info'), list):
                    for link_info in item['external_links_info']:
                        if isinstance(link_info, dict) and isinstance(link_info.get('checklist'), dict):
                            valid_checklist = {key: link_info['checklist'].get(key, False) for key in EVIDENCE_CRITERIA_KEYS if key in link_info['checklist']}
                            link_info['checklist'] = valid_checklist
            else:
                logging.warning(f"Item at index {i} is not a dictionary ({type(item)}), skipping.")

        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        logging.info(f"Successfully saved {len(data)} items to '{DATA_FILE}'.")
        return True
    except IOError as e:
        logging.error(f"IOError saving data file '{DATA_FILE}': {e}")
        return False
    except TypeError as e:
        logging.error(f"TypeError serializing data to JSON (check data types): {e}")
        return False
    except Exception as e:
        logging.error(f"An unexpected error occurred during save to '{DATA_FILE}': {e}")
        return False


def parse_social_platform(url_string: str) -> str:
    """
    Extracts a simplified platform name from a URL string.
    
    Args:
        url_string: The URL to parse
        
    Returns:
        str: Simplified platform name (e.g., 'x', 'facebook', 'youtube')
    """
    if not url_string: return ""
    try:
        parsed_url = urlparse(url_string)
        hostname = parsed_url.hostname.lower() if parsed_url.hostname else ''
        if hostname.startswith('www.'): hostname = hostname[4:]
        if 'x.com' in hostname or 'twitter.com' in hostname or 't.co' in hostname: return 'x'
        if 'facebook.com' in hostname or 'fb.me' in hostname or 'fb.watch' in hostname: return 'facebook'
        if 'instagram.com' in hostname or 'instagr.am' in hostname: return 'instagram'
        if 'youtube.com' in hostname or 'youtu.be' in hostname: return 'youtube'
        if 'tiktok.com' in hostname: return 'tiktok'
        if 'linkedin.com' in hostname: return 'linkedin'
        if 'reddit.com' in hostname: return 'reddit'
        parts = hostname.split('.')
        if len(parts) > 2 and parts[-2] in ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']: return parts[-3]
        elif len(parts) > 1: return parts[-2]
        elif len(parts) == 1 and parts[0]: return parts[0]
        else: return ""
    except ValueError: return ""
    except Exception as e: logging.error(f"Error parsing URL {url_string} for platform: {e}"); return ""

def get_afp_page_details(url: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Fetches headline and subheadline from AFP URLs using Selenium (to bypass anti-bot protection).
    
    Args:
        url: The AFP URL to fetch page details from
        
    Returns:
        Tuple[Optional[str], Optional[str]]: (headline, subheadline) or (None, None) on error
    """
    if not SELENIUM_AVAILABLE:
        logging.error("Selenium is not installed. Cannot fetch AFP page details.")
        return None, None
    
    try:
        # Set up Chrome options (headless mode)
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        # Initialize Chrome service with automatic ChromeDriver management
        service = Service(ChromeDriverManager().install())
        
        # Initialize driver
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        try:
            logging.info(f"Fetching AFP page with Selenium: {url}")
            driver.get(url)
            
            # Wait for page to load
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.TAG_NAME, "meta"))
                )
            except TimeoutException:
                logging.warning(f"Timeout waiting for AFP page to load: {url}")
            
            # Get page source and parse with BeautifulSoup
            page_source = driver.page_source
            soup = BeautifulSoup(page_source, 'html.parser')
            
            headline, subheadline = None, None
            
            # Try og:title
            og_title = soup.find('meta', property='og:title')
            if og_title and og_title.get('content'):
                headline = og_title['content'].strip()
                logging.info(f"AFP og:title found: {headline[:100]}")
            else:
                # Fallback to title tag
                title_tag = soup.find('title')
                if title_tag:
                    headline = title_tag.get_text(strip=True).replace(" | Fact Check", "").strip()
                    logging.info(f"AFP <title> used: {headline[:100]}")
            
            # Try og:description
            og_desc = soup.find('meta', property='og:description')
            if og_desc and og_desc.get('content'):
                subheadline = og_desc['content'].strip()
                logging.info(f"AFP og:description found: {subheadline[:100]}...")
            else:
                # Fallback to meta description
                meta_desc = soup.find('meta', attrs={'name': 'description'})
                if meta_desc and meta_desc.get('content'):
                    subheadline = meta_desc['content'].strip()
                    logging.info(f"AFP meta description used: {subheadline[:100]}...")
            
            return headline, subheadline
            
        finally:
            driver.quit()
            
    except WebDriverException as e:
        logging.error(f"Selenium WebDriver error for AFP page {url}: {e}")
        return None, None
    except Exception as e:
        logging.error(f"Unexpected error fetching AFP page {url}: {e}", exc_info=True)
        return None, None

def get_page_details(url: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Fetches headline and subheadline from a URL, prioritizing OG tags with fallbacks.
    Routes AFP URLs to Selenium-based scraper due to anti-bot protection.
    
    Args:
        url: The URL to fetch page details from
        
    Returns:
        Tuple[Optional[str], Optional[str]]: (headline, subheadline) or (None, None) on error
    """
    if not url or not url.startswith(('http://', 'https://')):
        logging.warning(f"Invalid URL for page details fetch: {url}")
        return None, None
    
    # Route AFP URLs to Selenium scraper
    if 'factcheck.afp.com' in url or 'factuel.afp.com' in url or 'factual.afp.com' in url:
        logging.info(f"Detected AFP URL, routing to Selenium scraper: {url}")
        return get_afp_page_details(url)
    
    # For non-AFP URLs, use standard requests
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        response = requests.get(url, timeout=15, headers=headers, allow_redirects=True)
        response.raise_for_status()
        
        # Debug: Log response details
        logging.info(f"Response status: {response.status_code}, Final URL: {response.url}, Content-Length: {len(response.content)}")
        
        soup = BeautifulSoup(response.content, 'html.parser')

        headline, subheadline = None, None

        # Try og:title first
        og_title = soup.find('meta', property='og:title')
        logging.info(f"og:title tag found: {og_title is not None}")
        if og_title and og_title.get('content'):
            headline = og_title['content'].strip()
            logging.info(f"og:title content: {headline[:100] if headline else 'empty'}")
        else:
            # Fallback to title tag
            title_tag = soup.find('title')
            if title_tag:
                headline = title_tag.get_text(strip=True).replace(" - The New York Times", "").replace(" | Fact Check", "").strip()
                logging.info(f"Using <title> tag: {headline[:100] if headline else 'empty'}")
            else:
                # Fallback to h1
                h1_tag = soup.find('h1')
                if h1_tag:
                    headline = h1_tag.get_text(strip=True)
                    logging.info(f"Using <h1> tag: {headline[:100] if headline else 'empty'}")

        # Try og:description first
        og_desc = soup.find('meta', property='og:description')
        logging.info(f"og:description tag found: {og_desc is not None}")
        if og_desc and og_desc.get('content'):
            subheadline = og_desc['content'].strip()
            logging.info(f"og:description content: {subheadline[:100] if subheadline else 'empty'}")
        else:
            # Fallback to meta description
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc and meta_desc.get('content'):
                subheadline = meta_desc['content'].strip()
                logging.info(f"Using meta description: {subheadline[:100] if subheadline else 'empty'}")

        logging.info(f"Final result for {response.url}: Headline='{str(headline)[:50]}...', Subheadline='{str(subheadline)[:50]}...'")
        return headline, subheadline

    except requests.exceptions.RequestException as e:
        logging.error(f"Requests error fetching page details for {url}: {e}")
        return None, None
    except Exception as e:
        logging.error(f"Unexpected error getting page details for {url}: {e}", exc_info=True)
        return None, None

def get_video_metadata_yt_dlp(video_url: str) -> Dict[str, Any]:
    """
    Fetches video metadata using yt-dlp and scans description for an article link.
    
    Args:
        video_url: URL of the video to fetch metadata from
        
    Returns:
        Dict[str, Any]: Result dictionary with 'success', 'duration', 'social_text', 'message'
    """
    command = [
        sys.executable, '-m', 'yt_dlp', '-j', '-v', '--no-warnings', '--ignore-config',
        '--cookies-from-browser', BROWSER_FOR_COOKIES, video_url
    ]
    logging.info(f"Fetching metadata command (using browser cookies): {' '.join(shlex.quote(c) for c in command)}")

    try:
        process = subprocess.run(
            command, capture_output=True, text=True, check=False, encoding='utf-8', errors='replace'
        )

        if process.returncode != 0:
            error_suffix = ""
            if "authentication" in process.stderr.lower():
                error_suffix = f" (Tried using cookies from {BROWSER_FOR_COOKIES}. Ensure you're logged in.)"
            error_message = f"yt-dlp metadata fetch failed. Error: {process.stderr or 'Unknown yt-dlp error'}{error_suffix}"
            logging.error(error_message)
            return {"success": False, "message": error_message}

        first_line = process.stdout.strip().splitlines()[0]
        metadata = json.loads(first_line)

        duration = metadata.get('duration')
        title = metadata.get('title')
        description = metadata.get('description')
        social_text_parts = []
        if title: social_text_parts.append(f"Title: {title}")
        if description:
            desc_limit = 1000
            truncated_desc = description[:desc_limit] + ("..." if len(description) > desc_limit else "")
            social_text_parts.append(f"Description: {truncated_desc}")

        social_text = "\n\n".join(social_text_parts) if social_text_parts else "No title or description found."
        if duration is None: duration = 0.0

        return {
            "success": True, "duration": float(duration), "social_text": social_text.strip(),
            "message": "Metadata fetched successfully."
        }

    except (json.JSONDecodeError, IndexError) as e:
        error_message = f"Failed to parse yt-dlp JSON output: {e}. Output: {process.stdout[:500]}"
        logging.error(error_message)
        return {"success": False, "message": error_message}
    except FileNotFoundError:
        msg = "Error: 'yt_dlp' command failed. Is yt-dlp installed and in the system's PATH?"
        logging.critical(msg); return {"success": False, "message": msg}
    except Exception as e:
        msg = f"An unexpected error occurred during metadata fetch: {e}"
        logging.exception(msg); return {"success": False, "message": msg}


def download_video_yt_dlp(video_url: str, item_id: int, rating: str = "") -> Dict[str, Any]:
    """
    Downloads video using yt-dlp, attempting to use cookies from browser.
    
    Args:
        video_url: URL of the video to download
        item_id: ID number for the video file naming
        rating: Rating/label for the video (determines subfolder)
        
    Returns:
        Dict[str, Any]: Result dictionary with 'success', 'message', 'drive_path'
    """
    # Determine subfolder based on rating
    subfolder = ""
    if rating == "Negative Label":
        subfolder = "video_negativelabel"
    elif rating == "Positive Label":
        subfolder = "video_positivelabel"
    
    # Create download directory path
    if subfolder:
        download_path = os.path.join(DOWNLOAD_DIR, subfolder)
    else:
        download_path = DOWNLOAD_DIR
    
    if not os.path.exists(download_path):
        try: os.makedirs(download_path, exist_ok=True); logging.info(f"Created download directory: {download_path}")
        except OSError as e: logging.error(f"Could not create '{download_path}': {e}"); return {"success": False, "message": f"Error creating download directory: {e}", "drive_path": ""}

    output_template = os.path.join(download_path, f"video_{item_id}.%(ext)s")
    
    command = [
        sys.executable, '-m', 'yt_dlp',
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '--force-keyframes-at-cuts', '-v', '--ignore-config', '--no-warnings',
        '--cookies-from-browser', BROWSER_FOR_COOKIES,
        '-o', output_template, video_url
    ]

    logging.info(f"Executing download command for ID {item_id} (using browser cookies): {' '.join(shlex.quote(c) for c in command)}")

    try:
        process = subprocess.run(
            command, capture_output=True, text=True, check=False, encoding='utf-8', errors='replace'
        )
        actual_path, download_successful, message = None, False, ""

        if process.returncode == 0:
            for filename in os.listdir(download_path):
                if filename.startswith(f"video_{item_id}.") and not filename.endswith((".part", ".ytdl")):
                    actual_path = os.path.abspath(os.path.join(download_path, filename))
                    download_successful = True
                    message = f"Download successful ({filename})."
                    logging.info(f"Download Success (ID: {item_id}): {actual_path}")
                    break
            if not download_successful:
                message = f"Download process finished but no final output file found for ID {item_id}."
                logging.warning(message)
        else:
            error_suffix = ""
            if "authentication" in process.stderr.lower():
                 error_suffix = f" (Tried using cookies from {BROWSER_FOR_COOKIES}. Ensure you're logged in.)"
            message = f"Download failed. Error: {process.stderr or 'Unknown yt-dlp error'}{error_suffix}"
            logging.error(f"Download Failed (ID: {item_id}): {message}")
            try:
                for filename in os.listdir(download_path):
                    if filename.startswith(f"video_{item_id}."): os.remove(os.path.join(download_path, filename))
            except Exception as e_clean:
                 logging.warning(f"Error during cleanup of failed download for ID {item_id}: {e_clean}")

        return {"success": download_successful, "message": message.strip(), "drive_path": actual_path or ""}

    except FileNotFoundError:
        msg = "Error: 'yt_dlp' command failed. Is yt-dlp installed and in the system's PATH?"
        logging.critical(msg); return {"success": False, "message": msg, "drive_path": ""}
    except Exception as e:
        msg = f"An unexpected error occurred during download process: {e}"
        logging.exception(msg); return {"success": False, "message": msg, "drive_path": ""}


@app.route('/')
def index():
    current_data = load_data()
    return render_template('index.html', data=current_data)

@app.route('/save', methods=['POST'])
def save():
    if not request.is_json: return jsonify({"error": "Request must be JSON."}), 415
    try:
        data_to_save = request.get_json()
        if not isinstance(data_to_save, list): return jsonify({"error": "Invalid data format: Expected list."}), 400
        if save_data(data_to_save): return jsonify({"message": "Data saved successfully."}), 200
        else: return jsonify({"error": "Failed to write data to file."}), 500
    except Exception as e: logging.exception(f"Error processing /save: {e}"); return jsonify({"error": "Internal server error."}), 500

@app.route('/import', methods=['POST'])
def import_data():
    if 'jsonfile' not in request.files: flash('No file part.', 'danger'); return redirect(url_for('index'))
    file = request.files['jsonfile']
    if file.filename == '': flash('No selected file.', 'warning'); return redirect(url_for('index'))
    if file and file.filename.lower().endswith('.json'):
        try:
            new_data = json.load(file.stream) # More direct way to load
            if not isinstance(new_data, list): flash('Import failed: JSON not a list.', 'danger'); return redirect(url_for('index'))
            if save_data(new_data): flash(f'Data ({len(new_data)} items) imported!', 'success')
            else: flash('Import failed: Could not save data.', 'danger')
        except json.JSONDecodeError as e: flash(f'Import error: Invalid JSON format - {e}', 'danger')
        except Exception as e: flash(f'Import error: {e}', 'danger')
        return redirect(url_for('index'))
    else: flash('Invalid file type (must be .json).', 'warning'); return redirect(url_for('index'))


@app.route('/get_page_details', methods=['POST'])
def handle_page_details_request():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON."}), 415
    data = request.get_json()
    url = data.get('url')
    if not url:
        return jsonify({"error": "Missing 'url' parameter."}), 400

    logging.info(f"Fetching page details for URL: {url}")
    headline, subheadline = get_page_details(url)

    return jsonify({
        "headline": headline if headline is not None else "",
        "subheadline": subheadline if subheadline is not None else ""
    }), 200


@app.route('/get_video_metadata', methods=['POST'])
def handle_metadata_request():
    if not request.is_json: return jsonify({"error": "Request must be JSON."}), 415
    data = request.get_json()
    url = data.get('url')
    if not url: return jsonify({"error": "Missing 'url'."}), 400

    result = get_video_metadata_yt_dlp(url)

    if result["success"] and result.get("duration") is not None:
        duration = result["duration"]
        if duration > MAX_VIDEO_DURATION_SECONDS:
            result["success"] = False
            result["message"] = f"Video duration ({duration:.1f}s) exceeds limit ({MAX_VIDEO_DURATION_SECONDS}s). Download aborted."
            logging.info(f"Video rejected (duration): {duration}s > {MAX_VIDEO_DURATION_SECONDS}s for URL: {url}")
            return jsonify(result), 200

    if result["success"]: return jsonify(result), 200
    else:
        status_code = 400 if "invalid url" in result.get("message", "").lower() else 500
        return jsonify({"error": result.get("message", "Unknown metadata error"), "success": False}), status_code

@app.route('/download_video', methods=['POST'])
def handle_download_request():
    if not request.is_json: return jsonify({"error": "Request must be JSON."}), 415
    data = request.get_json()
    url, item_id_str, rating = data.get('url'), data.get('id'), data.get('rating', '')
    if not url or item_id_str is None: return jsonify({"error": "Missing 'url' or 'id'."}), 400
    try: item_id = int(item_id_str)
    except (ValueError, TypeError): return jsonify({"error": f"Invalid 'id': '{item_id_str}'."}), 400

    result = download_video_yt_dlp(url, item_id, rating)

    if result["success"]: return jsonify(result), 200
    else:
        status_code = 400 if "invalid url" in result.get("message", "").lower() else 500
        return jsonify({"error": result.get("message", "Unknown download error"), "success": False}), status_code

@app.route('/delete_video', methods=['POST'])
def handle_delete_video():
    """Deletes video file associated with an entry ID."""
    if not request.is_json: return jsonify({"error": "Request must be JSON."}), 415
    data = request.get_json()
    item_id_str = data.get('id')
    if item_id_str is None: return jsonify({"error": "Missing 'id'."}), 400
    try: item_id = int(item_id_str)
    except (ValueError, TypeError): return jsonify({"error": f"Invalid 'id': '{item_id_str}'."}), 400

    try:
        deleted_files = []
        if os.path.exists(DOWNLOAD_DIR):
            for filename in os.listdir(DOWNLOAD_DIR):
                if filename.startswith(f"video_{item_id}.") and not filename.endswith((".part", ".ytdl")):
                    filepath = os.path.join(DOWNLOAD_DIR, filename)
                    os.remove(filepath)
                    deleted_files.append(filename)
                    logging.info(f"Deleted video file: {filepath}")
        
        if deleted_files:
            return jsonify({"success": True, "message": f"Deleted {len(deleted_files)} file(s)", "files": deleted_files}), 200
        else:
            return jsonify({"success": True, "message": "No video files found for this ID"}), 200
    except Exception as e:
        logging.error(f"Error deleting video for ID {item_id}: {e}")
        return jsonify({"error": f"Error deleting video: {str(e)}", "success": False}), 500


# --- Main Execution Guard ---
if __name__ == '__main__':
    # Ensure directories/files exist
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f: json.dump([], f)
        logging.info(f"Created empty data file: '{DATA_FILE}'")

    logging.info("*"*60)
    logging.info(f"Attempting to use cookies from browser: '{BROWSER_FOR_COOKIES}'")
    logging.info(f"Ensure you are logged into relevant sites (like X/Twitter) in {BROWSER_FOR_COOKIES}")
    logging.info("on the machine running this script for protected content access.")
    logging.info("*"*60)
    logging.info("Ensure dependencies are installed: pip install Flask requests beautifulsoup4 yt-dlp")

    app.run(debug=True, host='127.0.0.1', port=5001)