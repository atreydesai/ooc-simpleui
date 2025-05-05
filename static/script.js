// /ooc-simpleui/static/script.js

document.addEventListener('DOMContentLoaded', () => {
    const dataContainer = document.getElementById('data-container');
    const addEntryBtn = document.getElementById('add-entry-btn');
    const saveAllBtn = document.getElementById('save-all-btn');
    const MAX_DURATION_DISPLAY = 600; // 10 minutes in seconds for frontend check reinforcement

    // --- Data Definitions ---

    // +++ OOC Checklist Criteria Definition +++
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
        { key: 'causal_misattribution', name: 'Causal Misattribution', definition: 'Does the content explicitly state or visually edit to show one event clearly causing another, when the link is incorrect or unproven, but plausible?' }
    ];
    // +++++++++++++++++++++++++++++++++++++++++++

    // +++ Evidence Checklist Criteria Definition +++
    const evidenceCriteria = [
        { key: 'author_expertise', name: 'Author Expertise', definition: 'Author possesses demonstrable, high-level, relevant expertise (e.g., recognized expert, relevant credentials, extensive experience) in the specific subject matter.' },
        { key: 'source_reputation', name: 'Source Reputation', definition: 'Published by a highly reputable source with strong editorial standards (e.g., major int\'l news org, IFCN signatory fact-checker, respected academic journal, official gov\'t body).' },
        { key: 'neutrality_fairness', name: 'Neutrality & Fairness', definition: 'Content is demonstrably objective, neutral in tone, and presents multiple perspectives fairly.' },
        { key: 'fact_vs_opinion', name: 'Fact vs. Opinion', definition: 'Clearly distinguishes fact from opinion.' },
        { key: 'purpose', name: 'Purpose', definition: 'Purpose is primarily informational.' },
        { key: 'definitive_proof', name: 'Definitive Proof', definition: 'Evidence provides definitive proof (e.g., timestamped original footage, precise geolocation, official identification, multiple corroborating accounts, detailed description/footage of the same event).' },
        { key: 'direct_connection', name: 'Direct Connection', definition: 'This proof confirms or refutes the specific time, date, location, key actors/subjects, or core event narrative of the OOC (Out of Context) video event.' },
        { key: 'source_transparency', name: 'Source Transparency', definition: 'Source clearly identifies author, provides contact info, discloses funding, cites evidence meticulously, has a clear corrections policy, and adheres to it.' },
        { key: 'evidence_integrity', name: 'Evidence Integrity', definition: 'Evidence is the verified original, unedited, or significantly more complete footage/data, allowing direct comparison or assessment.' },
        { key: 'fact_verifiability', name: 'Fact Verifiability', definition: 'Presents specific, independently verifiable facts that directly and unambiguously relate to (confirming or refuting) a core element of the OOC narrative.' },
        { key: 'clarity_relevance', name: 'Clarity & Relevance', definition: 'Information date is clearly stated, current, and highly relevant to the specific timeframe of the event being verified.' }
    ];
    // ++++++++++++++++++++++++++++++++++++++++++++


    // --- Helper Functions ---

    function calculateNextId() {
       const entries = dataContainer.querySelectorAll('.entry-group');
       if (entries.length === 0) return 0;
       let maxId = -1;
       entries.forEach(entry => {
           const idInput = entry.querySelector('.card-header input[name$="[id]"]');
           if (idInput) {
               const id = parseInt(idInput.value, 10);
               if (!isNaN(id) && id > maxId) maxId = id;
           }
       });
       return maxId + 1;
    }


    // Helper Function to Create OOC Checklist HTML
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
                        <strong>${criterion.name}</strong>
                        <small class="text-muted d-block">${criterion.definition}</small>
                    </label>
                </div>
            `;
        });

        checklistHtml += '</div>';
        return checklistHtml;
    }

    // Helper function to create Evidence Checklist HTML (for one link)
    function createEvidenceChecklistHtml(entryIndex, linkIndex) {
        let checklistHtml = '<div class="evidence-checklist ps-2">';
        checklistHtml += '<strong class="evidence-checklist-title">Evidence Checklist:</strong>';

        evidenceCriteria.forEach((criterion, criterionIndex) => {
            const fieldName = `data[${entryIndex}][external_links_info][${linkIndex}][checklist][${criterion.key}]`;
            const fieldId = `evidence_${entryIndex}_${linkIndex}_${criterion.key}`;
            // For newly added links, tooltips are always enabled (as they are subsequent links)
            const tooltipAttrs = `data-bs-toggle="tooltip" title="${criterion.definition}"`;

            checklistHtml += `
                <div class="form-check form-check-sm">
                    <input class="form-check-input evidence-checkbox" type="checkbox" name="${fieldName}" id="${fieldId}" value="true">
                    <label class="form-check-label" for="${fieldId}" ${tooltipAttrs}>
                        ${criterion.name}
                        <!-- No inline definition here for dynamically added links -->
                    </label>
                </div>
            `;
        });
        checklistHtml += '</div>'; // End evidence-checklist
        return checklistHtml;
    }


    function createEntryHtml(id) {
        const entryIndex = dataContainer.children.length;
        // Note: politifact_headline and politifact_subheadline inputs are NOT readonly initially here
        return `
            <div class="card mb-4 entry-group" data-entry-index="${entryIndex}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span>Entry ID: <input type="text" name="data[${entryIndex}][id]" value="${id}" readonly class="id-readonly-input"></span>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-entry-btn" title="Remove this entry">
                        <i class="bi bi-trash"></i> Remove Entry
                    </button>
                </div>
                ${createOocChecklistHtml(entryIndex)}
                <div class="card-body">
                    <div class="row g-3">
                        <!-- Column 1 -->
                        <div class="col-md-6">
                            <div class="mb-3 position-relative">
                                <label for="pf_url_${entryIndex}" class="form-label"><i class="bi bi-link-45deg"></i> Politifact URL:</label>
                                <input type="url" id="pf_url_${entryIndex}" name="data[${entryIndex}][politifact_url]" value="" class="form-control politifact-url-input">
                                <div class="spinner-border spinner-border-sm text-secondary position-absolute top-50 end-0 translate-middle-y me-2 d-none" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="pf_headline_${entryIndex}" class="form-label"><i class="bi bi-card-heading"></i> Politifact Headline:</label>
                                <input type="text" id="pf_headline_${entryIndex}" name="data[${entryIndex}][politifact_headline]" value="" class="form-control politifact-headline-input">
                            </div>
                            <div class="mb-3">
                                <label for="pf_subheadline_${entryIndex}" class="form-label"><i class="bi bi-card-text"></i> Politifact Subheadline:</label>
                                <input type="text" id="pf_subheadline_${entryIndex}" name="data[${entryIndex}][politifact_subheadline]" value="" class="form-control politifact-subheadline-input">
                            </div>
                            <hr>
                            <div class="mb-3">
                                <label for="social_link_${entryIndex}" class="form-label"><i class="bi bi-share"></i> Social Link:</label>
                                <input type="url" id="social_link_${entryIndex}" name="data[${entryIndex}][social_link]" value="" class="form-control social-link-input">
                            </div>
                             <div class="row">
                                <div class="col-sm-6 mb-3">
                                    <label class="form-label"><i class="bi bi-tags"></i> Social Platform:</label>
                                    <input type="text" name="data[${entryIndex}][social_platform]" value="" class="form-control" readonly>
                                </div>
                                 <div class="col-sm-6 mb-3">
                                    <label for="social_duration_${entryIndex}" class="form-label"><i class="bi bi-stopwatch"></i> Social Duration (sec):</label>
                                    <input type="text" id="social_duration_${entryIndex}" name="data[${entryIndex}][social_duration]" value="" class="form-control" readonly placeholder="Auto-filled">
                                 </div>
                             </div>
                             <div class="mb-3 narrative-box">
                                 <label for="social_text_${entryIndex}" class="form-label"><i class="bi bi-blockquote-left"></i> Social Text (Auto-filled):</label>
                                 <textarea id="social_text_${entryIndex}" name="data[${entryIndex}][social_text]" rows="5" class="form-control"></textarea>
                             </div>
                        </div>
                        <!-- Column 2 -->
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label d-block"><i class="bi bi-star-half"></i> Rating:</label>
                                ${createRadioButtons(`data[${entryIndex}][rating]`, '', entryIndex)}
                            </div>
                            <hr>
                             <div class="mb-3">
                                <label class="form-label"><i class="bi bi-film"></i> Download Video (from Social Link)</label>
                                <div class="input-group mb-1">
                                    <button type="button" class="btn btn-info download-btn" title="Fetch Metadata & Download Video (if < 10 min)">
                                        <i class="bi bi-download"></i> Download
                                    </button>
                                    <input type="hidden" name="data[${entryIndex}][download_success]" value="false">
                                </div>
                                <textarea name="data[${entryIndex}][download_message]" class="form-control download-message-field" rows="3" readonly placeholder="Download status messages appear here..."></textarea>
                            </div>
                            <div class="mb-3">
                                 <label class="form-label"><i class="bi bi-folder2-open"></i> Drive Path:</label>
                                 <input type="text" name="data[${entryIndex}][drive_path]" value="" class="form-control" readonly>
                            </div>
                        </div>
                    </div> <!-- End row g-3 -->

                    <hr>


                    <div class="mb-3">
                        <label class="form-label"><i class="bi bi-box-arrow-up-right"></i> External Links (Evidence):</label>
                        <div class="external-links-container mb-2">

                        </div>
                        <button type="button" class="btn btn-sm btn-success add-link-btn">
                            <i class="bi bi-plus-circle"></i> Add External Link
                        </button>
                    </div>

                </div> <!-- End card-body -->
            </div> <!-- End card / entry-group -->
        `;
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
                </div> `; // Added space for better wrapping
        });
        return radiosHtml;
    }

    // Modified function to create external link HTML *with* its checklist
    function createExternalLinkHtml(entryIndex, linkIndex, url = '', description = '') {
         const checklistHtml = createEvidenceChecklistHtml(entryIndex, linkIndex);
         return `
            <div class="mb-3 p-3 border rounded external-link-pair" data-link-index="${linkIndex}">
                <div class="row g-2 mb-3">
                    <div class="col">
                        <input type="url" name="data[${entryIndex}][external_links_info][${linkIndex}][url]" value="${url}" class="form-control form-control-sm" placeholder="Evidence URL">
                    </div>
                    <div class="col">
                        <input type="text" name="data[${entryIndex}][external_links_info][${linkIndex}][description]" value="${description}" class="form-control form-control-sm" placeholder="Brief Description">
                    </div>
                    <div class="col-auto">
                        <button type="button" class="btn btn-sm btn-outline-danger remove-link-btn" title="Remove Link"><i class="bi bi-x-lg"></i></button>
                    </div>
                </div>
                ${checklistHtml} 
            </div>
        `;
    }

    function attachListenersToEntry(entryElement) {
        // Existing listeners
        const socialLinkInput = entryElement.querySelector('.social-link-input');
        if (socialLinkInput && socialLinkInput.value) {
             updateSocialPlatform(socialLinkInput);
        }
        const messageTextarea = entryElement.querySelector('.download-message-field');
        const successInput = entryElement.querySelector('input[name$="[download_success]"]');
        updateMessageFieldStyle(messageTextarea, successInput);

        // Politifact Auto-fetch on Load
        const politifactUrlInput = entryElement.querySelector('.politifact-url-input');
        const headlineInput = entryElement.querySelector('.politifact-headline-input');
        const subheadlineInput = entryElement.querySelector('.politifact-subheadline-input');
        if (politifactUrlInput && politifactUrlInput.value && headlineInput && !headlineInput.value && subheadlineInput && !subheadlineInput.value) {
             console.log(`Triggering initial Politifact fetch for entry index ${entryElement.dataset.entryIndex}`);
             fetchPolitifactDetails(politifactUrlInput);
        }
    }

    function getSocialPlatform(url) {
         if (!url) return '';
         try {
             const hostname = new URL(url).hostname.toLowerCase();
             let platform = hostname.replace(/^www\./, '');

             if (hostname.includes('x.com') || hostname.includes('twitter.com') || hostname.includes('t.co')) return 'x';
             if (hostname.includes('facebook.com') || hostname.includes('fb.me') || hostname.includes('fb.watch')) return 'facebook';
             if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) return 'instagram';
             if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
             if (hostname.includes('tiktok.com')) return 'tiktok';
             if (hostname.includes('linkedin.com')) return 'linkedin';
             if (hostname.includes('reddit.com')) return 'reddit';

             const parts = platform.split('.');
             if (parts.length > 2 && parts[parts.length-2] in ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']) { // Added 'edu'
                  return parts[parts.length-3];
             } else if (parts.length > 1) {
                  return parts[parts.length-2];
             } else {
                 return parts[0] || '';
             }
         } catch (e) {
             console.warn("Could not parse URL for platform:", url, e);
             return '';
         }
    }

     function updateSocialPlatform(socialLinkInput) {
        const entryGroup = socialLinkInput.closest('.entry-group');
        if (!entryGroup) return;
        const platformInput = entryGroup.querySelector('input[name$="[social_platform]"]');
        if (!platformInput) return;
        platformInput.value = getSocialPlatform(socialLinkInput.value);
     }

    // Helper to update message field style based on hidden input
    function updateMessageFieldStyle(messageField, successInput) {
         if (!messageField || !successInput) return;
         messageField.classList.remove('is-valid', 'is-invalid'); // Clear previous styles
         if (successInput.value === 'true') {
             messageField.classList.add('is-valid');
         } else if (messageField.value && successInput.value === 'false') { // Only mark invalid if there's a failure message
             messageField.classList.add('is-invalid');
         }
     }


    // Fetch Politifact Headline/Subheadline
    async function fetchPolitifactDetails(urlInput) {
        const entryGroup = urlInput.closest('.entry-group');
        if (!entryGroup) return;

        const headlineInput = entryGroup.querySelector('.politifact-headline-input');
        const subheadlineInput = entryGroup.querySelector('.politifact-subheadline-input');
        const spinner = urlInput.parentElement.querySelector('.spinner-border');

        if (!headlineInput || !subheadlineInput || !spinner) {
            console.error("Missing headline, subheadline, or spinner element for Politifact fetch.");
            return;
        }

        const url = urlInput.value.trim();
        if (!url || !url.startsWith('http')) {
            headlineInput.value = '';
            subheadlineInput.value = '';
            headlineInput.readOnly = false;
            subheadlineInput.readOnly = false;
            spinner.classList.add('d-none');
            return;
        }

        spinner.classList.remove('d-none');
        urlInput.disabled = true;
        headlineInput.readOnly = true;
        subheadlineInput.readOnly = true;

        try {
            const response = await fetch('/get_politifact_details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`Error fetching Politifact details: ${response.status} ${response.statusText}`, errorData);
                headlineInput.value = '';
                subheadlineInput.value = '';
                headlineInput.readOnly = false;
                subheadlineInput.readOnly = false;
            } else {
                const data = await response.json();
                headlineInput.value = data.headline || '';
                subheadlineInput.value = data.subheadline || '';
                headlineInput.readOnly = true;
                subheadlineInput.readOnly = true;
            }

        } catch (error) {
            console.error('Network error fetching Politifact details:', error);
            headlineInput.value = '';
            subheadlineInput.value = '';
            headlineInput.readOnly = false;
            subheadlineInput.readOnly = false;
        } finally {
            spinner.classList.add('d-none');
            urlInput.disabled = false;
        }
    }

    // --- Main Download Logic (Two Phases) ---
    async function handleDownloadProcess(button) {
        const entryGroup = button.closest('.entry-group');
        const socialUrlInput = entryGroup.querySelector('.social-link-input');
        const idInput = entryGroup.querySelector('.card-header input[name$="[id]"]');
        const messageTextarea = entryGroup.querySelector('.download-message-field');
        const pathInput = entryGroup.querySelector('input[name$="[drive_path]"]');
        const successInput = entryGroup.querySelector('input[name$="[download_success]"]');
        const durationInput = entryGroup.querySelector('input[name$="[social_duration]"]');
        const socialTextInput = entryGroup.querySelector('textarea[name$="[social_text]"]');

        if (!socialUrlInput || !idInput || !messageTextarea || !pathInput || !successInput || !durationInput || !socialTextInput) {
            console.error("Missing required elements for download in:", entryGroup);
            alert("Internal error: Cannot initiate download (missing fields). Check console.");
            return;
        }

        const url = socialUrlInput.value.trim();
        const id = idInput.value;

        messageTextarea.value = "";
        pathInput.value = "";
        successInput.value = "false";
        durationInput.value = "";
        updateMessageFieldStyle(messageTextarea, successInput);

        if (!url) {
            messageTextarea.value = "Social Link URL is required.";
            updateMessageFieldStyle(messageTextarea, successInput);
            socialUrlInput.focus();
            return;
        }
         if (id === '' || id === null || isNaN(parseInt(id, 10))) {
             messageTextarea.value = "Valid Entry ID is missing.";
              updateMessageFieldStyle(messageTextarea, successInput);
             return;
         }

        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Fetching...';
        messageTextarea.value = "Fetching video metadata...";

        let metadataResult;
        try {
            const metaResponse = await fetch('/get_video_metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url }),
            });
             metadataResult = await metaResponse.json();

             if (!metaResponse.ok || !metadataResult.success) {
                  let errorMsg = "Unknown metadata error";
                  if (metadataResult.error) errorMsg = metadataResult.error;
                  else if (metadataResult.message) errorMsg = metadataResult.message;
                  else if (!metaResponse.ok) errorMsg = `Server error: ${metaResponse.status} ${metaResponse.statusText}`;
                  messageTextarea.value = `Metadata Error: ${errorMsg}`;
                  successInput.value = "false";
                  updateMessageFieldStyle(messageTextarea, successInput);
                  button.disabled = false;
                  button.innerHTML = '<i class="bi bi-download"></i> Download';
                  return;
              }

            durationInput.value = metadataResult.duration.toFixed(2);
            socialTextInput.value = metadataResult.social_text;
            messageTextarea.value = `Metadata OK (Duration: ${durationInput.value}s). Proceeding to download...`;

        } catch (error) {
            console.error('Metadata fetch error:', error);
            messageTextarea.value = `Network error during metadata fetch: ${error.message}`;
            successInput.value = "false";
            updateMessageFieldStyle(messageTextarea, successInput);
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-download"></i> Download';
            return;
        }

        button.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Downloading...';

        try {
            const downloadResponse = await fetch('/download_video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url, id: id }),
            });
            const downloadResult = await downloadResponse.json();

             if (!downloadResponse.ok || !downloadResult.success) {
                  let errorMsg = "Unknown download error";
                  if (downloadResult.error) errorMsg = downloadResult.error;
                  else if (downloadResult.message) errorMsg = downloadResult.message;
                  else if (!downloadResponse.ok) errorMsg = `Server error: ${downloadResponse.status} ${downloadResponse.statusText}`;
                  messageTextarea.value = `Download Error: ${errorMsg}`;
                  successInput.value = "false";
                  pathInput.value = "";
              } else {
                messageTextarea.value = downloadResult.message || "Download successful.";
                pathInput.value = downloadResult.drive_path || "";
                successInput.value = "true";
            }
            updateMessageFieldStyle(messageTextarea, successInput);

        } catch (error) {
            console.error('Download error:', error);
            messageTextarea.value = `Network error during download: ${error.message}`;
            successInput.value = "false";
            pathInput.value = "";
            updateMessageFieldStyle(messageTextarea, successInput);
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-download"></i> Download';
        }
    }


    function collectDataFromForm() {
        const entries = [];
        const entryElements = dataContainer.querySelectorAll('.entry-group');

        entryElements.forEach((entryElement, entryIndex) => { // Use index for ID assignment later
             const idInput = entryElement.querySelector('.card-header input[name$="[id]"]');
             const socialDurationValue = entryElement.querySelector(`input[name$="[social_duration]"]`)?.value;

             // Base entry data
             const entryData = {
                id: parseInt(idInput?.value ?? '-1', 10), // Placeholder, overwritten later
                politifact_url: entryElement.querySelector(`.politifact-url-input`)?.value ?? '',
                politifact_headline: entryElement.querySelector(`.politifact-headline-input`)?.value ?? '',
                politifact_subheadline: entryElement.querySelector(`.politifact-subheadline-input`)?.value ?? '',
                rating: entryElement.querySelector(`input[name$="[rating]"]:checked`)?.value ?? '',
                social_link: entryElement.querySelector(`.social-link-input`)?.value ?? '',
                social_platform: entryElement.querySelector(`input[name$="[social_platform]"]`)?.value ?? '',
                social_duration: parseFloat(socialDurationValue ?? '0'),
                social_text: entryElement.querySelector(`textarea[name$="[social_text]"]`)?.value ?? '',
                external_links_info: [], // Will be populated below
                download_success: entryElement.querySelector(`input[name$="[download_success]"]`)?.value === 'true',
                download_message: entryElement.querySelector(`.download-message-field`)?.value ?? '',
                drive_path: entryElement.querySelector(`input[name$="[drive_path]"]`)?.value ?? '',
             };

             // Collect OOC Checklist Data
             oocCriteria.forEach(criterion => {
                 const checkbox = entryElement.querySelector(`input[name="data[${entryIndex}][ooc_${criterion.key}]"]`);
                 entryData[`ooc_${criterion.key}`] = checkbox ? checkbox.checked : false;
             });

             if (isNaN(entryData.id)) entryData.id = -1;
             if (isNaN(entryData.social_duration)) entryData.social_duration = 0.0;

            // Collect external links and their checklists
            const linkPairs = entryElement.querySelectorAll('.external-links-container .external-link-pair');
            linkPairs.forEach((linkPairElement, linkIndex) => { // Use linkIndex here
                 const urlInput = linkPairElement.querySelector(`input[name$="[url]"]`);
                 const descInput = linkPairElement.querySelector(`input[name$="[description]"]`);

                 if (urlInput && descInput && urlInput.value.trim()) {
                     const linkData = {
                         url: urlInput.value.trim(),
                         description: descInput.value.trim() || '',
                         checklist: {} // Prepare checklist object for this link
                     };

                     // Collect evidence checklist data for this specific link
                     evidenceCriteria.forEach(criterion => {
                          const checklistCheckbox = linkPairElement.querySelector(`input[name$="[checklist][${criterion.key}]"]`);
                          linkData.checklist[criterion.key] = checklistCheckbox ? checklistCheckbox.checked : false;
                     });

                     entryData.external_links_info.push(linkData);
                 }
            });
            entries.push(entryData);
        });

        // Re-assign sequential IDs before returning
        entries.forEach((entry, index) => { entry.id = index; });
        return entries;
    }

    // --- Event Listeners Setup ---

    addEntryBtn.addEventListener('click', () => {
        const currentId = calculateNextId();
        const newEntryHtml = createEntryHtml(currentId);
        dataContainer.insertAdjacentHTML('beforeend', newEntryHtml);
        const newEntryElement = dataContainer.lastElementChild;
        const newIndex = Array.from(dataContainer.children).indexOf(newEntryElement);
        newEntryElement.dataset.entryIndex = newIndex;
        // Initialize tooltips for the newly added entry (specifically for its potential links later)
        initializeTooltips(newEntryElement);
    });

    saveAllBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        const dataToSave = collectDataFromForm();
        saveAllBtn.disabled = true;
        saveAllBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        try {
            const response = await fetch('/save', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSave),
            });
            if (response.ok) {
                 alert('Data saved successfully!');
                 // Consider reloading to see saved state cleanly, esp. with complex nested data
                 // location.reload();
            }
            else {
                 const errorData = await response.json().catch(() => ({ error: response.statusText }));
                 alert(`Error saving data: ${errorData.error || 'Unknown server error'}`);
            }
        } catch (error) {
             alert(`Network error during save: ${error.message}`);
             console.error("Save error:", error);
        }
        finally {
             saveAllBtn.disabled = false;
             saveAllBtn.innerHTML = '<i class="bi bi-save"></i> Save All Data';
        }
    });

    // --- Event Delegation for Dynamic Elements ---
    dataContainer.addEventListener('click', (event) => {
        // Remove External Link Button
        const removeLinkBtn = event.target.closest('.remove-link-btn');
        if (removeLinkBtn) {
            const linkPair = removeLinkBtn.closest('.external-link-pair');
            if (linkPair) {
                // Dispose tooltips within the element being removed (good practice)
                const tooltips = bootstrap.Tooltip.getInstance(linkPair.querySelectorAll('[data-bs-toggle="tooltip"]'));
                 if (tooltips && typeof tooltips.dispose === 'function') { // Check if it's a single instance or needs iteration
                     // If multiple tooltips, querySelectorAll and loop might be needed
                    try { tooltips.dispose(); } catch(e) { console.warn("Tooltip disposal issue", e); }
                 } else { // More robustly handle multiple tooltips if initialized individually
                    linkPair.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
                        const instance = bootstrap.Tooltip.getInstance(el);
                        if(instance) instance.dispose();
                    });
                 }
                linkPair.remove();
                 // Optional: Re-index data-link-index attributes if needed
            }
            return; // Handled
        }

        // Add External Link Button
        const addLinkBtn = event.target.closest('.add-link-btn');
        if (addLinkBtn) {
             const linksContainer = addLinkBtn.previousElementSibling; // .external-links-container
             const entryGroup = addLinkBtn.closest('.entry-group');
             const entryIndex = parseInt(entryGroup.dataset.entryIndex, 10);
             // Find next link index based on existing link pairs within *this* entry
             const linkIndex = linksContainer.querySelectorAll('.external-link-pair').length;

             if (!isNaN(entryIndex)) {
                 const newLinkHtml = createExternalLinkHtml(entryIndex, linkIndex);
                 linksContainer.insertAdjacentHTML('beforeend', newLinkHtml);
                 // Initialize tooltips for the *newly added* link only
                 const newLinkElement = linksContainer.lastElementChild;
                 initializeTooltips(newLinkElement);
             } else {
                 console.error("Could not determine entry index for adding link.");
             }
             return; // Handled
        }

        // Download Video Button
        const downloadBtn = event.target.closest('.download-btn');
        if (downloadBtn) {
            handleDownloadProcess(downloadBtn);
            return; // Handled
        }

        // Remove Entry Button
        const removeEntryBtn = event.target.closest('.remove-entry-btn');
         if (removeEntryBtn) {
             if (confirm('Are you sure you want to remove this entire entry?')) {
                 const entryToRemove = removeEntryBtn.closest('.entry-group');
                 // Dispose any tooltips within the entry before removing
                 entryToRemove.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
                    const instance = bootstrap.Tooltip.getInstance(el);
                    if(instance) instance.dispose();
                 });
                 entryToRemove.remove();
                 // Optional: Renumber remaining entries' data-entry-index
             }
              return; // Handled
         }
    });

    // Event Delegation for Input/Change Events
    dataContainer.addEventListener('input', (event) => {
        if (event.target.matches('.social-link-input')) {
             updateSocialPlatform(event.target);
        }
     });

     dataContainer.addEventListener('change', (event) => {
         if (event.target.matches('.politifact-url-input')) {
             fetchPolitifactDetails(event.target);
         }
     });

     // --- Initialization ---

     // Initialize Bootstrap Tooltips
     function initializeTooltips(parentElement = document.body) {
        const tooltipTriggerList = parentElement.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].forEach(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
        console.log(`Tooltips initialized for ${tooltipTriggerList.length} elements within`, parentElement);
     }

     // Initial setup for existing entries and tooltips
     document.querySelectorAll('.entry-group').forEach((entry, index) => {
          entry.dataset.entryIndex = index; // Ensure initial indices are set
          attachListenersToEntry(entry); // Attach other listeners
     });
     initializeTooltips(); // Initialize tooltips for the whole page on load


}); // End DOMContentLoaded