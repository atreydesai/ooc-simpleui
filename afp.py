"""
AFP Factcheck Link Scraper using Selenium
This script uses a real browser to bypass anti-bot protection
"""
import re
import time
import sys

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException, WebDriverException
except ImportError:
    print("ERROR: Selenium is not installed.")
    print("Please install it with: pip install selenium")
    print("You also need to have Chrome browser installed.")
    sys.exit(1)

def scrape_afp_links():
    """
    Scrapes AFP factcheck pages (0-145) for links matching pattern:
    https://factcheck.afp.com/doc.afp.com.*
    
    Uses Selenium with Chrome to bypass anti-bot protection.
    Writes links to links.txt immediately as they're found.
    """
    base_url = "https://factcheck.afp.com/fact-checking-search-results?search_api_fulltext=video&page="
    output_file = "links.txt"
    
    # Regex pattern to match the target links
    link_pattern = re.compile(r'https://factcheck\.afp\.com/doc\.afp\.com\.[A-Za-z0-9]+')
    
    # Set up Chrome options
    chrome_options = Options()
    chrome_options.add_argument('--headless')  # Run in headless mode (no GUI)
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    chrome_options.add_argument('user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    # Initialize the Chrome driver
    try:
        driver = webdriver.Chrome(options=chrome_options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    except WebDriverException as e:
        print(f"ERROR: Failed to initialize Chrome driver: {e}")
        print("\nMake sure you have Chrome browser installed.")
        print("Selenium will automatically download the appropriate ChromeDriver.")
        sys.exit(1)
    
    total_links_found = 0
    
    try:
        # Open file in append mode to write links immediately
        with open(output_file, 'a') as f:
            for page_num in range(0, 146):  # 0 to 145 inclusive
                try:
                    url = f"{base_url}{page_num}"
                    print(f"Processing page {page_num}... (URL: {url})")
                    
                    # Navigate to the page
                    driver.get(url)
                    
                    # Wait for page to load (wait for any link to appear)
                    try:
                        WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.TAG_NAME, "a"))
                        )
                    except TimeoutException:
                        print(f"  WARNING: Page {page_num} timed out waiting for content")
                    
                    # Get page source
                    page_source = driver.page_source
                    
                    # Find all links matching the pattern
                    links_on_page = set(link_pattern.findall(page_source))
                    
                    # Write links to file immediately
                    if links_on_page:
                        for link in sorted(links_on_page):
                            f.write(link + '\n')
                            f.flush()  # Force write to disk immediately
                            total_links_found += 1
                        print(f"  Found {len(links_on_page)} link(s) on page {page_num}")
                    else:
                        print(f"  No links found on page {page_num}")
                    
                    # Small delay between requests
                    time.sleep(1)
                    
                except Exception as e:
                    print(f"ERROR on page {page_num}: {e}")
                    
    finally:
        # Close the browser
        driver.quit()
    
    print(f"\n{'='*60}")
    print(f"Scraping complete!")
    print(f"Total links found: {total_links_found}")
    print(f"Links saved to: {output_file}")
    print(f"{'='*60}")

if __name__ == "__main__":
    print("Starting AFP factcheck link scraper (Selenium version)...")
    print("This will scrape pages 0-145 for doc.afp.com links")
    print(f"{'='*60}\n")
    scrape_afp_links()




