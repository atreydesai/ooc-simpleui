import os
import json
import subprocess
import sys
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from urllib.parse import urlparse

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Needed for flashing messages

DATA_FILE = 'data.json'
DOWNLOAD_DIR = 'downloads'

# --- Helper Functions ---

def load_data():
    """Loads data from the JSON file."""
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            # Handle empty file case
            content = f.read()
            if not content:
                return []
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"Error loading data file: {e}")
        return [] # Return empty list on error

def save_data(data):
    """Saves data to the JSON file."""
    try:
        # Ensure IDs are sequential starting from 0
        for i, item in enumerate(data):
            item['id'] = i

        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
    except IOError as e:
        print(f"Error saving data file: {e}")
        return False
    except Exception as e:
        print(f"An unexpected error occurred during save: {e}")
        return False


def parse_social_platform(url_string):
    """Extracts a simplified platform name from a URL."""
    if not url_string:
        return ""
    try:
        parsed_url = urlparse(url_string)
        hostname = parsed_url.hostname.lower() if parsed_url.hostname else ''

        # Remove www.
        if hostname.startswith('www.'):
            hostname = hostname[4:]

        # Specific platform checks (including common shorteners)
        if 'x.com' in hostname or 'twitter.com' in hostname or 't.co' in hostname:
            return 'x' # or 'twitter'
        if 'facebook.com' in hostname or 'fb.me' in hostname or 'fb.watch' in hostname:
            return 'facebook'
        if 'instagram.com' in hostname or 'instagr.am' in hostname:
            return 'instagram'
        if 'youtube.com' in hostname or 'youtu.be' in hostname:
            return 'youtube'
        if 'tiktok.com' in hostname:
            return 'tiktok'
        if 'linkedin.com' in hostname:
            return 'linkedin'
        if 'reddit.com' in hostname:
             return 'reddit'
        # Add more platforms as needed

        # General case: return domain name without TLD
        parts = hostname.split('.')
        if len(parts) > 1:
            return parts[-2] # e.g., 'google' from 'google.com'
        elif len(parts) == 1:
            return parts[0] # e.g., 'localhost'
        else:
            return "" # Should not happen with valid URLs

    except ValueError:
        # Handle invalid URLs if urlparse fails
        return ""
    except Exception as e:
        print(f"Error parsing URL {url_string}: {e}")
        return ""


def download_video_yt_dlp(video_url, item_id):
    """Downloads video using yt-dlp command line."""
    if not os.path.exists(DOWNLOAD_DIR):
        os.makedirs(DOWNLOAD_DIR)

    output_template = os.path.join(DOWNLOAD_DIR, f"video_{item_id}.%(ext)s")
    # -f: Prefer mp4, fallback to best video+audio, then best single file.
    # --merge-output-format mp4: Ensure the final merged file (if any) is mp4
    # --force-keyframes-at-cuts: Sometimes helps with seeking issues after download
    # --retries infinite: Keep trying on network errors (optional)
    # --fragment-retries infinite: Keep trying on fragment errors (optional)
    # --ignore-config: Avoid user's global yt-dlp config issues
    command = [
        sys.executable, '-m', 'yt_dlp', # Use python -m yt_dlp to ensure correct env
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '--force-keyframes-at-cuts',
        # '--retries', 'infinite', # Uncomment if persistent retries are desired
        # '--fragment-retries', 'infinite', # Uncomment if persistent retries are desired
        '--ignore-config', # Recommended for programmatic use
        '-o', output_template,
        video_url
    ]

    print(f"Executing command: {' '.join(command)}") # For debugging

    try:
        # Run the command
        process = subprocess.run(command, capture_output=True, text=True, check=False, encoding='utf-8') # check=False to handle errors manually

        # Determine the actual output filename (yt-dlp might adjust extension)
        # We expect it to be video_{id}.mp4 due to --merge-output-format mp4
        expected_final_path = os.path.abspath(os.path.join(DOWNLOAD_DIR, f"video_{item_id}.mp4"))
        actual_path = None
        download_successful = False

        if os.path.exists(expected_final_path):
             actual_path = expected_final_path
             # Check process return code *after* confirming file existence
             if process.returncode == 0:
                download_successful = True
             else:
                # File exists, but yt-dlp reported an error - potentially incomplete?
                 print(f"yt-dlp process exited with code {process.returncode} but file exists.")
                # Keep download_successful=False based on return code
         # Optional: Search for other possible extensions if mp4 merge failed but *some* file was downloaded
        # else:
        #    for filename in os.listdir(DOWNLOAD_DIR):
        #        if filename.startswith(f"video_{item_id}."):
        #             actual_path = os.path.abspath(os.path.join(DOWNLOAD_DIR, filename))
        #             # Consider this success only if return code was 0, otherwise it's likely an error remnant
        #             if process.returncode == 0:
        #                  download_successful = True
        #             break


        # Prepare result message
        if download_successful:
            message = f"Download successful. Output: {process.stdout[:200]}" # Limit output length
            if process.stderr:
                 message += f"\nWarnings/Errors: {process.stderr[:200]}"
            print(f"Download Success: {actual_path}")
        else:
            message = f"Download failed (Code: {process.returncode}). Error: {process.stderr}"
            if process.stdout: # Include stdout even on failure, might contain useful info
                message += f"\nOutput: {process.stdout[:200]}"
            print(f"Download Failed. Stderr: {process.stderr}")
            # Clean up potentially incomplete file if it exists but download failed
            if actual_path and not download_successful and os.path.exists(actual_path):
                try:
                     os.remove(actual_path)
                     print(f"Removed potentially incomplete file: {actual_path}")
                     actual_path = None # Clear path as it's no longer valid
                except OSError as remove_err:
                     print(f"Could not remove incomplete file {actual_path}: {remove_err}")


        return {
            "success": download_successful,
            "message": message.strip(),
            "drive_path": actual_path if download_successful else ""
        }

    except FileNotFoundError:
        # This happens if yt-dlp is not installed or not in PATH/env
        msg = "Error: 'yt-dlp' command not found. Is it installed and in your PATH?"
        print(msg)
        return {"success": False, "message": msg, "drive_path": ""}
    except Exception as e:
        msg = f"An unexpected error occurred during download: {e}"
        print(msg)
        return {"success": False, "message": msg, "drive_path": ""}

# --- Flask Routes ---

@app.route('/')
def index():
    """Displays the main data entry page."""
    current_data = load_data()
    return render_template('index.html', data=current_data)

@app.route('/save', methods=['POST'])
def save():
    """Saves the data received as JSON."""
    try:
        data_to_save = request.get_json()
        if not isinstance(data_to_save, list):
             return jsonify({"error": "Invalid data format: Expected a list."}), 400

        # Optional: Add validation for each item's structure here

        if save_data(data_to_save):
            return jsonify({"message": "Data saved successfully."}), 200
        else:
            return jsonify({"error": "Failed to write data to file."}), 500
    except Exception as e:
        print(f"Error in /save endpoint: {e}")
        return jsonify({"error": f"An internal server error occurred: {e}"}), 500


@app.route('/import', methods=['POST'])
def import_data():
    """Imports data from an uploaded JSON file, overwriting existing data."""
    if 'jsonfile' not in request.files:
        flash('No file part in the request.', 'error')
        return redirect(url_for('index'))

    file = request.files['jsonfile']

    if file.filename == '':
        flash('No file selected for upload.', 'warning')
        return redirect(url_for('index'))

    if file and file.filename.endswith('.json'):
        try:
            # Read content and parse
            content = file.read().decode('utf-8')
            if not content:
                 flash('Import failed: Uploaded file is empty.', 'error')
                 return redirect(url_for('index'))

            new_data = json.loads(content)

            # Basic validation: check if it's a list
            if not isinstance(new_data, list):
                 flash('Import failed: JSON file does not contain a list.', 'error')
                 return redirect(url_for('index'))

            # Optional: More thorough validation of the structure of items within the list

            # Overwrite the existing data file
            if save_data(new_data):
                flash('Data imported successfully!', 'success')
            else:
                 flash('Import failed: Could not save the new data.', 'error')

        except json.JSONDecodeError:
            flash('Import failed: Invalid JSON format in the uploaded file.', 'error')
        except Exception as e:
            flash(f'An unexpected error occurred during import: {e}', 'error')
            print(f"Import Error: {e}")

        return redirect(url_for('index'))
    else:
        flash('Invalid file type. Please upload a .json file.', 'error')
        return redirect(url_for('index'))

@app.route('/download_video', methods=['POST'])
def handle_download_request():
    """Handles the AJAX request to download a video."""
    data = request.get_json()
    url = data.get('url')
    item_id = data.get('id')

    if not url or item_id is None: # Check for None specifically for id 0
        return jsonify({"error": "Missing 'url' or 'id' in request."}), 400

    try:
        item_id = int(item_id) # Ensure ID is an integer
    except ValueError:
         return jsonify({"error": "Invalid 'id' format."}), 400


    result = download_video_yt_dlp(url, item_id)

    if result["success"]:
        return jsonify(result), 200
    else:
        # Provide the specific error message from the download function
        return jsonify({"error": result["message"]}), 500


# --- Main Execution ---
if __name__ == '__main__':
    if not os.path.exists(DOWNLOAD_DIR):
        os.makedirs(DOWNLOAD_DIR)
        print(f"Created download directory: {DOWNLOAD_DIR}")
    app.run(debug=True, host='127.0.0.1', port=5000) # Runs on http://127.0.0.1:5000/