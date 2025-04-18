// /ooc-simpleui/static/script.js

document.addEventListener('DOMContentLoaded', () => {
    const dataContainer = document.getElementById('data-container');
    const addEntryBtn = document.getElementById('add-entry-btn');
    const saveAllBtn = document.getElementById('save-all-btn');
    const MAX_DURATION_DISPLAY = 600; // 10 minutes in seconds for frontend check reinforcement

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
                            <hr>
                            <div class="mb-3">
                                <label class="form-label"><i class="bi bi-box-arrow-up-right"></i> External Links:</label>
                                <div class="external-links-container mb-2"></div>
                                <button type="button" class="btn btn-sm btn-success add-link-btn">
                                    <i class="bi bi-plus-circle"></i> Add External Link
                                </button>
                            </div>
                        </div>
                    </div> <!-- End row -->
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

    function createExternalLinkHtml(entryIndex, linkIndex, url = '', description = '') {
         return `
            <div class="row g-2 mb-2 external-link-pair">
                <div class="col"><input type="url" name="data[${entryIndex}][external_links_info][${linkIndex}][url]" value="${url}" class="form-control form-control-sm" placeholder="URL"></div>
                <div class="col"><input type="text" name="data[${entryIndex}][external_links_info][${linkIndex}][description]" value="${description}" class="form-control form-control-sm" placeholder="Description"></div>
                <div class="col-auto"><button type="button" class="btn btn-sm btn-outline-danger remove-link-btn" title="Remove Link"><i class="bi bi-x-lg"></i></button></div>
            </div> `;
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

        // --- Politifact Auto-fetch on Load (Optional but good) ---
        // If the page loads with a politifact URL but empty headline/subheadline,
        // trigger the fetch automatically.
        const politifactUrlInput = entryElement.querySelector('.politifact-url-input');
        const headlineInput = entryElement.querySelector('.politifact-headline-input');
        const subheadlineInput = entryElement.querySelector('.politifact-subheadline-input');
        if (politifactUrlInput && politifactUrlInput.value && headlineInput && !headlineInput.value && subheadlineInput && !subheadlineInput.value) {
             console.log(`Triggering initial Politifact fetch for entry index ${entryElement.dataset.entryIndex}`);
             fetchPolitifactDetails(politifactUrlInput); // Call the fetch function
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


    // --- +++ NEW: Fetch Politifact Headline/Subheadline +++ ---
    async function fetchPolitifactDetails(urlInput) {
        const entryGroup = urlInput.closest('.entry-group');
        if (!entryGroup) return;

        const headlineInput = entryGroup.querySelector('.politifact-headline-input');
        const subheadlineInput = entryGroup.querySelector('.politifact-subheadline-input');
        const spinner = urlInput.parentElement.querySelector('.spinner-border'); // Find spinner near URL input

        if (!headlineInput || !subheadlineInput || !spinner) {
            console.error("Missing headline, subheadline, or spinner element for Politifact fetch.");
            return;
        }

        const url = urlInput.value.trim();

        // Clear previous results and remove readonly if URL is cleared or invalid
        if (!url || !url.startsWith('http')) {
            headlineInput.value = '';
            subheadlineInput.value = '';
            headlineInput.readOnly = false;
            subheadlineInput.readOnly = false;
            spinner.classList.add('d-none'); // Hide spinner
            return; // Stop if URL is invalid or empty
        }

        // Show spinner and disable inputs temporarily
        spinner.classList.remove('d-none');
        urlInput.disabled = true;
        headlineInput.readOnly = true; // Make readonly during fetch
        subheadlineInput.readOnly = true; // Make readonly during fetch

        try {
            const response = await fetch('/get_politifact_details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Graceful JSON parse
                console.error(`Error fetching Politifact details: ${response.status} ${response.statusText}`, errorData);
                // On error, clear fields and make editable again
                headlineInput.value = '';
                subheadlineInput.value = '';
                headlineInput.readOnly = false;
                subheadlineInput.readOnly = false;
                 // Optionally show an error message to the user
                 // alert(`Failed to fetch details: ${errorData.error || 'Server error'}`);
            } else {
                const data = await response.json();
                headlineInput.value = data.headline || '';
                subheadlineInput.value = data.subheadline || '';
                // Keep them readonly after successful fetch
                headlineInput.readOnly = true;
                subheadlineInput.readOnly = true;
            }

        } catch (error) {
            console.error('Network error fetching Politifact details:', error);
            // On network error, also clear and make editable
            headlineInput.value = '';
            subheadlineInput.value = '';
            headlineInput.readOnly = false;
            subheadlineInput.readOnly = false;
            // alert(`Network error fetching details: ${error.message}`);
        } finally {
            // Hide spinner and re-enable URL input
            spinner.classList.add('d-none');
            urlInput.disabled = false;
        }
    }
    // --- +++ END: Fetch Politifact Headline/Subheadline +++ ---

    // --- Main Download Logic (Two Phases) ---
    async function handleDownloadProcess(button) {
        const entryGroup = button.closest('.entry-group');
        // Use more specific selectors targeting elements within this entryGroup
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

        // --- Reset fields ---
        messageTextarea.value = "";
        pathInput.value = "";
        successInput.value = "false";
        durationInput.value = ""; // Clear old duration
        // Don't clear socialTextInput automatically, but update it later
        updateMessageFieldStyle(messageTextarea, successInput); // Clear styles

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

        // --- Phase 1: Get Metadata & Check Duration ---
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
             metadataResult = await metaResponse.json(); // Assume server always returns JSON, even for errors

             // Check status code AND success flag from backend
             if (!metaResponse.ok || !metadataResult.success) {
                  let errorMsg = "Unknown metadata error";
                  if (metadataResult.error) {
                      errorMsg = metadataResult.error;
                  } else if (metadataResult.message) { // Handle duration exceeded message
                      errorMsg = metadataResult.message;
                  } else if (!metaResponse.ok) {
                      errorMsg = `Server error: ${metaResponse.status} ${metaResponse.statusText}`;
                  }
                  messageTextarea.value = `Metadata Error: ${errorMsg}`;
                  successInput.value = "false";
                  updateMessageFieldStyle(messageTextarea, successInput);
                  button.disabled = false;
                  button.innerHTML = '<i class="bi bi-download"></i> Download';
                  return; // Stop the process
              }

            // Metadata Success - Populate fields
            durationInput.value = metadataResult.duration.toFixed(2); // Format to 2 decimal places
            socialTextInput.value = metadataResult.social_text; // Auto-fill social text
            messageTextarea.value = `Metadata OK (Duration: ${durationInput.value}s). Proceeding to download...`;
            // No style change yet, wait for download result

        } catch (error) {
            console.error('Metadata fetch error:', error);
            messageTextarea.value = `Network error during metadata fetch: ${error.message}`;
            successInput.value = "false";
            updateMessageFieldStyle(messageTextarea, successInput);
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-download"></i> Download';
            return; // Stop the process
        }

        // --- Phase 2: Download Video ---
        button.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Downloading...';

        try {
            const downloadResponse = await fetch('/download_video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url, id: id }),
            });

            const downloadResult = await downloadResponse.json(); // Assume JSON return

             // Check status code AND success flag
             if (!downloadResponse.ok || !downloadResult.success) {
                  let errorMsg = "Unknown download error";
                  if (downloadResult.error) {
                      errorMsg = downloadResult.error;
                  } else if (downloadResult.message) {
                      errorMsg = downloadResult.message; // e.g., "Download failed..."
                  } else if (!downloadResponse.ok) {
                       errorMsg = `Server error: ${downloadResponse.status} ${downloadResponse.statusText}`;
                  }
                  messageTextarea.value = `Download Error: ${errorMsg}`;
                  successInput.value = "false";
                  pathInput.value = ""; // Clear path on failure
              } else {
                // Download Success
                messageTextarea.value = downloadResult.message || "Download successful.";
                pathInput.value = downloadResult.drive_path || "";
                successInput.value = "true";
            }
            updateMessageFieldStyle(messageTextarea, successInput); // Update style based on final result

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

        entryElements.forEach((entryElement) => {
             const idInput = entryElement.querySelector('.card-header input[name$="[id]"]');
             // Read the possibly auto-filled (but readonly) duration
             const socialDurationValue = entryElement.querySelector(`input[name$="[social_duration]"]`)?.value;

            const entryData = {
                id: parseInt(idInput?.value ?? '0', 10),
                politifact_url: entryElement.querySelector(`.politifact-url-input`)?.value ?? '', // Use class
                politifact_headline: entryElement.querySelector(`.politifact-headline-input`)?.value ?? '', // Use class
                politifact_subheadline: entryElement.querySelector(`.politifact-subheadline-input`)?.value ?? '', // Use class
                rating: entryElement.querySelector(`input[name$="[rating]"]:checked`)?.value ?? '',
                social_link: entryElement.querySelector(`.social-link-input`)?.value ?? '',
                social_platform: entryElement.querySelector(`input[name$="[social_platform]"]`)?.value ?? '',
                social_duration: parseFloat(socialDurationValue ?? '0'),
                social_text: entryElement.querySelector(`textarea[name$="[social_text]"]`)?.value ?? '',
                external_links_info: [],
                download_success: entryElement.querySelector(`input[name$="[download_success]"]`)?.value === 'true',
                download_message: entryElement.querySelector(`.download-message-field`)?.value ?? '',
                drive_path: entryElement.querySelector(`input[name$="[drive_path]"]`)?.value ?? '',
            };

             if (isNaN(entryData.id)) entryData.id = 0; // Should not happen with readonly input, but safe check
             if (isNaN(entryData.social_duration)) entryData.social_duration = 0.0;

            // Collect external links
            const linkPairs = entryElement.querySelectorAll('.external-links-container .external-link-pair');
            linkPairs.forEach((pair) => {
                 const urlInput = pair.querySelector(`input[type="url"]`);
                 const descInput = pair.querySelector(`input[type="text"]`);
                 if (urlInput && descInput && urlInput.value.trim()) {
                     entryData.external_links_info.push({ url: urlInput.value.trim(), description: descInput.value.trim() || '' });
                 }
            });
            entries.push(entryData);
        });

        // Re-assign sequential IDs before returning - Important for consistency
        entries.forEach((entry, index) => { entry.id = index; });
        return entries;
    }

    // --- Event Listeners Setup ---

    addEntryBtn.addEventListener('click', () => {
        const currentId = calculateNextId();
        const newEntryHtml = createEntryHtml(currentId);
        dataContainer.insertAdjacentHTML('beforeend', newEntryHtml);
        const newEntryElement = dataContainer.lastElementChild;
        // Re-calculate index after adding
        const newIndex = Array.from(dataContainer.children).indexOf(newEntryElement);
        newEntryElement.dataset.entryIndex = newIndex;
        // No need to call attachListenersToEntry here, event delegation handles dynamic elements
    });

    saveAllBtn.addEventListener('click', async (event) => {
        event.preventDefault(); // Prevent default form submission if it were inside a <form> tag with submit type
        const dataToSave = collectDataFromForm(); // Collects current state, including potentially auto-filled fields
        saveAllBtn.disabled = true;
        saveAllBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        try {
            const response = await fetch('/save', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSave),
            });
            if (response.ok) {
                 alert('Data saved successfully!');
                 // Optional: Reload or update UI state if needed after save
                 // location.reload(); // Simplest way to reflect saved state including IDs
            }
            else {
                 const errorData = await response.json().catch(() => ({ error: response.statusText })); // Graceful error parse
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
            removeLinkBtn.closest('.external-link-pair').remove();
            return; // Handled
        }

        // Add External Link Button
        const addLinkBtn = event.target.closest('.add-link-btn');
        if (addLinkBtn) {
             const linksContainer = addLinkBtn.previousElementSibling; // Assumes container is right before button
             const entryGroup = addLinkBtn.closest('.entry-group');
             const entryIndex = parseInt(entryGroup.dataset.entryIndex, 10);
             const linkIndex = linksContainer.children.length; // Next index
             if (!isNaN(entryIndex)) {
                 linksContainer.insertAdjacentHTML('beforeend', createExternalLinkHtml(entryIndex, linkIndex));
             } else {
                 console.error("Could not determine entry index for adding link.");
             }
             return; // Handled
        }

        // Download Video Button
        const downloadBtn = event.target.closest('.download-btn');
        if (downloadBtn) {
            handleDownloadProcess(downloadBtn); // Call the download handler
            return; // Handled
        }

        // Remove Entry Button
        const removeEntryBtn = event.target.closest('.remove-entry-btn');
         if (removeEntryBtn) {
             if (confirm('Are you sure you want to remove this entire entry?')) {
                 const entryToRemove = removeEntryBtn.closest('.entry-group');
                 entryToRemove.remove();
                 // Optional: Renumber remaining entries' data-entry-index if needed, although collectData handles IDs on save.
             }
              return; // Handled
         }
    });

    // Event Delegation for Input/Change Events
    dataContainer.addEventListener('input', (event) => {
        // Update social platform when social link changes
        if (event.target.matches('.social-link-input')) {
             updateSocialPlatform(event.target);
        }
        // Add other 'input' listeners here if needed
     });

     dataContainer.addEventListener('change', (event) => {
         // Fetch politifact details when URL changes (and loses focus)
         if (event.target.matches('.politifact-url-input')) {
             fetchPolitifactDetails(event.target);
         }
         // Add other 'change' listeners here if needed
     });

    // --- Initialization ---
    document.querySelectorAll('.entry-group').forEach((entry, index) => {
         entry.dataset.entryIndex = index; // Ensure initial indices are set
         attachListenersToEntry(entry); // Attach listeners needed on load (like platform update, auto-fetch)
    });

}); // End DOMContentLoaded