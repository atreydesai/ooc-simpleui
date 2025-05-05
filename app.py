# /ooc-simpleui/app.py
import os
import json
import subprocess
import sys
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from urllib.parse import urlparse
import logging
import shlex # For safe command string construction

# +++ Add these imports +++
import requests
from bs4 import BeautifulSoup
# +++++++++++++++++++++++++

# --- Flask App Setup ---
app = Flask(__name__)
app.secret_key = os.urandom(24)

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Constants ---
DATA_FILE = 'data.json'
DOWNLOAD_DIR = 'downloads'
MAX_VIDEO_DURATION_SECONDS = 600
BROWSER_FOR_COOKIES = 'chrome' # Specify the browser to use for cookies

# +++ Evidence Checklist Criteria Keys (for default setting) +++
EVIDENCE_CRITERIA_KEYS = [
    'author_expertise', 'source_reputation', 'neutrality_fairness',
    'fact_vs_opinion', 'purpose', 'definitive_proof', 'direct_connection',
    'source_transparency', 'evidence_integrity', 'fact_verifiability',
    'clarity_relevance'
]
# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


# --- Helper Functions (load_data, save_data, parse_social_platform) ---
def load_data():
    """Loads data from the JSON file."""
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

                # +++ Ensure checklist structure within each link +++
                if isinstance(item.get('external_links_info'), list):
                    for link_info in item['external_links_info']:
                        if isinstance(link_info, dict):
                            link_info.setdefault('url', '')
                            link_info.setdefault('description', '')
                            link_info.setdefault('checklist', {}) # Ensure checklist dict exists
                            if isinstance(link_info['checklist'], dict):
                                for key in EVIDENCE_CRITERIA_KEYS:
                                    link_info['checklist'].setdefault(key, False)
                # ++++++++++++++++++++++++++++++++++++++++++++++++++

            logging.info(f"Successfully loaded {len(data)} items from '{DATA_FILE}'.")
            return data
    except json.JSONDecodeError as e:
        logging.error(f"Error decoding JSON from data file '{DATA_FILE}': {e}")
        return []
    except Exception as e:
        logging.error(f"An unexpected error occurred loading data from '{DATA_FILE}': {e}")
        return []


def save_data(data):
    """Saves data to the JSON file, ensuring sequential IDs."""
    try:
        for i, item in enumerate(data):
            if isinstance(item, dict):
                 item['id'] = i
                 # Optional: Clean/validate link checklist structure before saving
                 if isinstance(item.get('external_links_info'), list):
                     for link_info in item['external_links_info']:
                         if isinstance(link_info, dict) and isinstance(link_info.get('checklist'), dict):
                             # Ensure only valid keys are saved (prevents injection)
                             valid_checklist = {key: link_info['checklist'].get(key, False) for key in EVIDENCE_CRITERIA_KEYS if key in link_info['checklist']}
                             link_info['checklist'] = valid_checklist
                         else:
                              # Handle malformed link data if necessary
                              pass
            else:
                logging.warning(f"Item at index {i} is not a dictionary ({type(item)}), skipping ID assignment.")

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


def parse_social_platform(url_string):
    """Extracts a simplified platform name from a URL string."""
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

# +++ START: Politifact Headline/Subheadline Fetching Helpers +++
def get_headline(url):
    """Fetches the headline (og:title or h1) from a Politifact URL."""
    if not url or not url.startswith(('http://', 'https://')):
        logging.warning(f"Invalid or missing URL for headline fetch: {url}")
        return None
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, timeout=15, headers=headers, allow_redirects=True)
        response.raise_for_status() # Raises HTTPError for bad responses (4xx or 5xx)
        soup = BeautifulSoup(response.content, 'html.parser')

        # Prioritize og:title
        meta_tag = soup.find('meta', property='og:title')
        if meta_tag and meta_tag.get('content'):
            logging.info(f"Found og:title: '{meta_tag['content'][:50]}...' for {url}")
            return meta_tag['content'].strip()

        # Fallback to the main h1 tag
        h1_tag = soup.find('h1')
        if h1_tag:
            # Sometimes h1 contains nested elements, get_text handles this
            headline_text = h1_tag.get_text(strip=True)
            logging.info(f"Found h1: '{headline_text[:50]}...' for {url}")
            return headline_text

        logging.warning(f"Could not find og:title or h1 tag for URL: {url}")
        return None

    except requests.exceptions.Timeout:
        logging.error(f"Timeout error fetching headline for URL: {url}")
        return None
    except requests.exceptions.RequestException as e:
        logging.error(f"Requests error fetching headline for URL {url}: {e}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error getting headline for URL {url}: {e}", exc_info=True)
        return None

def get_subheadline(url):
    """Fetches the subheadline (og:description) from a Politifact URL."""
    if not url or not url.startswith(('http://', 'https://')):
        logging.warning(f"Invalid or missing URL for subheadline fetch: {url}")
        return None
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, timeout=15, headers=headers, allow_redirects=True)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')

        # Look specifically for og:description
        meta_tag = soup.find('meta', property='og:description')
        if meta_tag and meta_tag.get('content'):
            logging.info(f"Found og:description: '{meta_tag['content'][:50]}...' for {url}")
            return meta_tag['content'].strip()

        logging.warning(f"Could not find og:description meta tag for URL: {url}")
        return None

    except requests.exceptions.Timeout:
        logging.error(f"Timeout error fetching subheadline for URL: {url}")
        return None
    except requests.exceptions.RequestException as e:
        logging.error(f"Requests error fetching subheadline for URL {url}: {e}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error getting subheadline for URL {url}: {e}", exc_info=True)
        return None
# +++ END: Politifact Headline/Subheadline Fetching Helpers +++

# --- Helper Function: Get Video Metadata (Using --cookies-from-browser) ---
def get_video_metadata_yt_dlp(video_url):
    """Fetches video metadata using yt-dlp, attempting to use cookies from browser."""
    command = [
        sys.executable, '-m', 'yt_dlp',
        '-j',
        '-v',
        '--no-warnings',
        '--ignore-config',
        # Add cookies-from-browser argument
        '--cookies-from-browser', BROWSER_FOR_COOKIES
    ]
    # Add profile if needed (e.g., '--profile', 'Profile 1') - Often not needed for default profile
    # command.extend(['--profile', 'Default']) # Example: If default profile isn't being picked up

    command.append(video_url) # Add URL last

    logging.info(f"Fetching metadata command (using browser cookies): {' '.join(shlex.quote(c) for c in command)}")

    try:
        process = subprocess.run(
            command, capture_output=True, text=True, check=False, encoding='utf-8', errors='replace'
        )

        if process.returncode != 0:
            error_suffix = ""
            # Add specific suffix if authentication error occurs with browser attempt
            if "authentication" in process.stderr.lower():
                error_suffix = f" (Tried using cookies from {BROWSER_FOR_COOKIES}. Ensure you're logged in there and yt-dlp has access. Check yt-dlp docs for browser/OS specifics.)"

            error_message = f"yt-dlp metadata fetch failed (Code: {process.returncode}). Error: {process.stderr or 'Unknown yt-dlp error'}{error_suffix}"
            logging.error(error_message)
            return {"success": False, "message": error_message}

        # Process JSON output (same as before)
        try:
            first_line = process.stdout.strip().splitlines()[0]
            metadata = json.loads(first_line)
        except (json.JSONDecodeError, IndexError) as e:
            error_message = f"Failed to parse yt-dlp JSON output: {e}. Output: {process.stdout[:500]}"
            logging.error(error_message)
            return {"success": False, "message": error_message}

        # Extract data (same as before)
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

    except FileNotFoundError:
        msg = f"Error: '{sys.executable} -m yt_dlp' command failed. Is yt-dlp installed?"
        logging.critical(msg); return {"success": False, "message": msg}
    except Exception as e:
        msg = f"An unexpected error occurred during metadata fetch: {e}"
        logging.exception(msg); return {"success": False, "message": msg}


# --- Helper Function: Download Video (Using --cookies-from-browser) ---
def download_video_yt_dlp(video_url, item_id):
    """Downloads video using yt-dlp, attempting to use cookies from browser."""
    if not os.path.exists(DOWNLOAD_DIR):
        try: os.makedirs(DOWNLOAD_DIR); logging.info(f"Created download directory: {DOWNLOAD_DIR}")
        except OSError as e: logging.error(f"Could not create '{DOWNLOAD_DIR}': {e}"); return {"success": False, "message": f"Error creating download directory: {e}", "drive_path": ""}

    output_template = os.path.join(DOWNLOAD_DIR, f"video_{item_id}.%(ext)s")
    # Allow for different extensions, but still aim for mp4
    expected_final_path_base = os.path.join(DOWNLOAD_DIR, f"video_{item_id}")


    command = [
        sys.executable, '-m', 'yt_dlp',
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '--force-keyframes-at-cuts',
        '-v',
        '--ignore-config',
        '--no-warnings',
        # Add cookies-from-browser argument
        '--cookies-from-browser', BROWSER_FOR_COOKIES
    ]
    # Add profile if needed
    # command.extend(['--profile', 'Default'])

    command.extend(['-o', output_template, video_url]) # Output and URL last

    logging.info(f"Executing download command for ID {item_id} (using browser cookies): {' '.join(shlex.quote(c) for c in command)}")

    try:
        process = subprocess.run(
            command, capture_output=True, text=True, check=False, encoding='utf-8', errors='replace'
        )

        actual_path = None
        download_successful = False
        message = ""

        # Improved check for output file, allowing various extensions
        if process.returncode == 0:
            try:
                for filename in os.listdir(DOWNLOAD_DIR):
                    if filename.startswith(f"video_{item_id}.") and not filename.endswith((".part", ".ytdl")):
                        potential_path = os.path.abspath(os.path.join(DOWNLOAD_DIR, filename))
                        if os.path.isfile(potential_path):
                            actual_path = potential_path
                            download_successful = True
                            message = f"Download successful ({filename})."
                            logging.info(f"Download Success (ID: {item_id}): {actual_path}")
                            break # Found the file
            except FileNotFoundError:
                 logging.warning(f"Download directory '{DOWNLOAD_DIR}' not found after download attempt for ID {item_id}.")
                 message = f"Download process finished (Code: 0) but download directory disappeared."
            except Exception as e:
                 logging.error(f"Error checking for downloaded file for ID {item_id}: {e}")
                 message = f"Download process finished (Code: 0) but error occurred checking output: {e}"

            if not download_successful:
                message = f"Download process finished (Code: 0) but no final output file found for ID {item_id}."
                logging.warning(f"Download Issue (ID: {item_id}): {message}. Stdout: {process.stdout[:200]}. Stderr: {process.stderr[:200]}")

        # Handle failures, adding context about browser cookie attempt
        else:
            error_suffix = ""
            if "authentication" in process.stderr.lower():
                 error_suffix = f" (Tried using cookies from {BROWSER_FOR_COOKIES}. Ensure you're logged in there and yt-dlp has access.)"

            message = f"Download failed (Code: {process.returncode}). Error: {process.stderr or 'Unknown yt-dlp error'}{error_suffix}"
            logging.error(f"Download Failed (ID: {item_id}). Code: {process.returncode}. Stderr: {process.stderr}")
            # Try to remove any potentially incomplete file matching the pattern
            try:
                for filename in os.listdir(DOWNLOAD_DIR):
                    if filename.startswith(f"video_{item_id}."):
                        file_to_remove = os.path.join(DOWNLOAD_DIR, filename)
                        try:
                             if os.path.isfile(file_to_remove):
                                 os.remove(file_to_remove)
                                 logging.info(f"Removed potentially incomplete/failed file: {file_to_remove}")
                        except OSError as e_rem:
                             logging.warning(f"Could not remove generated file {file_to_remove}: {e_rem}")
            except FileNotFoundError:
                 pass # Ignore if dir doesn't exist
            except Exception as e_clean:
                 logging.warning(f"Error during cleanup of failed download for ID {item_id}: {e_clean}")


        return {
            "success": download_successful, "message": message.strip(),
            "drive_path": actual_path if download_successful else ""
        }

    except FileNotFoundError:
        msg = f"Error: '{sys.executable} -m yt_dlp' command failed. Is yt-dlp installed?"
        logging.critical(msg); return {"success": False, "message": msg, "drive_path": ""}
    except Exception as e:
        msg = f"An unexpected error occurred during download process: {e}"
        logging.exception(msg); return {"success": False, "message": msg, "drive_path": ""}


# --- Flask Routes (index, save, import) ---
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
        # Basic validation of structure (optional but good)
        for item in data_to_save:
             if not isinstance(item, dict):
                 return jsonify({"error": "Invalid data format: List items must be objects."}), 400
             # Add more checks if needed, e.g., presence of 'id' although we rewrite it
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
            content = file.read().decode('utf-8')
            if not content.strip(): flash('Import failed: File is empty.', 'danger'); return redirect(url_for('index'))
            new_data = json.loads(content)
            if not isinstance(new_data, list): flash('Import failed: JSON not a list.', 'danger'); return redirect(url_for('index'))
            # Data structure validation happens implicitly in load_data/save_data now
            if save_data(new_data): flash(f'Data ({len(new_data)} items) imported!', 'success')
            else: flash('Import failed: Could not save data.', 'danger')
        except json.JSONDecodeError as e:
            flash(f'Import error: Invalid JSON format - {e}', 'danger')
            logging.error(f"Import JSON Decode Error: {e}")
        except Exception as e:
            flash(f'Import error: {e}', 'danger')
            logging.exception(f"Import Error: {e}")
        return redirect(url_for('index'))
    else: flash('Invalid file type (must be .json).', 'warning'); return redirect(url_for('index'))


# +++ START: New Route for Politifact Details +++
@app.route('/get_politifact_details', methods=['POST'])
def handle_politifact_details_request():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON."}), 415
    data = request.get_json()
    url = data.get('url')
    if not url:
        return jsonify({"error": "Missing 'url' parameter."}), 400
    if not url.startswith(('http://', 'https://')):
         return jsonify({"error": "Invalid URL format."}), 400

    logging.info(f"Fetching Politifact details for URL: {url}")
    headline = get_headline(url)
    subheadline = get_subheadline(url)

    # Return empty strings if None was returned by helpers
    return jsonify({
        "headline": headline if headline is not None else "",
        "subheadline": subheadline if subheadline is not None else ""
    }), 200
# +++ END: New Route for Politifact Details +++


# --- Route: Get Video Metadata (Endpoint - Uses browser cookies) ---
@app.route('/get_video_metadata', methods=['POST'])
def handle_metadata_request():
    if not request.is_json: return jsonify({"error": "Request must be JSON."}), 415
    data = request.get_json()
    url = data.get('url')
    if not url: return jsonify({"error": "Missing 'url'."}), 400

    result = get_video_metadata_yt_dlp(url) # Calls the updated helper

    # Check duration limit if metadata fetch itself was successful
    if result["success"] and result.get("duration") is not None:
        duration = result["duration"]
        if duration > MAX_VIDEO_DURATION_SECONDS:
            result["success"] = False # Override success
            result["message"] = f"Video duration ({duration:.1f}s) exceeds limit ({MAX_VIDEO_DURATION_SECONDS}s). Download aborted."
            logging.info(f"Video rejected (duration): {duration}s > {MAX_VIDEO_DURATION_SECONDS}s for URL: {url}")
            return jsonify(result), 200 # Return 200 OK, but success:false in body

    # Return metadata result (could be success or failure from yt-dlp)
    if result["success"]: return jsonify(result), 200
    else:
        # Determine appropriate status code - use 4xx for client errors like bad URL, 5xx for server/yt-dlp issues
        status_code = 400 if "invalid url" in result.get("message", "").lower() else 500
        return jsonify({"error": result.get("message", "Unknown metadata error")}), status_code

# --- Route: Download Video (Endpoint - Uses browser cookies) ---
@app.route('/download_video', methods=['POST'])
def handle_download_request():
    if not request.is_json: return jsonify({"error": "Request must be JSON."}), 415
    data = request.get_json()
    url = data.get('url')
    item_id_str = data.get('id')
    if not url or item_id_str is None: return jsonify({"error": "Missing 'url' or 'id'."}), 400
    try: item_id = int(item_id_str)
    except (ValueError, TypeError): return jsonify({"error": f"Invalid 'id': '{item_id_str}'."}), 400

    result = download_video_yt_dlp(url, item_id) # Calls the updated helper

    if result["success"]: return jsonify(result), 200
    else:
        # Determine appropriate status code
        status_code = 400 if "invalid url" in result.get("message", "").lower() else 500
        return jsonify({"error": result.get("message", "Unknown download error")}), status_code


# --- Main Execution Guard ---
if __name__ == '__main__':
    # Ensure download directory exists
    if not os.path.exists(DOWNLOAD_DIR):
        try: os.makedirs(DOWNLOAD_DIR); logging.info(f"Created download directory: {DOWNLOAD_DIR}")
        except OSError as e: logging.critical(f"FATAL: Cannot create download directory '{DOWNLOAD_DIR}': {e}"); sys.exit(1)

    # Ensure data file exists (create empty if not)
    if not os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump([], f)
            logging.info(f"Created empty data file: '{DATA_FILE}'")
        except IOError as e:
            logging.critical(f"FATAL: Cannot create data file '{DATA_FILE}': {e}"); sys.exit(1)

    # Add instructions for the user about cookies
    logging.info("*"*60)
    logging.info(f"Attempting to use cookies from browser: '{BROWSER_FOR_COOKIES}'")
    logging.info(f"Ensure you are logged into relevant sites (like X/Twitter) in {BROWSER_FOR_COOKIES}")
    logging.info("on the machine running this script for protected content access.")
    logging.info("If this fails, consider exporting cookies to a file instead.")
    logging.info("See yt-dlp documentation for '--cookies-from-browser' compatibility.")
    logging.info("*"*60)

    # Make sure to install dependencies:
    # pip install Flask requests beautifulsoup4 yt-dlp
    logging.info("Ensure dependencies are installed: pip install Flask requests beautifulsoup4 yt-dlp")

    app.run(debug=True, host='127.0.0.1', port=5000)