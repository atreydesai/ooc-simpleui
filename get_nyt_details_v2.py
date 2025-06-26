#!/usr/bin/env python3
"""
A simple, standalone Python script to fetch the headline and subheadline
from a New York Times article URL.

Version 2: This version uses more comprehensive browser headers to avoid
the '403 Forbidden' error that NYT servers often return to simple scripts.

Dependencies:
    - requests
    - beautifulsoup4

Install them using pip:
    pip install requests beautifulsoup4

Usage:
    python get_nyt_details_v2.py <NYT_URL>

Example:
    python get_nyt_details_v2.py "https://www.nytimes.com/2025/06/13/world/asia/lives-lost-india-crash.html"
"""
import sys
import requests
from bs4 import BeautifulSoup
from typing import Tuple, Optional

# --- More realistic browser headers ---
# This is the key to tricking the server into thinking we are a real browser.
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1', # Do Not Track
    'Upgrade-Insecure-Requests': '1',
}

def get_nyt_article_details(url: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Fetches the headline and subheadline from a NYT URL using robust headers.

    Args:
        url: The URL of the New York Times article.

    Returns:
        A tuple containing the (headline, subheadline).
        Either value can be None if not found.
    """
    if not url or not url.startswith(('http://', 'https://')):
        print(f"Error: Invalid URL provided: {url}")
        return None, None

    try:
        # Using a Session object is good practice for managing cookies and headers.
        session = requests.Session()
        session.headers.update(HEADERS)
        
        # Make the request using the session with our new headers.
        # allow_redirects=True is crucial for handling short links like nyti.ms.
        response = session.get(url, timeout=15, allow_redirects=True)
        
        # Raise an exception for bad status codes (like 403, 404, 500)
        response.raise_for_status()
        
        # Parse the HTML content of the page
        soup = BeautifulSoup(response.content, 'html.parser')

        headline, subheadline = None, None

        # --- Find the Headline ---
        # The logic remains the same, as we're now getting the correct HTML.
        og_title_tag = soup.find('meta', property='og:title')
        if og_title_tag and og_title_tag.get('content'):
            headline = og_title_tag['content'].strip()
        else:
            title_tag = soup.find('title')
            if title_tag:
                headline = title_tag.get_text(strip=True).replace(" - The New York Times", "").strip()
            else:
                h1_tag = soup.find('h1')
                if h1_tag:
                    headline = h1_tag.get_text(strip=True)

        # --- Find the Subheadline ---
        og_desc_tag = soup.find('meta', property='og:description')
        if og_desc_tag and og_desc_tag.get('content'):
            subheadline = og_desc_tag['content'].strip()
        else:
            meta_desc_tag = soup.find('meta', attrs={'name': 'description'})
            if meta_desc_tag and meta_desc_tag.get('content'):
                subheadline = meta_desc_tag['content'].strip()

        return headline, subheadline

    except requests.exceptions.RequestException as e:
        print(f"Error: A network or HTTP error occurred: {e}")
        return None, None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None, None

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__.strip())
        sys.exit(1)

    article_url = sys.argv[1]
    
    print(f"Fetching details for: {article_url}\n")
    
    found_headline, found_subheadline = get_nyt_article_details(article_url)
    
    print("--- Results ---")
    if found_headline:
        print(f"Headline:    {found_headline}")
    else:
        print("Headline:    Not found.")

    if found_subheadline:
        print(f"Subheadline: {found_subheadline}")
    else:
        print("Subheadline: Not found.")
    print("---------------")