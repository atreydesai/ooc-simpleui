# OOC Simple UI

A Flask-based web application for analyzing and managing Out-of-Context (OOC) video content with evidence verification capabilities. 

## Features

### Core Features
- **Video Metadata Extraction**: Automatically fetch video information using yt-dlp
- **Video Download**: Download social media videos (with duration limits of under 10 minutes)
- **Evidence Verification**: Comprehensive 11-point checklist system for evaluating evidence quality
- **OOC Qualification**: Detailed 10-point checklist for identifying out-of-context content

### Other Features
- **Auto-Save**: Changes are automatically saved as you work (1-second debounce)
- **Visual Save Indicator**: Real-time save status with color-coded badges (Saving/Saved/Error)
- **Undo/Redo**: Full history tracking with keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y)
- **Search & Filter**: Search by text and filter by platform/rating

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
   pip install Flask requests beautifulsoup4 yt-dlp pytest
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
6. **Auto-Save**: Data is automatically saved as you work (watch the save indicator)

### New Features

#### Auto-Save
- Changes save automatically 1 second after your last edit
- Visual indicator shows save status (Saving → Saved ✓)
- No manual save button needed

#### Undo/Redo
- **Ctrl/Cmd+Z**: Undo last change
- **Ctrl/Cmd+Y** or **Ctrl/Cmd+Shift+Z**: Redo
- History counter shows your position
- Up to 50 undo states maintained

#### Search & Filter
- **Search**: Find entries by URL, headline, or any text
- **Filter by Platform**: Show only specific social media platforms
- **Filter by Rating**: Show only specific rating categories
- **Clear Filters**: Reset all filters with one click
- Result counter shows filtered vs. total entries

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
├── app.py                 # Main Flask application (with type hints)
├── test_app.py           # Comprehensive test suite
├── data.json             # Data storage (auto-created)
├── requirements.txt      # Python dependencies
├── downloads/            # Video download directory (auto-created)
├── static/
│   ├── style.css        # Custom CSS with animations
│   └── script.js        # Modular JavaScript (JSDoc annotated)
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

### Running Tests
```bash
# Run all tests
pytest test_app.py -v

# Run specific test class
pytest test_app.py::TestSocialPlatformParsing -v

# Run with coverage
pytest test_app.py --cov=app
```

### Running in Debug Mode
The application runs in debug mode by default, which provides:
- Automatic reloading on code changes
- Detailed error messages
- Development server features

### Code Organization
The JavaScript is organized into modules:
- **State Management**: Centralized state handling
- **UI Module**: Visual updates and indicators
- **API Module**: Backend communication
- **History Module**: Undo/redo functionality
- **Search/Filter Module**: Search and filtering logic
- **Auto-Save Module**: Debounced save operations
- **Data Management**: Form data collection
- **Entry Builder**: HTML generation
- **Helpers**: Utility functions
- **Event Handlers**: User interaction handling

### Adding New Features
1. **Backend**: Modify `app.py` with type hints
2. **Frontend UI**: Update `templates/index.html`
3. **Styling**: Add styles in `static/style.css`
4. **Logic**: Add JavaScript in appropriate module in `static/script.js`
5. **Tests**: Add tests in `test_app.py`

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the application logs in the terminal
3. Ensure all dependencies are properly installed
