import os
import json
import subprocess
import sys
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from urllib.parse import urlparse
import logging
import shlex # For safe command string construction

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

# --- Helper Functions (load_data, save_data, parse_social_platform - Keep as before) ---
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
    expected_final_path = os.path.abspath(os.path.join(DOWNLOAD_DIR, f"video_{item_id}.mp4"))

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

        # Check download outcome (same logic as before)
        if os.path.exists(expected_final_path) and process.returncode == 0:
            actual_path = expected_final_path; download_successful = True
            message = f"Download successful (video_{item_id}.mp4)."
            logging.info(f"Download Success (ID: {item_id}): {actual_path}")
        elif process.returncode == 0:
            found_other_file = False
            try:
                for filename in os.listdir(DOWNLOAD_DIR):
                    if filename.startswith(f"video_{item_id}.") and not filename.endswith((".part", ".ytdl")):
                        potential_path = os.path.abspath(os.path.join(DOWNLOAD_DIR, filename))
                        if os.path.isfile(potential_path):
                            actual_path = potential_path; found_other_file = True; download_successful = True
                            message = f"Download successful (Format: {os.path.basename(actual_path)})."
                            logging.info(f"Download Success (ID: {item_id}, Format: {os.path.basename(actual_path)}): {actual_path}")
                            break
            except FileNotFoundError: pass
            if not found_other_file:
                message = f"Download process finished (Code: 0) but no output file found for ID {item_id}."
                logging.warning(f"Download Issue (ID: {item_id}): {message} STDERR: {process.stderr}")
        # Handle failures, adding context about browser cookie attempt
        else:
            error_suffix = ""
            if "authentication" in process.stderr.lower():
                 error_suffix = f" (Tried using cookies from {BROWSER_FOR_COOKIES}. Ensure you're logged in there and yt-dlp has access.)"

            message = f"Download failed (Code: {process.returncode}). Error: {process.stderr or 'Unknown yt-dlp error'}{error_suffix}"
            logging.error(f"Download Failed (ID: {item_id}). Code: {process.returncode}. Stderr: {process.stderr}")
            if os.path.exists(expected_final_path):
                try: os.remove(expected_final_path); logging.info(f"Removed potentially incomplete file: {expected_final_path}")
                except OSError as e: logging.warning(f"Could not remove incomplete file {expected_final_path}: {e}")

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


# --- Flask Routes (index, save, import - Keep as before) ---
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
            content = file.read().decode('utf-8')
            if not content.strip(): flash('Import failed: File is empty.', 'danger'); return redirect(url_for('index'))
            new_data = json.loads(content)
            if not isinstance(new_data, list): flash('Import failed: JSON not a list.', 'danger'); return redirect(url_for('index'))
            if save_data(new_data): flash(f'Data ({len(new_data)} items) imported!', 'success')
            else: flash('Import failed: Could not save data.', 'danger')
        except Exception as e: flash(f'Import error: {e}', 'danger'); logging.exception(f"Import Error: {e}")
        return redirect(url_for('index'))
    else: flash('Invalid file type (must be .json).', 'warning'); return redirect(url_for('index'))


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
    else: status_code = 500; return jsonify({"error": result.get("message", "Unknown metadata error")}), status_code

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
    else: status_code = 500; return jsonify({"error": result.get("message", "Unknown download error")}), status_code


# --- Main Execution Guard ---
if __name__ == '__main__':
    if not os.path.exists(DOWNLOAD_DIR):
        try: os.makedirs(DOWNLOAD_DIR); logging.info(f"Created download directory: {DOWNLOAD_DIR}")
        except OSError as e: logging.critical(f"FATAL: Cannot create '{DOWNLOAD_DIR}': {e}"); sys.exit(1)
    # Add instructions for the user about cookies
    logging.info("*"*60)
    logging.info(f"Attempting to use cookies from browser: '{BROWSER_FOR_COOKIES}'")
    logging.info(f"Ensure you are logged into relevant sites (like X/Twitter) in {BROWSER_FOR_COOKIES}")
    logging.info("on the machine running this script for protected content access.")
    logging.info("If this fails, consider exporting cookies to a file instead (Approach 1).")
    logging.info("See yt-dlp documentation for '--cookies-from-browser' compatibility.")
    logging.info("*"*60)
    app.run(debug=True, host='127.0.0.1', port=5000)