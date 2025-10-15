// /ooc-simpleui/static/script.js

/**
 * @typedef {Object} EntryData
 * @property {number} id
 * @property {string} politifact_url
 * @property {string} politifact_headline
 * @property {string} politifact_subheadline
 * @property {string} rating
 * @property {string} social_link
 * @property {string} social_platform
 * @property {number} social_duration
 * @property {string} social_text
 * @property {boolean} download_success
 * @property {string} download_message
 * @property {string} drive_path
 * @property {Array<ExternalLink>} external_links_info
 */

/**
 * @typedef {Object} ExternalLink
 * @property {string} url
 * @property {string} description
 * @property {Object<string, boolean>} checklist
 */

/**
 * Main Application Module
 */
(function() {
    'use strict';

    // ==================== CONSTANTS ====================
    const MAX_DURATION_DISPLAY = 600; // 10 minutes in seconds
    const AUTOSAVE_DELAY = 1000; // 1 second
    const MAX_HISTORY_SIZE = 50;

    const OOC_CRITERIA = [
        { key: 'temporal_misattribution', name: 'Temporal Misattribution', definition: "Does the content demonstrably shift the event's perceived timing to mislead context (e.g., via clear statements, timestamps, editing)?" },
        { key: 'geographical_misattribution', name: 'Geographical Misattribution', definition: 'Does the content explicitly claim or suggest an incorrect, yet plausible, location for the event?' },
        { key: 'person_misidentification', name: 'Person Misidentification', definition: 'Does the content directly name, label, or visually imply incorrect identities for individuals in a believable, misleading way?' },
        { key: 'contextual_misrepresentation', name: 'Contextual Misrepresentation', definition: 'Does the content explicitly frame the purpose, cause, or background of the event in a deceptive manner?' },
        { key: 'exaggeration_scale', name: 'Exaggeration (Scale)', definition: "Does the content use specific numbers, comparisons, or visual framing to clearly amplify the event's impact slightly beyond reality?" },
        { key: 'exaggeration_urgency', name: 'Exaggeration (Urgency)', definition: 'Does the content use explicit time pressure language or editing pace to create false immediacy when unwarranted?' },
        { key: 'fabricated_consequences', name: 'Fabricated Consequences', definition: 'Does the content clearly state plausible outcomes or effects that are not shown or supported by evidence within the content?' },
        { key: 'misleading_intent', name: 'Misleading Intent', definition: 'Does the content clearly frame neutral or positive actions with commentary or visuals suggesting malicious intent?' },
        { key: 'misleading_emotional_framing', name: 'Misleading Emotional Framing', definition: 'Does the content introduce clearly emotionally charged language, music, or imagery unrelated to the core facts specifically to sway perception?' },
        { key: 'causal_misattribution', name: 'Causal Misattribution', definition: 'Does the content explicitly state or visually edit to show one event clearly causing another, when the link is incorrect or unproven, but plausible?'}
    ];

    const EVIDENCE_CRITERIA = [
        { key: 'author_expertise', name: 'Author Expertise', definition: 'Author possesses demonstrable, high-level, relevant expertise (e.g., recognized expert, relevant credentials, extensive experience) in the specific subject matter.' },
        { key: 'source_reputation', name: 'Source Reputation', definition: 'Published by a highly reputable source with strong editorial standards (e.g., major int\'l news org, IFCN signatory fact-checker, respected academic journal, official gov\'t body).'},
        { key: 'neutrality_fairness', name: 'Neutrality & Fairness', definition: 'Content is demonstrably objective, neutral in tone, and presents multiple perspectives fairly.' },
        { key: 'fact_vs_opinion', name: 'Fact vs. Opinion', definition: 'Clearly distinguishes fact from opinion.' },
        { key: 'purpose', name: 'Purpose', definition: 'Purpose is primarily informational.' },
        { key: 'definitive_proof', name: 'Definitive Proof', definition: 'Evidence provides definitive proof (e.g., timestamped original footage, precise geolocation, official identification, multiple corroborating accounts, detailed description/footage of the same event).'},
        { key: 'direct_connection', name: 'Direct Connection', definition: 'This proof confirms or refutes the specific time, date, location, key actors/subjects, or core event narrative of the OOC (Out of Context) video event.'},
        { key: 'source_transparency', name: 'Source Transparency', definition: 'Source clearly identifies author, provides contact info, discloses funding, cites evidence meticulously, has a clear corrections policy, and adheres to it.'},
        { key: 'evidence_integrity', name: 'Evidence Integrity', definition: 'Evidence is the verified original, unedited, or significantly more complete footage/data, allowing direct comparison or assessment.' },
        { key: 'fact_verifiability', name: 'Fact Verifiability', definition: 'Presents specific, independently verifiable facts that directly and unambiguously relate to (confirming or refuting) a core element of the OOC narrative.'},
        { key: 'clarity_relevance', name: 'Clarity & Relevance', definition: 'Information date is clearly stated, current, and highly relevant to the specific timeframe of the event being verified.' }
    ];

    // ==================== STATE MANAGEMENT ====================
    const State = {
        saveTimeout: null,
        history: [],
        historyIndex: -1,
        isUndoRedoAction: false,
        currentFilters: {
            search: '',
            platform: '',
            rating: ''
        }
    };

    // ==================== DOM ELEMENTS ====================
    const DOM = {
        dataContainer: null,
        addEntryBtn: null,
        saveStatus: null,
        undoBtn: null,
        redoBtn: null,
        historyStatus: null,
        searchInput: null,
        filterPlatform: null,
        filterRating: null,
        clearFiltersBtn: null,
        filterResults: null
    };

    // ==================== UI MODULE ====================
    const UI = {
        /**
         * Update save status indicator
         * @param {'saving' | 'saved' | 'error'} status
         * @param {string} [message]
         */
        updateSaveStatus(status, message) {
            const statusBadge = DOM.saveStatus;
            if (!statusBadge) return;

            statusBadge.className = 'badge';
            statusBadge.classList.add(status);

            switch(status) {
                case 'saving':
                    statusBadge.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving...';
                    break;
                case 'saved':
                    statusBadge.innerHTML = '<i class="bi bi-check-circle"></i> Saved';
                    break;
                case 'error':
                    statusBadge.innerHTML = '<i class="bi bi-x-circle"></i> Error';
                    if (message) {
                        console.error('Save error:', message);
                    }
                    break;
            }
        },

        /**
         * Update undo/redo button states
         */
        updateHistoryButtons() {
            if (DOM.undoBtn) {
                DOM.undoBtn.disabled = State.historyIndex <= 0;
            }
            if (DOM.redoBtn) {
                DOM.redoBtn.disabled = State.historyIndex >= State.history.length - 1;
            }
            if (DOM.historyStatus) {
                const current = State.historyIndex + 1;
                const total = State.history.length;
                DOM.historyStatus.textContent = total > 0 ? `${current} of ${total}` : '';
            }
        },

        /**
         * Update filter results display
         * @param {number} visible
         * @param {number} total
         */
        updateFilterResults(visible, total) {
            if (DOM.filterResults) {
                if (visible < total) {
                    DOM.filterResults.textContent = `Showing ${visible} of ${total} entries`;
                } else {
                    DOM.filterResults.textContent = '';
                }
            }
        }
    };

    // ==================== API MODULE ====================
    const API = {
        /**
         * Save data to server
         * @param {Array<EntryData>} data
         * @returns {Promise<boolean>}
         */
        async saveData(data) {
            try {
                const response = await fetch('/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                return response.ok;
            } catch (error) {
                console.error('Network error during save:', error);
                return false;
            }
        },

        /**
         * Fetch page details
         * @param {string} url
         * @returns {Promise<{headline: string, subheadline: string}>}
         */
        async fetchPageDetails(url) {
            const response = await fetch('/get_page_details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            return await response.json();
        },

        /**
         * Fetch video metadata
         * @param {string} url
         * @returns {Promise<Object>}
         */
        async fetchVideoMetadata(url) {
            const response = await fetch('/get_video_metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            return await response.json();
        },

        /**
         * Download video
         * @param {string} url
         * @param {number} id
         * @param {string} rating
         * @returns {Promise<Object>}
         */
        async downloadVideo(url, id, rating = '') {
            const response = await fetch('/download_video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, id, rating })
            });
            return await response.json();
        },

        /**
         * Delete video file
         * @param {number} id
         * @returns {Promise<Object>}
         */
        async deleteVideo(id) {
            const response = await fetch('/delete_video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            return await response.json();
        }
    };

    // ==================== HISTORY MODULE ====================
    const History = {
        /**
         * Take a snapshot of current state
         */
        takeSnapshot() {
            if (State.isUndoRedoAction) return;

            const currentData = DataManager.collectDataFromForm();
            const snapshot = JSON.stringify(currentData);

            // Remove any states after current position
            State.history = State.history.slice(0, State.historyIndex + 1);
            
            // Add new snapshot
            State.history.push(snapshot);
            
            // Limit history size
            if (State.history.length > MAX_HISTORY_SIZE) {
                State.history.shift();
            } else {
                State.historyIndex++;
            }

            UI.updateHistoryButtons();
        },

        /**
         * Undo last action
         */
        undo() {
            if (State.historyIndex > 0) {
                State.historyIndex--;
                this.restoreSnapshot();
            }
        },

        /**
         * Redo last undone action
         */
        redo() {
            if (State.historyIndex < State.history.length - 1) {
                State.historyIndex++;
                this.restoreSnapshot();
            }
        },

        /**
         * Restore a snapshot from history
         */
        restoreSnapshot() {
            State.isUndoRedoAction = true;
            const snapshot = State.history[State.historyIndex];
            const data = JSON.parse(snapshot);
            
            // Clear and rebuild UI
            DOM.dataContainer.innerHTML = '';
            data.forEach((item, index) => {
                const entryHtml = EntryBuilder.createEntryHtml(item.id, item);
                DOM.dataContainer.insertAdjacentHTML('beforeend', entryHtml);
                const entryElement = DOM.dataContainer.children[index];
                entryElement.dataset.entryIndex = index;
                Helpers.attachListenersToEntry(entryElement);
            });
            
            Helpers.initializeTooltips();
            UI.updateHistoryButtons();
            
            // Auto-save the restored state
            setTimeout(() => {
                State.isUndoRedoAction = false;
                AutoSave.save();
            }, 100);
        }
    };

    // ==================== SEARCH & FILTER MODULE ====================
    const SearchFilter = {
        /**
         * Apply current filters
         */
        applyFilters() {
            const entries = DOM.dataContainer.querySelectorAll('.entry-group');
            let visibleCount = 0;

            entries.forEach(entry => {
                const matches = this.entryMatchesFilters(entry);
                entry.classList.toggle('filtered-out', !matches);
                if (matches) visibleCount++;
            });

            UI.updateFilterResults(visibleCount, entries.length);
        },

        /**
         * Check if entry matches current filters
         * @param {HTMLElement} entry
         * @returns {boolean}
         */
        entryMatchesFilters(entry) {
            const { search, platform, rating } = State.currentFilters;
            
            // Search filter
            if (search) {
                const searchText = search.toLowerCase();
                const entryText = entry.textContent.toLowerCase();
                if (!entryText.includes(searchText)) return false;
            }

            // Platform filter
            if (platform) {
                const entryPlatform = entry.querySelector('input[name$="[social_platform]"]')?.value || '';
                if (entryPlatform !== platform) return false;
            }

            // Rating filter
            if (rating) {
                const ratingSwitch = entry.querySelector('.rating-switch');
                const entryRating = ratingSwitch?.checked ? 'Positive Label' : 'Negative Label';
                if (entryRating !== rating) return false;
            }

            return true;
        },

        /**
         * Clear all filters
         */
        clearFilters() {
            State.currentFilters = { search: '', platform: '', rating: '' };
            if (DOM.searchInput) DOM.searchInput.value = '';
            if (DOM.filterPlatform) DOM.filterPlatform.value = '';
            if (DOM.filterRating) DOM.filterRating.value = '';
            this.applyFilters();
        }
    };

    // ==================== AUTO-SAVE MODULE ====================
    const AutoSave = {
        /**
         * Trigger auto-save
         */
        save() {
            clearTimeout(State.saveTimeout);
            UI.updateSaveStatus('saving');

            State.saveTimeout = setTimeout(async () => {
                const dataToSave = DataManager.collectDataFromForm();
                const success = await API.saveData(dataToSave);
                
                if (success) {
                    UI.updateSaveStatus('saved');
                    // Take history snapshot after successful save
                    if (!State.isUndoRedoAction) {
                        History.takeSnapshot();
                    }
                } else {
                    UI.updateSaveStatus('error', 'Failed to save data');
                }
            }, AUTOSAVE_DELAY);
        }
    };

    // ==================== DATA MANAGEMENT ====================
    const DataManager = {
        /**
         * Calculate next available ID
         * @returns {number}
         */
        calculateNextId() {
            const entries = DOM.dataContainer.querySelectorAll('.entry-group');
            if (entries.length === 0) return 0;
            
            let maxId = -1;
            entries.forEach(entry => {
                const id = parseInt(entry.querySelector('input[name$="[id]"]')?.value, 10);
                if (!isNaN(id) && id > maxId) maxId = id;
            });
            return maxId + 1;
        },

        /**
         * Collect all form data
         * @returns {Array<EntryData>}
         */
        collectDataFromForm() {
            const entries = [];
            const entryElements = DOM.dataContainer.querySelectorAll('.entry-group');
            
            entryElements.forEach((entryElement, entryIndex) => {
                const ratingSwitch = entryElement.querySelector('.rating-switch');
                const rating = ratingSwitch?.checked ? 'Positive Label' : 'Negative Label';
                
                const entryData = {
                    id: parseInt(entryElement.querySelector('input[name$="[id]"]')?.value ?? '-1', 10),
                    politifact_url: entryElement.querySelector('.source-url-input')?.value ?? '',
                    politifact_headline: entryElement.querySelector('.source-headline-input')?.value ?? '',
                    politifact_subheadline: entryElement.querySelector('.source-subheadline-input')?.value ?? '',
                    rating: rating,
                    social_link: entryElement.querySelector('.social-link-input')?.value ?? '',
                    social_platform: entryElement.querySelector('input[name$="[social_platform]"]')?.value ?? '',
                    social_duration: parseFloat(entryElement.querySelector('input[name$="[social_duration]"]')?.value || '0'),
                    social_text: entryElement.querySelector('textarea[name$="[social_text]"]')?.value ?? '',
                    download_success: entryElement.querySelector('input[name$="[download_success]"]')?.value === 'true',
                    download_message: entryElement.querySelector('.download-message-field')?.value ?? '',
                    drive_path: entryElement.querySelector('input[name$="[drive_path]"]')?.value ?? '',
                    external_links_info: [],
                };

                // Collect OOC criteria
                OOC_CRITERIA.forEach(c => {
                    const cb = entryElement.querySelector(`input[name="data[${entryIndex}][ooc_${c.key}]"]`);
                    entryData[`ooc_${c.key}`] = cb ? cb.checked : false;
                });

                // Collect external links
                const linkPairs = entryElement.querySelectorAll('.external-link-pair');
                linkPairs.forEach((linkPair) => {
                    const url = linkPair.querySelector('input[name$="[url]"]')?.value.trim();
                    if (url) {
                        const linkData = {
                            url: url,
                            description: linkPair.querySelector('input[name$="[description]"]')?.value.trim() || '',
                            checklist: {}
                        };
                        
                        EVIDENCE_CRITERIA.forEach(c => {
                            const cb = linkPair.querySelector(`input[name$="[checklist][${c.key}]"]`);
                            linkData.checklist[c.key] = cb ? cb.checked : false;
                        });
                        
                        entryData.external_links_info.push(linkData);
                    }
                });

                entries.push(entryData);
            });

            return entries;
        }
    };

    // ==================== ENTRY BUILDER ====================
    const EntryBuilder = {
        /**
         * Create OOC checklist HTML
         * @param {number} entryIndex
         * @param {Object} initialData
         * @returns {string}
         */
        createOocChecklistHtml(entryIndex, initialData = {}) {
            let html = '<div class="ooc-checklist-container border-top border-bottom py-3 my-3">';
            html += '<h6 class="mb-3"><i class="bi bi-check2-square"></i> OOC Qualification Checklist</h6>';
            
            OOC_CRITERIA.forEach(criterion => {
                const fieldName = `data[${entryIndex}][ooc_${criterion.key}]`;
                const fieldId = `ooc_${criterion.key}_${entryIndex}`;
                const isChecked = initialData[`ooc_${criterion.key}`] ? 'checked' : '';
                
                html += `
                    <div class="form-check mb-2">
                        <input class="form-check-input ooc-checkbox" type="checkbox" name="${fieldName}" id="${fieldId}" value="true" ${isChecked}>
                        <label class="form-check-label" for="${fieldId}" title="${criterion.definition}">
                            <strong>${criterion.name}</strong> <small class="text-muted d-block">${criterion.definition}</small>
                        </label>
                    </div>`;
            });
            
            html += '</div>';
            return html;
        },

        /**
         * Create evidence checklist HTML
         * @param {number} entryIndex
         * @param {number} linkIndex
         * @param {Object} checklistData
         * @returns {string}
         */
        createEvidenceChecklistHtml(entryIndex, linkIndex, checklistData = {}) {
            let html = '<div class="evidence-checklist ps-2">';
            html += '<strong class="evidence-checklist-title">Evidence Checklist:</strong>';
            
            EVIDENCE_CRITERIA.forEach((criterion) => {
                const fieldName = `data[${entryIndex}][external_links_info][${linkIndex}][checklist][${criterion.key}]`;
                const fieldId = `evidence_${entryIndex}_${linkIndex}_${criterion.key}`;
                const tooltipAttrs = `data-bs-toggle="tooltip" title="${criterion.definition}"`;
                const isChecked = checklistData[criterion.key] ? 'checked' : '';
                
                html += `
                    <div class="form-check form-check-sm">
                        <input class="form-check-input evidence-checkbox" type="checkbox" name="${fieldName}" id="${fieldId}" value="true" ${isChecked}>
                        <label class="form-check-label" for="${fieldId}" ${tooltipAttrs}>${criterion.name}</label>
                    </div>`;
            });
            
            html += '</div>';
            return html;
        },

        /**
         * Create rating switch HTML
         * @param {string} name
         * @param {string} selectedValue
         * @param {number} index
         * @returns {string}
         */
        createRatingSwitch(name, selectedValue, index) {
            const isPositive = selectedValue === 'Positive Label';
            const checked = isPositive ? 'checked' : '';
            const labelText = isPositive ? 'Positive Label' : 'Negative Label';
            const id = `rating_switch_${index}`;
            
            return `
                <div class="form-check form-switch">
                    <input class="form-check-input rating-switch" type="checkbox" role="switch" id="${id}" name="${name}" value="Positive Label" ${checked}>
                    <label class="form-check-label" for="${id}">
                        <span class="rating-label-text">${labelText}</span>
                    </label>
                </div>`;
        },

        /**
         * Create external link HTML
         * @param {number} entryIndex
         * @param {number} linkIndex
         * @param {string} url
         * @param {string} description
         * @param {Object} checklist
         * @returns {string}
         */
        createExternalLinkHtml(entryIndex, linkIndex, url = '', description = '', checklist = {}) {
            const checklistHtml = this.createEvidenceChecklistHtml(entryIndex, linkIndex, checklist);
            
            return `
                <div class="mb-3 p-3 border rounded external-link-pair" data-link-index="${linkIndex}">
                    <div class="row g-2 mb-3">
                        <div class="col"><input type="url" name="data[${entryIndex}][external_links_info][${linkIndex}][url]" value="${url}" class="form-control form-control-sm" placeholder="Evidence URL"></div>
                        <div class="col"><input type="text" name="data[${entryIndex}][external_links_info][${linkIndex}][description]" value="${description}" class="form-control form-control-sm" placeholder="Brief Description"></div>
                        <div class="col-auto"><button type="button" class="btn btn-sm btn-outline-danger remove-link-btn" title="Remove Link"><i class="bi bi-x-lg"></i></button></div>
                    </div>
                    ${checklistHtml}
                </div>`;
        },

        /**
         * Create complete entry HTML
         * @param {number} id
         * @param {Object} initialData
         * @returns {string}
         */
        createEntryHtml(id, initialData = {}) {
            const entryIndex = DOM.dataContainer.children.length;
            
            return `
                <div class="card mb-4 entry-group" data-entry-index="${entryIndex}">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <span>Entry ID: <input type="text" name="data[${entryIndex}][id]" value="${id}" readonly class="id-readonly-input"></span>
                        <button type="button" class="btn btn-sm btn-outline-danger remove-entry-btn"><i class="bi bi-trash"></i> Remove Entry</button>
                    </div>
                    ${this.createOocChecklistHtml(entryIndex, initialData)}
                    <div class="card-body">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="mb-3 position-relative">
                                    <label for="source_url_${entryIndex}" class="form-label"><i class="bi bi-link-45deg"></i> Source URL:</label>
                                    <input type="url" id="source_url_${entryIndex}" name="data[${entryIndex}][politifact_url]" value="${initialData.politifact_url || ''}" class="form-control source-url-input" placeholder="Enter PolitiFact, AFP, or other source URL">
                                    <div class="spinner-border spinner-border-sm text-secondary position-absolute top-50 end-0 translate-middle-y me-2 d-none source-spinner" role="status"><span class="visually-hidden">Loading...</span></div>
                                </div>
                                <div class="mb-3">
                                    <label for="source_headline_${entryIndex}" class="form-label"><i class="bi bi-card-heading"></i> Headline:</label>
                                    <input type="text" id="source_headline_${entryIndex}" name="data[${entryIndex}][politifact_headline]" value="${initialData.politifact_headline || ''}" class="form-control source-headline-input">
                                </div>
                                <div class="mb-3">
                                    <label for="source_subheadline_${entryIndex}" class="form-label"><i class="bi bi-card-text"></i> Subheadline:</label>
                                    <input type="text" id="source_subheadline_${entryIndex}" name="data[${entryIndex}][politifact_subheadline]" value="${initialData.politifact_subheadline || ''}" class="form-control source-subheadline-input">
                                </div>
                                <hr>
                                <div class="mb-3">
                                    <label for="social_link_${entryIndex}" class="form-label"><i class="bi bi-share"></i> Social Link:</label>
                                    <input type="url" id="social_link_${entryIndex}" name="data[${entryIndex}][social_link]" value="${initialData.social_link || ''}" class="form-control social-link-input">
                                </div>
                                <div class="row">
                                    <div class="col-sm-6 mb-3"><label class="form-label"><i class="bi bi-tags"></i> Social Platform:</label><input type="text" name="data[${entryIndex}][social_platform]" value="${initialData.social_platform || ''}" class="form-control" readonly></div>
                                    <div class="col-sm-6 mb-3"><label for="social_duration_${entryIndex}" class="form-label"><i class="bi bi-stopwatch"></i> Social Duration (sec):</label><input type="text" id="social_duration_${entryIndex}" name="data[${entryIndex}][social_duration]" value="${initialData.social_duration || ''}" class="form-control" readonly placeholder="Auto-filled"></div>
                                </div>
                                <div class="mb-3 narrative-box">
                                    <label for="social_text_${entryIndex}" class="form-label"><i class="bi bi-blockquote-left"></i> Social Text (Auto-filled):</label>
                                    <textarea id="social_text_${entryIndex}" name="data[${entryIndex}][social_text]" rows="5" class="form-control">${initialData.social_text || ''}</textarea>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3"><label class="form-label d-block"><i class="bi bi-star-half"></i> Label:</label>${this.createRatingSwitch(`data[${entryIndex}][rating]`, initialData.rating || '', entryIndex)}</div>
                                <hr>
                                <div class="mb-3">
                                    <label class="form-label"><i class="bi bi-film"></i> Download Video (from Social Link)</label>
                                    <div class="input-group mb-1">
                                        <button type="button" class="btn btn-info download-btn" title="Fetch Metadata & Download Video (if < 10 min)"><i class="bi bi-download"></i> Download</button>
                                        <input type="hidden" name="data[${entryIndex}][download_success]" value="${initialData.download_success ? 'true' : 'false'}">
                                    </div>
                                    <textarea name="data[${entryIndex}][download_message]" class="form-control download-message-field" rows="3" readonly placeholder="Download status messages appear here...">${initialData.download_message || ''}</textarea>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"><i class="bi bi-folder2-open"></i> Drive Path:</label>
                                    <input type="text" name="data[${entryIndex}][drive_path]" value="${initialData.drive_path || ''}" class="form-control" readonly>
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div class="mb-3">
                            <label class="form-label"><i class="bi bi-box-arrow-up-right"></i> External Links (Evidence):</label>
                            <div class="external-links-container mb-2">
                                ${(initialData.external_links_info || []).map((link, idx) => 
                                    this.createExternalLinkHtml(entryIndex, idx, link.url, link.description, link.checklist)
                                ).join('')}
                            </div>
                            <button type="button" class="btn btn-sm btn-success add-link-btn"><i class="bi bi-plus-circle"></i> Add External Link</button>
                        </div>
                    </div>
                </div>`;
        }
    };

    // ==================== HELPERS ====================
    const Helpers = {
        /**
         * Get social platform from URL
         * @param {string} url
         * @returns {string}
         */
        getSocialPlatform(url) {
            if (!url) return '';
            try {
                const hostname = new URL(url).hostname.toLowerCase();
                if (hostname.includes('x.com') || hostname.includes('twitter.com')) return 'x';
                if (hostname.includes('facebook.com') || hostname.includes('fb.watch')) return 'facebook';
                if (hostname.includes('instagram.com')) return 'instagram';
                if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
                if (hostname.includes('tiktok.com')) return 'tiktok';
                return new URL(url).hostname.replace(/^www\./, '').split('.')[0];
            } catch (e) {
                return '';
            }
        },

        /**
         * Update social platform field
         * @param {HTMLInputElement} socialLinkInput
         */
        updateSocialPlatform(socialLinkInput) {
            const entryGroup = socialLinkInput.closest('.entry-group');
            if (!entryGroup) return;
            
            const platformInput = entryGroup.querySelector('input[name$="[social_platform]"]');
            if (platformInput) {
                platformInput.value = this.getSocialPlatform(socialLinkInput.value);
            }
        },

        /**
         * Update message field styling
         * @param {HTMLTextAreaElement} messageField
         * @param {HTMLInputElement} successInput
         */
        updateMessageFieldStyle(messageField, successInput) {
            if (!messageField || !successInput) return;
            
            messageField.classList.remove('is-valid', 'is-invalid');
            if (successInput.value === 'true') {
                messageField.classList.add('is-valid');
            } else if (messageField.value && successInput.value === 'false') {
                messageField.classList.add('is-invalid');
            }
        },

        /**
         * Fetch source details
         * @param {HTMLInputElement} urlInput
         */
        async fetchSourceDetails(urlInput) {
            const entryGroup = urlInput.closest('.entry-group');
            if (!entryGroup) return;

            const headlineInput = entryGroup.querySelector('.source-headline-input');
            const subheadlineInput = entryGroup.querySelector('.source-subheadline-input');
            const spinner = urlInput.parentElement.querySelector('.source-spinner');
            
            if (!headlineInput || !subheadlineInput || !spinner) return;

            const url = urlInput.value.trim();
            if (!url || !url.startsWith('http')) {
                headlineInput.value = '';
                subheadlineInput.value = '';
                spinner.classList.add('d-none');
                return;
            }

            // Check if URL is from PolitiFact or AFP
            const isPolitiFact = url.includes('politifact.com');
            const isAFP = url.includes('factcheck.afp.com');
            
            if (!isPolitiFact && !isAFP) {
                spinner.classList.add('d-none');
                return;
            }

            spinner.classList.remove('d-none');
            urlInput.disabled = true;

            try {
                const data = await API.fetchPageDetails(url);
                if (data.headline || data.subheadline) {
                    headlineInput.value = data.headline || '';
                    subheadlineInput.value = data.subheadline || '';
                    AutoSave.save();
                }
            } catch (error) {
                console.error('Error fetching source details:', error);
            } finally {
                spinner.classList.add('d-none');
                urlInput.disabled = false;
            }
        },

        /**
         * Handle video download process
         * @param {HTMLButtonElement} button
         */
        async handleDownloadProcess(button) {
            const entryGroup = button.closest('.entry-group');
            const socialUrlInput = entryGroup.querySelector('.social-link-input');
            const idInput = entryGroup.querySelector('input[name$="[id]"]');
            const messageTextarea = entryGroup.querySelector('.download-message-field');
            const pathInput = entryGroup.querySelector('input[name$="[drive_path]"]');
            const successInput = entryGroup.querySelector('input[name$="[download_success]"]');
            const durationInput = entryGroup.querySelector('input[name$="[social_duration]"]');
            const socialTextInput = entryGroup.querySelector('textarea[name$="[social_text]"]');
            const ratingSwitch = entryGroup.querySelector('.rating-switch');

            const url = socialUrlInput.value.trim();
            const id = idInput.value;
            const rating = ratingSwitch?.checked ? 'Positive Label' : 'Negative Label';
            
            if (!url || id === '' || id === null) {
                messageTextarea.value = "Social Link URL and a valid Entry ID are required.";
                this.updateMessageFieldStyle(messageTextarea, successInput);
                return;
            }

            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Fetching...';
            messageTextarea.value = "Fetching video metadata...";
            successInput.value = "false";
            this.updateMessageFieldStyle(messageTextarea, successInput);

            // Phase 1: Get Metadata
            try {
                const metadataResult = await API.fetchVideoMetadata(url);

                if (!metadataResult.success) {
                    messageTextarea.value = `Metadata Error: ${metadataResult.error || 'Unknown server error'}`;
                    button.disabled = false;
                    button.innerHTML = '<i class="bi bi-download"></i> Download';
                    return;
                }

                durationInput.value = metadataResult.duration.toFixed(2);
                socialTextInput.value = metadataResult.social_text;
                messageTextarea.value = `Metadata OK (Duration: ${durationInput.value}s).`;
                AutoSave.save();
            } catch (error) {
                messageTextarea.value = `Network error during metadata fetch: ${error.message}`;
                button.disabled = false;
                button.innerHTML = '<i class="bi bi-download"></i> Download';
                return;
            }

            // Phase 2: Download Video
            button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Downloading...';
            messageTextarea.value += `\nProceeding to download video to ${rating === 'Negative Label' ? 'video_negativelabel' : 'video_positivelabel'} folder...`;

            try {
                const downloadResult = await API.downloadVideo(url, id, rating);

                if (!downloadResult.success) {
                    messageTextarea.value = `Download Error: ${downloadResult.error || 'Unknown download error'}`;
                    pathInput.value = "";
                } else {
                    messageTextarea.value = downloadResult.message || "Download successful.";
                    pathInput.value = downloadResult.drive_path || "";
                    successInput.value = "true";
                }
                
                this.updateMessageFieldStyle(messageTextarea, successInput);
                AutoSave.save();
            } catch (error) {
                messageTextarea.value = `Network error during download: ${error.message}`;
            } finally {
                button.disabled = false;
                button.innerHTML = '<i class="bi bi-download"></i> Download';
            }
        },

        /**
         * Attach event listeners to an entry
         * @param {HTMLElement} entryElement
         */
        attachListenersToEntry(entryElement) {
            const socialLinkInput = entryElement.querySelector('.social-link-input');
            if (socialLinkInput && socialLinkInput.value) {
                this.updateSocialPlatform(socialLinkInput);
            }

            const messageTextarea = entryElement.querySelector('.download-message-field');
            const successInput = entryElement.querySelector('input[name$="[download_success]"]');
            this.updateMessageFieldStyle(messageTextarea, successInput);

            const sourceUrlInput = entryElement.querySelector('.source-url-input');
            if (sourceUrlInput && sourceUrlInput.value) {
                this.fetchSourceDetails(sourceUrlInput);
            }
        },

        /**
         * Initialize Bootstrap tooltips
         * @param {HTMLElement} parentElement
         */
        initializeTooltips(parentElement = document.body) {
            const tooltipTriggerList = parentElement.querySelectorAll('[data-bs-toggle="tooltip"]');
            [...tooltipTriggerList].forEach(el => new bootstrap.Tooltip(el));
        }
    };

    // ==================== EVENT HANDLERS ====================
    const EventHandlers = {
        /**
         * Handle add entry button click
         */
        handleAddEntry() {
            const newId = DataManager.calculateNextId();
            
            // Get the rating from the previous entry (last entry in container)
            let defaultRating = 'Negative Label'; // Default for first entry
            const entries = DOM.dataContainer.querySelectorAll('.entry-group');
            if (entries.length > 0) {
                const lastEntry = entries[entries.length - 1];
                const lastSwitch = lastEntry.querySelector('.rating-switch');
                defaultRating = lastSwitch?.checked ? 'Positive Label' : 'Negative Label';
            }
            
            const newEntryHtml = EntryBuilder.createEntryHtml(newId, { rating: defaultRating });
            DOM.dataContainer.insertAdjacentHTML('beforeend', newEntryHtml);
            
            const newEntryElement = DOM.dataContainer.lastElementChild;
            newEntryElement.dataset.entryIndex = Array.from(DOM.dataContainer.children).indexOf(newEntryElement);
            
            Helpers.initializeTooltips(newEntryElement);
            AutoSave.save();
            SearchFilter.applyFilters();
        },

        /**
         * Handle remove entry button click
         * @param {HTMLButtonElement} button
         */
        async handleRemoveEntry(button) {
            if (!confirm('Are you sure you want to delete this entry? The associated video file will also be deleted.')) {
                return;
            }

            const entryGroup = button.closest('.entry-group');
            const entryId = entryGroup.querySelector('input[name$="[id]"]')?.value;
            
            if (entryId) {
                try {
                    const result = await API.deleteVideo(entryId);
                    if (result.success) {
                        console.log(`Deleted video file(s) for ID ${entryId}:`, result.message);
                    }
                } catch (error) {
                    console.error('Error deleting video:', error);
                }
            }
            
            entryGroup.remove();
            AutoSave.save();
            SearchFilter.applyFilters();
        },

        /**
         * Handle add link button click
         * @param {HTMLButtonElement} button
         */
        handleAddLink(button) {
            const linksContainer = button.previousElementSibling;
            const entryGroup = button.closest('.entry-group');
            const entryIndex = parseInt(entryGroup.dataset.entryIndex, 10);
            const linkIndex = linksContainer.querySelectorAll('.external-link-pair').length;
            
            const newLinkHtml = EntryBuilder.createExternalLinkHtml(entryIndex, linkIndex);
            linksContainer.insertAdjacentHTML('beforeend', newLinkHtml);
            
            Helpers.initializeTooltips(linksContainer.lastElementChild);
            AutoSave.save();
        },

        /**
         * Handle remove link button click
         * @param {HTMLButtonElement} button
         */
        handleRemoveLink(button) {
            button.closest('.external-link-pair').remove();
            AutoSave.save();
        },

        /**
         * Handle keyboard shortcuts
         * @param {KeyboardEvent} e
         */
        handleKeyboardShortcuts(e) {
            // Ctrl/Cmd + Z: Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                History.undo();
            }
            // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
            else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                History.redo();
            }
        }
    };

    // ==================== INITIALIZATION ====================
    function initialize() {
        // Cache DOM elements
        DOM.dataContainer = document.getElementById('data-container');
        DOM.addEntryBtn = document.getElementById('add-entry-btn');
        DOM.saveStatus = document.getElementById('save-status');
        DOM.undoBtn = document.getElementById('undo-btn');
        DOM.redoBtn = document.getElementById('redo-btn');
        DOM.historyStatus = document.getElementById('history-status');
        DOM.searchInput = document.getElementById('search-input');
        DOM.filterPlatform = document.getElementById('filter-platform');
        DOM.filterRating = document.getElementById('filter-rating');
        DOM.clearFiltersBtn = document.getElementById('clear-filters-btn');
        DOM.filterResults = document.getElementById('filter-results');

        // Set up event listeners
        if (DOM.addEntryBtn) {
            DOM.addEntryBtn.addEventListener('click', EventHandlers.handleAddEntry);
        }

        if (DOM.undoBtn) {
            DOM.undoBtn.addEventListener('click', () => History.undo());
        }

        if (DOM.redoBtn) {
            DOM.redoBtn.addEventListener('click', () => History.redo());
        }

        if (DOM.clearFiltersBtn) {
            DOM.clearFiltersBtn.addEventListener('click', () => SearchFilter.clearFilters());
        }

        // Search and filter events
        if (DOM.searchInput) {
            DOM.searchInput.addEventListener('input', (e) => {
                State.currentFilters.search = e.target.value;
                SearchFilter.applyFilters();
            });
        }

        if (DOM.filterPlatform) {
            DOM.filterPlatform.addEventListener('change', (e) => {
                State.currentFilters.platform = e.target.value;
                SearchFilter.applyFilters();
            });
        }

        if (DOM.filterRating) {
            DOM.filterRating.addEventListener('change', (e) => {
                State.currentFilters.rating = e.target.value;
                SearchFilter.applyFilters();
            });
        }

        // Delegated event handlers for dynamic content
        DOM.dataContainer.addEventListener('click', (event) => {
            const target = event.target;
            
            if (target.closest('.remove-link-btn')) {
                EventHandlers.handleRemoveLink(target.closest('.remove-link-btn'));
            }
            else if (target.closest('.add-link-btn')) {
                EventHandlers.handleAddLink(target.closest('.add-link-btn'));
            }
            else if (target.closest('.download-btn')) {
                Helpers.handleDownloadProcess(target.closest('.download-btn'));
            }
            else if (target.closest('.remove-entry-btn')) {
                EventHandlers.handleRemoveEntry(target.closest('.remove-entry-btn'));
            }
        });

        DOM.dataContainer.addEventListener('input', (event) => {
            if (event.target.matches('.social-link-input')) {
                Helpers.updateSocialPlatform(event.target);
            }
            AutoSave.save();
        });

        DOM.dataContainer.addEventListener('change', (event) => {
            if (event.target.matches('.source-url-input')) {
                Helpers.fetchSourceDetails(event.target);
            }
            // Handle rating switch toggle
            if (event.target.matches('.rating-switch')) {
                const labelSpan = event.target.parentElement.querySelector('.rating-label-text');
                if (labelSpan) {
                    labelSpan.textContent = event.target.checked ? 'Positive Label' : 'Negative Label';
                }
            }
            AutoSave.save();
            SearchFilter.applyFilters();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', EventHandlers.handleKeyboardShortcuts);

        // Initialize existing entries
        document.querySelectorAll('.entry-group').forEach((entry, index) => {
            entry.dataset.entryIndex = index;
            Helpers.attachListenersToEntry(entry);
        });

        // Initialize tooltips
        Helpers.initializeTooltips();

        // Take initial snapshot for undo/redo
        History.takeSnapshot();
        
        console.log('Application initialized successfully');
    }

    // Start the application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
