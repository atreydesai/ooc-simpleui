// /ooc-simpleui/static/script.js

document.addEventListener('DOMContentLoaded', () => {
    const dataContainer = document.getElementById('data-container');
    const addEntryBtn = document.getElementById('add-entry-btn');
    const saveAllBtn = document.getElementById('save-all-btn');
    const modeToggle = document.getElementById('mode-toggle');
    const dataForm = document.getElementById('data-form');
    const MAX_DURATION_DISPLAY = 600; // 10 minutes in seconds

    // --- Data Definitions (OOC, Evidence Criteria) remain the same ---
    const oocCriteria = [
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
    const evidenceCriteria = [
        { key: 'author_expertise', name: 'Author Expertise', definition: 'Author possesses demonstrable, high-level, relevant expertise (e.g., recognized expert, relevant credentials, extensive experience) in the specific subject matter.' },
        { key: 'source_reputation', name: 'Source Reputation', definition: 'Published by a highly reputable source with strong editorial standards (e.g., major int\'l news org, IFCN signatory fact-checker, respected academic journal, official gov\'t body).'},
        { key: 'neutrality_fairness', name: 'Neutrality & Fairness', definition: 'Content is demonstrably objective, neutral in tone, and presents multiple perspectives fairly.' },
        { key: 'fact_vs_opinion', 'name': 'Fact vs. Opinion', definition: 'Clearly distinguishes fact from opinion.' },
        { key: 'purpose', name: 'Purpose', 'definition': 'Purpose is primarily informational.' },
        { key: 'definitive_proof', name: 'Definitive Proof', 'definition': 'Evidence provides definitive proof (e.g., timestamped original footage, precise geolocation, official identification, multiple corroborating accounts, detailed description/footage of the same event).'},
        { key: 'direct_connection', name: 'Direct Connection', 'definition': 'This proof confirms or refutes the specific time, date, location, key actors/subjects, or core event narrative of the OOC (Out of Context) video event.'},
        { key: 'source_transparency', name: 'Source Transparency', 'definition': 'Source clearly identifies author, provides contact info, discloses funding, cites evidence meticulously, has a clear corrections policy, and adheres to it.'},
        { key: 'evidence_integrity', name: 'Evidence Integrity', 'definition': 'Evidence is the verified original, unedited, or significantly more complete footage/data, allowing direct comparison or assessment.' },
        { key: 'fact_verifiability', name: 'Fact Verifiability', definition: 'Presents specific, independently verifiable facts that directly and unambiguously relate to (confirming or refuting) a core element of the OOC narrative.'},
        { key: 'clarity_relevance', name: 'Clarity & Relevance', 'definition': 'Information date is clearly stated, current, and highly relevant to the specific timeframe of the event being verified.' }
    ];

    // --- UI Mode Management ---
    function getMode() {
        return modeToggle.checked ? 'nytimes' : 'politifact';
    }

    function updateUIMode(mode, container = document) {
        const isPolitifact = mode === 'politifact';
        const labels = {
            url: isPolitifact ? 'Politifact URL:' : 'New York Times URL:',
            headline: isPolitifact ? 'Politifact Headline:' : 'New York Times Headline:',
            subheadline: isPolitifact ? 'Politifact Subheadline:' : 'New York Times Subheadline:'
        };
        const placeholders = {
            url: isPolitifact ? 'Enter Politifact URL to auto-fill' : 'Auto-filled from social text or enter NYT URL'
        };

        // Update all labels and placeholders
        container.querySelectorAll('.source-label-url').forEach(el => el.innerHTML = `<i class="bi bi-link-45deg"></i> ${labels.url}`);
        container.querySelectorAll('.source-label-headline').forEach(el => el.innerHTML = `<i class="bi bi-card-heading"></i> ${labels.headline}`);
        container.querySelectorAll('.source-label-subheadline').forEach(el => el.innerHTML = `<i class="bi bi-card-text"></i> ${labels.subheadline}`);
        container.querySelectorAll('.source-input-url').forEach(el => el.placeholder = placeholders.url);

        // ** CHANGE: Set readonly attribute based on mode **
        container.querySelectorAll('.source-input-headline').forEach(el => el.readOnly = isPolitifact);
        container.querySelectorAll('.source-input-subheadline').forEach(el => el.readOnly = isPolitifact);

        // Update the bold text next to the toggle
        const modeSpans = document.querySelectorAll('.card-body .text-secondary');
        modeSpans.forEach(span => span.classList.remove('fw-bold'));
        if (!isPolitifact) {
            modeToggle.parentElement.nextElementSibling.classList.add('fw-bold');
        } else {
            modeToggle.parentElement.previousElementSibling.classList.add('fw-bold');
        }
    }


    // --- Helper Functions ---
    function calculateNextId() {
       const entries = dataContainer.querySelectorAll('.entry-group');
       if (entries.length === 0) return 0;
       let maxId = -1;
       entries.forEach(entry => {
           const id = parseInt(entry.querySelector('input[name$="[id]"]')?.value, 10);
           if (!isNaN(id) && id > maxId) maxId = id;
       });
       return maxId + 1;
    }

    function createOocChecklistHtml(entryIndex, initialData = {}) {
        let checklistHtml = '<div class="ooc-checklist-container border-top border-bottom py-3 my-3">';
        checklistHtml += '<h6 class="mb-3"><i class="bi bi-check2-square"></i> OOC Qualification Checklist</h6>';
        oocCriteria.forEach(criterion => {
            const fieldName = `data[${entryIndex}][ooc_${criterion.key}]`;
            const fieldId = `ooc_${criterion.key}_${entryIndex}`;
            const isChecked = initialData[`ooc_${criterion.key}`] ? 'checked' : '';
            checklistHtml += `
                <div class="form-check mb-2">
                    <input class="form-check-input ooc-checkbox" type="checkbox" name="${fieldName}" id="${fieldId}" value="true" ${isChecked}>
                    <label class="form-check-label" for="${fieldId}" title="${criterion.definition}">
                        <strong>${criterion.name}</strong> <small class="text-muted d-block">${criterion.definition}</small>
                    </label>
                </div>`;
        });
        checklistHtml += '</div>';
        return checklistHtml;
    }

    function createEvidenceChecklistHtml(entryIndex, linkIndex) {
        let checklistHtml = '<div class="evidence-checklist ps-2">';
        checklistHtml += '<strong class="evidence-checklist-title">Evidence Checklist:</strong>';
        evidenceCriteria.forEach((criterion) => {
            const fieldName = `data[${entryIndex}][external_links_info][${linkIndex}][checklist][${criterion.key}]`;
            const fieldId = `evidence_${entryIndex}_${linkIndex}_${criterion.key}`;
            const tooltipAttrs = `data-bs-toggle="tooltip" title="${criterion.definition}"`;
            checklistHtml += `
                <div class="form-check form-check-sm">
                    <input class="form-check-input evidence-checkbox" type="checkbox" name="${fieldName}" id="${fieldId}" value="true">
                    <label class="form-check-label" for="${fieldId}" ${tooltipAttrs}>${criterion.name}</label>
                </div>`;
        });
        checklistHtml += '</div>';
        return checklistHtml;
    }

    function createEntryHtml(id) {
        const entryIndex = dataContainer.children.length;
        // The names of the inputs (politifact_url etc.) are kept the same for backend consistency
        // ** CHANGE: No readonly attributes on headline/subheadline inputs here **
        return `
            <div class="card mb-4 entry-group" data-entry-index="${entryIndex}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span>Entry ID: <input type="text" name="data[${entryIndex}][id]" value="${id}" readonly class="id-readonly-input"></span>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-entry-btn"><i class="bi bi-trash"></i> Remove Entry</button>
                </div>
                ${createOocChecklistHtml(entryIndex)}
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="mb-3 position-relative">
                                <label for="pf_url_${entryIndex}" class="form-label source-label-url"><i class="bi bi-link-45deg"></i> Politifact URL:</label>
                                <input type="url" id="pf_url_${entryIndex}" name="data[${entryIndex}][politifact_url]" value="" class="form-control source-input-url">
                                <div class="spinner-border spinner-border-sm text-secondary position-absolute top-50 end-0 translate-middle-y me-2 d-none" role="status"><span class="visually-hidden">Loading...</span></div>
                            </div>
                            <div class="mb-3">
                                <label for="pf_headline_${entryIndex}" class="form-label source-label-headline"><i class="bi bi-card-heading"></i> Politifact Headline:</label>
                                <input type="text" id="pf_headline_${entryIndex}" name="data[${entryIndex}][politifact_headline]" value="" class="form-control source-input-headline">
                            </div>
                            <div class="mb-3">
                                <label for="pf_subheadline_${entryIndex}" class="form-label source-label-subheadline"><i class="bi bi-card-text"></i> Politifact Subheadline:</label>
                                <input type="text" id="pf_subheadline_${entryIndex}" name="data[${entryIndex}][politifact_subheadline]" value="" class="form-control source-input-subheadline">
                            </div>
                            <hr>
                            <div class="mb-3">
                                <label for="social_link_${entryIndex}" class="form-label"><i class="bi bi-share"></i> Social Link:</label>
                                <input type="url" id="social_link_${entryIndex}" name="data[${entryIndex}][social_link]" value="" class="form-control social-link-input">
                            </div>
                            <div class="row">
                                <div class="col-sm-6 mb-3"><label class="form-label"><i class="bi bi-tags"></i> Social Platform:</label><input type="text" name="data[${entryIndex}][social_platform]" value="" class="form-control" readonly></div>
                                <div class="col-sm-6 mb-3"><label for="social_duration_${entryIndex}" class="form-label"><i class="bi bi-stopwatch"></i> Social Duration (sec):</label><input type="text" id="social_duration_${entryIndex}" name="data[${entryIndex}][social_duration]" value="" class="form-control" readonly placeholder="Auto-filled"></div>
                            </div>
                            <div class="mb-3 narrative-box">
                                <label for="social_text_${entryIndex}" class="form-label"><i class="bi bi-blockquote-left"></i> Social Text (Auto-filled):</label>
                                <textarea id="social_text_${entryIndex}" name="data[${entryIndex}][social_text]" rows="5" class="form-control"></textarea>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3"><label class="form-label d-block"><i class="bi bi-star-half"></i> Rating:</label>${createRadioButtons(`data[${entryIndex}][rating]`, '', entryIndex)}</div>
                            <hr>
                            <div class="mb-3">
                                <label class="form-label"><i class="bi bi-film"></i> Download Video (from Social Link)</label>
                                <div class="input-group mb-1">
                                    <button type="button" class="btn btn-info download-btn" title="Fetch Metadata & Download Video (if < 10 min)"><i class="bi bi-download"></i> Download</button>
                                    <input type="hidden" name="data[${entryIndex}][download_success]" value="false">
                                </div>
                                <textarea name="data[${entryIndex}][download_message]" class="form-control download-message-field" rows="3" readonly placeholder="Download status messages appear here..."></textarea>
                            </div>
                            <div class="mb-3">
                                 <label class="form-label"><i class="bi bi-folder2-open"></i> Drive Path:</label>
                                 <input type="text" name="data[${entryIndex}][drive_path]" value="" class="form-control" readonly>
                            </div>
                        </div>
                    </div>
                    <hr>
                    <div class="mb-3">
                        <label class="form-label"><i class="bi bi-box-arrow-up-right"></i> External Links (Evidence):</label>
                        <div class="external-links-container mb-2"></div>
                        <button type="button" class="btn btn-sm btn-success add-link-btn"><i class="bi bi-plus-circle"></i> Add External Link</button>
                    </div>
                </div>
            </div>`;
    }

    function createRadioButtons(name, selectedValue, index) {
        const ratings = ["full flop", "false", "mostly false", "half true", "mostly true", "true", "unrated"];
        let radiosHtml = '';
        ratings.forEach((rating) => {
            const safeRating = rating.replace(/\s+/g, '_');
            const id = `rating_${index}_${safeRating}`;
            const checked = (rating === selectedValue) ? 'checked' : '';
            radiosHtml += `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" id="${id}" name="${name}" value="${rating}" ${checked}>
                    <label class="form-check-label" for="${id}">${rating.charAt(0).toUpperCase() + rating.slice(1)}</label>
                </div> `;
        });
        return radiosHtml;
    }

    function createExternalLinkHtml(entryIndex, linkIndex, url = '', description = '') {
         const checklistHtml = createEvidenceChecklistHtml(entryIndex, linkIndex);
         return `
            <div class="mb-3 p-3 border rounded external-link-pair" data-link-index="${linkIndex}">
                <div class="row g-2 mb-3">
                    <div class="col"><input type="url" name="data[${entryIndex}][external_links_info][${linkIndex}][url]" value="${url}" class="form-control form-control-sm" placeholder="Evidence URL"></div>
                    <div class="col"><input type="text" name="data[${entryIndex}][external_links_info][${linkIndex}][description]" value="${description}" class="form-control form-control-sm" placeholder="Brief Description"></div>
                    <div class="col-auto"><button type="button" class="btn btn-sm btn-outline-danger remove-link-btn" title="Remove Link"><i class="bi bi-x-lg"></i></button></div>
                </div>
                ${checklistHtml}
            </div>`;
    }

    function attachListenersToEntry(entryElement) {
        const socialLinkInput = entryElement.querySelector('.social-link-input');
        if (socialLinkInput && socialLinkInput.value) { updateSocialPlatform(socialLinkInput); }

        const messageTextarea = entryElement.querySelector('.download-message-field');
        const successInput = entryElement.querySelector('input[name$="[download_success]"]');
        updateMessageFieldStyle(messageTextarea, successInput);

        const sourceUrlInput = entryElement.querySelector('.source-input-url');
        if (getMode() === 'politifact' && sourceUrlInput && sourceUrlInput.value) {
            console.log(`Triggering initial source details fetch for entry index ${entryElement.dataset.entryIndex}`);
            fetchSourceDetails(sourceUrlInput);
        }
    }

    function getSocialPlatform(url) {
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
    }

    function updateSocialPlatform(socialLinkInput) {
        const entryGroup = socialLinkInput.closest('.entry-group');
        if (!entryGroup) return;
        const platformInput = entryGroup.querySelector('input[name$="[social_platform]"]');
        if (platformInput) platformInput.value = getSocialPlatform(socialLinkInput.value);
    }

    function updateMessageFieldStyle(messageField, successInput) {
         if (!messageField || !successInput) return;
         messageField.classList.remove('is-valid', 'is-invalid');
         if (successInput.value === 'true') {
             messageField.classList.add('is-valid');
         } else if (messageField.value && successInput.value === 'false') {
             messageField.classList.add('is-invalid');
         }
     }

    async function fetchSourceDetails(urlInput) {
        const entryGroup = urlInput.closest('.entry-group');
        if (!entryGroup) return;

        const headlineInput = entryGroup.querySelector('.source-input-headline');
        const subheadlineInput = entryGroup.querySelector('.source-input-subheadline');
        const spinner = urlInput.parentElement.querySelector('.spinner-border');
        if (!headlineInput || !subheadlineInput || !spinner) return;

        const url = urlInput.value.trim();
        if (!url || !url.startsWith('http')) {
            headlineInput.value = ''; subheadlineInput.value = '';
            spinner.classList.add('d-none');
            return;
        }

        spinner.classList.remove('d-none');
        urlInput.disabled = true;
        // ** CHANGE: Only make readonly if in politifact mode **
        const isPolitifact = getMode() === 'politifact';
        headlineInput.readOnly = isPolitifact;
        subheadlineInput.readOnly = isPolitifact;

        try {
            const response = await fetch('/get_page_details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });

            const data = await response.json();
            if (!response.ok) {
                headlineInput.value = ''; subheadlineInput.value = '';
            } else {
                headlineInput.value = data.headline || '';
                subheadlineInput.value = data.subheadline || '';
            }
        } catch (error) {
            console.error('Network error fetching source details:', error);
            headlineInput.value = ''; subheadlineInput.value = '';
        } finally {
            spinner.classList.add('d-none');
            urlInput.disabled = false;
        }
    }

    async function handleDownloadProcess(button) {
        const entryGroup = button.closest('.entry-group');
        const socialUrlInput = entryGroup.querySelector('.social-link-input');
        const idInput = entryGroup.querySelector('input[name$="[id]"]');
        const messageTextarea = entryGroup.querySelector('.download-message-field');
        const pathInput = entryGroup.querySelector('input[name$="[drive_path]"]');
        const successInput = entryGroup.querySelector('input[name$="[download_success]"]');
        const durationInput = entryGroup.querySelector('input[name$="[social_duration]"]');
        const socialTextInput = entryGroup.querySelector('textarea[name$="[social_text]"]');

        const url = socialUrlInput.value.trim();
        const id = idInput.value;
        if (!url || id === '' || id === null) {
            messageTextarea.value = "Social Link URL and a valid Entry ID are required.";
            updateMessageFieldStyle(messageTextarea, successInput);
            return;
        }

        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Fetching...';
        messageTextarea.value = "Fetching video metadata...";
        successInput.value = "false";
        updateMessageFieldStyle(messageTextarea, successInput);

        // --- Phase 1: Get Metadata ---
        try {
            const metaResponse = await fetch('/get_video_metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url }),
            });
            const metadataResult = await metaResponse.json();

            if (!metaResponse.ok || !metadataResult.success) {
                messageTextarea.value = `Metadata Error: ${metadataResult.error || 'Unknown server error'}`;
                button.disabled = false; button.innerHTML = '<i class="bi bi-download"></i> Download';
                return;
            }

            durationInput.value = metadataResult.duration.toFixed(2);
            socialTextInput.value = metadataResult.social_text;
            messageTextarea.value = `Metadata OK (Duration: ${durationInput.value}s).`;

            if (getMode() === 'nytimes' && metadataResult.found_article_url) {
                messageTextarea.value += ` Found NYT link, fetching details...`;
                const sourceUrlInput = entryGroup.querySelector('.source-input-url');
                if (sourceUrlInput) {
                    sourceUrlInput.value = metadataResult.found_article_url;
                    await fetchSourceDetails(sourceUrlInput);
                }
            }
        } catch (error) {
            messageTextarea.value = `Network error during metadata fetch: ${error.message}`;
            button.disabled = false; button.innerHTML = '<i class="bi bi-download"></i> Download';
            return;
        }

        // --- Phase 2: Download Video ---
        button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Downloading...';
        messageTextarea.value += `\nProceeding to download video...`;

        try {
            const downloadResponse = await fetch('/download_video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url, id: id }),
            });
            const downloadResult = await downloadResponse.json();

            if (!downloadResponse.ok || !downloadResult.success) {
                messageTextarea.value = `Download Error: ${downloadResult.error || 'Unknown download error'}`;
                pathInput.value = "";
            } else {
                messageTextarea.value = downloadResult.message || "Download successful.";
                pathInput.value = downloadResult.drive_path || "";
                successInput.value = "true";
            }
            updateMessageFieldStyle(messageTextarea, successInput);
        } catch (error) {
            messageTextarea.value = `Network error during download: ${error.message}`;
        } finally {
            button.disabled = false; button.innerHTML = '<i class="bi bi-download"></i> Download';
        }
    }

    function collectDataFromForm() {
        // This function does not need changes, as it collects based on input names which are stable.
        const entries = [];
        const entryElements = dataContainer.querySelectorAll('.entry-group');
        entryElements.forEach((entryElement, entryIndex) => {
            const entryData = {
                id: parseInt(entryElement.querySelector('input[name$="[id]"]')?.value ?? '-1', 10),
                politifact_url: entryElement.querySelector(`.source-input-url`)?.value ?? '',
                politifact_headline: entryElement.querySelector(`.source-input-headline`)?.value ?? '',
                politifact_subheadline: entryElement.querySelector(`.source-input-subheadline`)?.value ?? '',
                rating: entryElement.querySelector(`input[name$="[rating]"]:checked`)?.value ?? '',
                social_link: entryElement.querySelector(`.social-link-input`)?.value ?? '',
                social_platform: entryElement.querySelector(`input[name$="[social_platform]"]`)?.value ?? '',
                social_duration: parseFloat(entryElement.querySelector(`input[name$="[social_duration]"]`)?.value || '0'),
                social_text: entryElement.querySelector(`textarea[name$="[social_text]"]`)?.value ?? '',
                download_success: entryElement.querySelector(`input[name$="[download_success]"]`)?.value === 'true',
                download_message: entryElement.querySelector(`.download-message-field`)?.value ?? '',
                drive_path: entryElement.querySelector(`input[name$="[drive_path]"]`)?.value ?? '',
                external_links_info: [],
            };
            oocCriteria.forEach(c => {
                const cb = entryElement.querySelector(`input[name="data[${entryIndex}][ooc_${c.key}]"]`);
                entryData[`ooc_${c.key}`] = cb ? cb.checked : false;
            });
            const linkPairs = entryElement.querySelectorAll('.external-link-pair');
            linkPairs.forEach((linkPair) => {
                const url = linkPair.querySelector('input[name$="[url]"]')?.value.trim();
                if (url) {
                    const linkData = { url: url, description: linkPair.querySelector('input[name$="[description]"]')?.value.trim() || '', checklist: {} };
                    evidenceCriteria.forEach(c => {
                        const cb = linkPair.querySelector(`input[name$="[checklist][${c.key}]"]`);
                        linkData.checklist[c.key] = cb ? cb.checked : false;
                    });
                    entryData.external_links_info.push(linkData);
                }
            });
            entries.push(entryData);
        });
        entries.forEach((entry, index) => { entry.id = index; });
        return entries;
    }

    // --- Event Listeners Setup ---
    addEntryBtn.addEventListener('click', () => {
        const newEntryHtml = createEntryHtml(calculateNextId());
        dataContainer.insertAdjacentHTML('beforeend', newEntryHtml);
        const newEntryElement = dataContainer.lastElementChild;
        newEntryElement.dataset.entryIndex = Array.from(dataContainer.children).indexOf(newEntryElement);
        updateUIMode(getMode(), newEntryElement);
        initializeTooltips(newEntryElement);
    });

    saveAllBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        const dataToSave = collectDataFromForm();
        saveAllBtn.disabled = true;
        saveAllBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
        try {
            const response = await fetch('/save', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSave),
            });
            if (response.ok) alert('Data saved successfully!');
            else alert(`Error saving data: ${(await response.json()).error || 'Unknown server error'}`);
        } catch (error) {
             alert(`Network error during save: ${error.message}`);
        } finally {
             saveAllBtn.disabled = false; saveAllBtn.innerHTML = '<i class="bi bi-save"></i> Save All Data';
        }
    });

    modeToggle.addEventListener('change', () => updateUIMode(getMode(), dataForm));

    dataContainer.addEventListener('click', (event) => {
        const target = event.target;
        if (target.closest('.remove-link-btn')) target.closest('.external-link-pair').remove();
        if (target.closest('.add-link-btn')) {
             const linksContainer = target.closest('.add-link-btn').previousElementSibling;
             const entryGroup = target.closest('.entry-group');
             const entryIndex = parseInt(entryGroup.dataset.entryIndex, 10);
             const linkIndex = linksContainer.querySelectorAll('.external-link-pair').length;
             const newLinkHtml = createExternalLinkHtml(entryIndex, linkIndex);
             linksContainer.insertAdjacentHTML('beforeend', newLinkHtml);
             initializeTooltips(linksContainer.lastElementChild);
        }
        if (target.closest('.download-btn')) handleDownloadProcess(target.closest('.download-btn'));
        if (target.closest('.remove-entry-btn')) {
             if (confirm('Are you sure?')) target.closest('.entry-group').remove();
        }
    });

    dataContainer.addEventListener('input', (event) => {
        if (event.target.matches('.social-link-input')) updateSocialPlatform(event.target);
    });

    dataContainer.addEventListener('change', (event) => {
        // Only trigger auto-fetch in politifact mode
        if (getMode() === 'politifact' && event.target.matches('.source-input-url')) {
            fetchSourceDetails(event.target);
        }
    });

    // --- Initialization ---
    function initializeTooltips(parentElement = document.body) {
        const tooltipTriggerList = parentElement.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].forEach(el => new bootstrap.Tooltip(el));
    }

    document.querySelectorAll('.entry-group').forEach((entry, index) => {
          entry.dataset.entryIndex = index;
          attachListenersToEntry(entry);
    });
    initializeTooltips();
    updateUIMode(getMode(), dataForm); // Set initial UI mode on page load
});