# OOC Simple UI

A Flask-based web application for analyzing and managing Out-of-Context (OOC) video content with evidence verification capabilities. The application supports both PolitiFact and New York Times modes for fact-checking workflows.

## Features

- **Dual Mode Operation**: Switch between PolitiFact and New York Times analysis modes
- **Video Metadata Extraction**: Automatically fetch video information using yt-dlp
- **Video Download**: Download social media videos (with duration limits)
- **Evidence Verification**: Comprehensive checklist system for evaluating evidence quality
- **OOC Qualification**: Detailed checklist for identifying out-of-context content
- **Data Management**: Import/export JSON data, persistent storage

## Prerequisites

- Python 3.7 or higher
- pip (Python package installer)
- yt-dlp (for video metadata and downloads)
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Installation

1. **Clone or download the repository**
   ```bash
   git clone <repository-url>
   cd ooc-simpleui
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

   Or install manually:
   ```bash
   pip install Flask requests beautifulsoup4 yt-dlp
   ```

3. **Install yt-dlp (if not already installed)**
   ```bash
   pip install yt-dlp
   ```

## Running the Application

1. **Start the Flask application**
   ```bash
   python app.py
   ```

2. **Access the web interface**
   - Open your web browser
   - Navigate to: `http://127.0.0.1:5000` or `http://localhost:5000`

3. **The application will:**
   - Create necessary directories (`downloads/`)
   - Initialize data storage (`data.json`)
   - Start the web server on port 5000

## Usage

### Basic Workflow

1. **Add New Entry**: Click "Add New Entry" to create a new analysis record
2. **Enter URLs**: 
   - Add PolitiFact URL (for fact-checking context)
   - Add Social Link (video URL to analyze)
3. **Fetch Metadata**: Click "Download" to automatically extract video information
4. **Complete OOC Checklist**: Mark relevant out-of-context criteria
5. **Add Evidence**: Include external links with evidence verification checklists
6. **Save Data**: Click "Save All Data" to persist your work

### Key Features

- **Mode Toggle**: Switch between PolitiFact and New York Times analysis modes
- **Automatic Data Population**: URLs automatically populate headlines and metadata
- **Video Downloads**: Videos under 10 minutes can be downloaded locally
- **Evidence Verification**: 11-point checklist for evaluating evidence quality
- **OOC Detection**: 10-point checklist for identifying out-of-context content

### Data Management

- **Import Data**: Upload JSON files to restore previous work
- **Export Data**: Data is automatically saved to `data.json`
- **Persistent Storage**: All data persists between application restarts

## Configuration

### Browser Cookies
The application uses browser cookies for accessing protected content:
- Default browser: Chrome
- Ensure you're logged into relevant platforms (X/Twitter, etc.) in Chrome
- Modify `BROWSER_FOR_COOKIES` in `app.py` to use a different browser

### Video Duration Limit
- Default maximum duration: 600 seconds (10 minutes)

## File Structure

```
ooc-simpleui/
├── app.py                 # Main Flask application
├── data.json             # Data storage (auto-created)
├── requirements.txt      # Python dependencies
├── downloads/            # Video download directory (auto-created)
│   ├── video_falselabel/
│   └── video_positivelabel/
├── static/
│   ├── style.css        # Custom CSS styles
│   └── script.js        # JavaScript functionality
└── templates/
    └── index.html       # Main web interface
```

## Troubleshooting

### Common Issues

1. **yt-dlp not found**
   ```bash
   pip install yt-dlp
   ```

2. **Permission errors on downloads**
   - Ensure write permissions in the project directory
   - Check that `downloads/` directory can be created

3. **Video download failures**
   - Verify you're logged into the social platform in Chrome
   - Check that the video URL is accessible
   - Ensure video duration is under 10 minutes

4. **Port already in use**
   - Change the port in `app.py`: `app.run(debug=True, host='127.0.0.1', port=5001)`

### Browser Compatibility
- Chrome (recommended for cookie access)
- Firefox
- Safari
- Edge

## Development

### Running in Debug Mode
The application runs in debug mode by default, which provides:
- Automatic reloading on code changes
- Detailed error messages
- Development server features

### Adding New Features
1. Modify `app.py` for backend functionality
2. Update `templates/index.html` for UI changes
3. Add styles in `static/style.css`
4. Add JavaScript in `static/script.js`

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the application logs in the terminal
3. Ensure all dependencies are properly installed
