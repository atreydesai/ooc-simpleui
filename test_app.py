"""
Tests for the OOC Simple UI application
Run with: pytest test_app.py -v
"""

import pytest
import json
import os
import tempfile
from app import (
    app, 
    parse_social_platform, 
    load_data, 
    save_data,
    EVIDENCE_CRITERIA_KEYS
)


@pytest.fixture
def client():
    """Create a test client for the Flask app"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def temp_data_file():
    """Create a temporary data file for testing"""
    fd, path = tempfile.mkstemp(suffix='.json')
    os.close(fd)
    yield path
    if os.path.exists(path):
        os.remove(path)


class TestSocialPlatformParsing:
    """Test suite for social platform URL parsing"""
    
    def test_parse_x_twitter(self):
        assert parse_social_platform("https://x.com/user/status/123") == "x"
        assert parse_social_platform("https://twitter.com/user/status/123") == "x"
        assert parse_social_platform("https://t.co/abc123") == "x"
    
    def test_parse_facebook(self):
        assert parse_social_platform("https://facebook.com/page") == "facebook"
        assert parse_social_platform("https://fb.watch/video") == "facebook"
    
    def test_parse_youtube(self):
        assert parse_social_platform("https://youtube.com/watch?v=123") == "youtube"
        assert parse_social_platform("https://youtu.be/123") == "youtube"
    
    def test_parse_instagram(self):
        assert parse_social_platform("https://instagram.com/p/123") == "instagram"
        assert parse_social_platform("https://instagr.am/p/123") == "instagram"
    
    def test_parse_tiktok(self):
        assert parse_social_platform("https://tiktok.com/@user/video/123") == "tiktok"
    
    def test_parse_empty_url(self):
        assert parse_social_platform("") == ""
        assert parse_social_platform(None) == ""
    
    def test_parse_unknown_platform(self):
        result = parse_social_platform("https://example.com/page")
        assert result == "example"


class TestDataManagement:
    """Test suite for data loading and saving"""
    
    def test_save_and_load_data(self, temp_data_file, monkeypatch):
        """Test that data can be saved and loaded correctly"""
        monkeypatch.setattr('app.DATA_FILE', temp_data_file)
        
        test_data = [
            {
                "id": 0,
                "politifact_url": "https://example.com",
                "politifact_headline": "Test Headline",
                "rating": "true",
                "social_link": "https://x.com/test",
                "external_links_info": []
            }
        ]
        
        # Save data
        assert save_data(test_data) == True
        
        # Load data
        loaded_data = load_data()
        assert len(loaded_data) == 1
        assert loaded_data[0]["id"] == 0
        assert loaded_data[0]["politifact_headline"] == "Test Headline"
    
    def test_load_nonexistent_file(self, monkeypatch):
        """Test loading data from non-existent file"""
        monkeypatch.setattr('app.DATA_FILE', '/tmp/nonexistent_file_xyz.json')
        data = load_data()
        assert data == []
    
    def test_save_preserves_ids(self, temp_data_file, monkeypatch):
        """Test that IDs are preserved when saving"""
        monkeypatch.setattr('app.DATA_FILE', temp_data_file)
        
        test_data = [
            {"id": 5, "politifact_url": "https://example.com"},
            {"id": 10, "politifact_url": "https://example2.com"}
        ]
        
        save_data(test_data)
        loaded_data = load_data()
        
        assert loaded_data[0]["id"] == 5
        assert loaded_data[1]["id"] == 10
    
    def test_save_validates_ids(self, temp_data_file, monkeypatch):
        """Test that saving fails if IDs are missing"""
        monkeypatch.setattr('app.DATA_FILE', temp_data_file)
        
        test_data = [
            {"politifact_url": "https://example.com"}  # Missing ID
        ]
        
        # Should fail because ID is missing
        assert save_data(test_data) == False


class TestFlaskRoutes:
    """Test suite for Flask routes"""
    
    def test_index_route(self, client):
        """Test the index route renders correctly"""
        response = client.get('/')
        assert response.status_code == 200
        assert b'OOC Simple UI' in response.data
    
    def test_save_route_success(self, client, temp_data_file, monkeypatch):
        """Test successful save via API"""
        monkeypatch.setattr('app.DATA_FILE', temp_data_file)
        
        test_data = [
            {
                "id": 0,
                "politifact_url": "https://example.com",
                "politifact_headline": "Test",
                "rating": "true",
                "external_links_info": []
            }
        ]
        
        response = client.post('/save',
                             data=json.dumps(test_data),
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "message" in data
    
    def test_save_route_invalid_data(self, client):
        """Test save route with invalid data format"""
        response = client.post('/save',
                             data=json.dumps({"not": "a list"}),
                             content_type='application/json')
        
        assert response.status_code == 400
    
    def test_save_route_not_json(self, client):
        """Test save route with non-JSON data"""
        response = client.post('/save',
                             data="not json",
                             content_type='text/plain')
        
        assert response.status_code == 415
    
    def test_get_page_details_route(self, client):
        """Test page details fetching route"""
        response = client.post('/get_page_details',
                             data=json.dumps({"url": "https://example.com"}),
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "headline" in data
        assert "subheadline" in data
    
    def test_get_page_details_missing_url(self, client):
        """Test page details route with missing URL"""
        response = client.post('/get_page_details',
                             data=json.dumps({}),
                             content_type='application/json')
        
        assert response.status_code == 400
    
    def test_delete_video_route(self, client):
        """Test video deletion route"""
        response = client.post('/delete_video',
                             data=json.dumps({"id": 999}),
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] == True


class TestConstants:
    """Test suite for application constants"""
    
    def test_evidence_criteria_keys(self):
        """Test that all evidence criteria keys are defined"""
        assert len(EVIDENCE_CRITERIA_KEYS) == 11
        assert 'author_expertise' in EVIDENCE_CRITERIA_KEYS
        assert 'source_reputation' in EVIDENCE_CRITERIA_KEYS
        assert 'definitive_proof' in EVIDENCE_CRITERIA_KEYS


class TestDataDefaults:
    """Test suite for data default values"""
    
    def test_load_data_sets_defaults(self, temp_data_file, monkeypatch):
        """Test that loading data sets default values for missing fields"""
        monkeypatch.setattr('app.DATA_FILE', temp_data_file)
        
        # Save minimal data
        minimal_data = [{"id": 0, "politifact_url": "https://example.com"}]
        with open(temp_data_file, 'w') as f:
            json.dump(minimal_data, f)
        
        # Load and check defaults
        loaded_data = load_data()
        assert loaded_data[0]['politifact_headline'] == ''
        assert loaded_data[0]['social_platform'] == ''
        assert loaded_data[0]['download_success'] == False
        assert loaded_data[0]['ooc_temporal_misattribution'] == False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

