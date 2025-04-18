document.addEventListener('DOMContentLoaded', () => {
    const dataContainer = document.getElementById('data-container');
    const addEntryBtn = document.getElementById('add-entry-btn');
    const saveAllBtn = document.getElementById('save-all-btn');
    const form = document.getElementById('data-form'); // Get the form itself

    let nextId = calculateNextId();

    // --- Event Listeners ---

    // Add New Entry Button
    addEntryBtn.addEventListener('click', () => {
        const newEntryHtml = createEntryHtml(nextId);
        dataContainer.insertAdjacentHTML('beforeend', newEntryHtml);
        attachListenersToEntry(dataContainer.lastElementChild); // Attach listeners to the new entry
        nextId++;
    });

    // Save All Button (Using Fetch API to send JSON)
    saveAllBtn.addEventListener('click', async (event) => {
        event.preventDefault(); // Prevent traditional form submission
        const data = collectDataFromForm();
        // console.log("Sending data:", JSON.stringify(data, null, 2)); // For debugging

        try {
            const response = await fetch('/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                alert('Data saved successfully!');
                // Optional: reload page or update UI minimally
                // window.location.reload();
            } else {
                const errorData = await response.json();
                alert(`Error saving data: ${errorData.error || response.statusText}`);
            }
        } catch (error) {
            console.error('Save error:', error);
            alert(`Network or server error during save: ${error}`);
        }
    });

    // --- Event Delegation for dynamic elements ---
    dataContainer.addEventListener('click', (event) => {
        // Remove External Link Button
        if (event.target.classList.contains('remove-link-btn')) {
            event.target.closest('.external-link-pair').remove();
        }
        // Add External Link Button
        else if (event.target.classList.contains('add-link-btn')) {
            const linksContainer = event.target.previousElementSibling; // The div holding the links
            const entryGroup = event.target.closest('.entry-group');
            const entryIndex = Array.from(dataContainer.children).indexOf(entryGroup);
            const linkIndex = linksContainer.children.length; // Next index for the new link
            const newLinkHtml = createExternalLinkHtml(entryIndex, linkIndex);
            linksContainer.insertAdjacentHTML('beforeend', newLinkHtml);
            // Re-attach listener isn't strictly needed here due to delegation,
            // but good practice if we had more complex interactions.
        }
        // Download Video Button
        else if (event.target.classList.contains('download-btn')) {
            handleDownload(event.target);
        }
         // Remove Entry Button
        else if (event.target.classList.contains('remove-entry-btn')) {
            if (confirm('Are you sure you want to remove this entire entry?')) {
                 event.target.closest('.entry-group').remove();
                 // Note: IDs won't be contiguous anymore after removal until next save.
                 // Saving will re-index if necessary (handled server-side is best)
                 // Or recalculate client-side if needed before save.
            }
        }
    });

     // Update Social Platform on Social Link change (using delegation)
     dataContainer.addEventListener('input', (event) => {
        if (event.target.matches('input[name$="[social_link]"]')) {
             updateSocialPlatform(event.target);
        }
     });


    // --- Initialization ---
    // Attach listeners to initially loaded entries
    document.querySelectorAll('.entry-group').forEach(entry => {
        attachListenersToEntry(entry);
    });

    // --- Helper Functions ---

    function calculateNextId() {
       const entries = dataContainer.querySelectorAll('.entry-group');
       if (entries.length === 0) {
           return 0;
       }
       // Find the highest existing ID and add 1
       let maxId = -1;
       entries.forEach(entry => {
           const idInput = entry.querySelector('input[name$="[id]"]');
           if (idInput) {
               const id = parseInt(idInput.value, 10);
               if (!isNaN(id) && id > maxId) {
                   maxId = id;
               }
           }
       });
       return maxId + 1;
    }

    function createEntryHtml(id) {
        const entryIndex = dataContainer.children.length; // This will be the index in the form data
        return `
            <div class="entry-group" data-entry-index="${entryIndex}">
                <button type="button" class="remove-entry-btn" title="Remove this entry">X</button>
                <label>ID:</label>
                <input type="text" name="data[${entryIndex}][id]" value="${id}" readonly>

                <label for="pf_url_${entryIndex}">Politifact URL:</label>
                <input type="url" id="pf_url_${entryIndex}" name="data[${entryIndex}][politifact_url]" value="">

                <label for="pf_headline_${entryIndex}">Politifact Headline:</label>
                <input type="text" id="pf_headline_${entryIndex}" name="data[${entryIndex}][politifact_headline]" value="">

                <label for="pf_subheadline_${entryIndex}">Politifact Subheadline:</label>
                <input type="text" id="pf_subheadline_${entryIndex}" name="data[${entryIndex}][politifact_subheadline]" value="">

                <label>Rating:</label>
                <div class="radio-group">
                    ${createRadioButtons(`data[${entryIndex}][rating]`, '')}
                </div>

                <label for="vid_duration_${entryIndex}">Video Duration (Politifact):</label>
                <input type="text" id="vid_duration_${entryIndex}" name="data[${entryIndex}][video_duration]" value="">

                <label for="social_link_${entryIndex}">Social Link:</label>
                <input type="url" id="social_link_${entryIndex}" name="data[${entryIndex}][social_link]" value="">

                <label>Social Platform:</label>
                <input type="text" name="data[${entryIndex}][social_platform]" value="" readonly>

                <label for="social_duration_${entryIndex}">Social Duration (seconds):</label>
                <input type="number" step="any" id="social_duration_${entryIndex}" name="data[${entryIndex}][social_duration]" value="">

                <label for="social_text_${entryIndex}">Social Text:</label>
                <textarea id="social_text_${entryIndex}" name="data[${entryIndex}][social_text]" rows="3"></textarea>

                <label>External Links:</label>
                <div class="external-links-container">
                    <!-- Links added here -->
                </div>
                <button type="button" class="add-link-btn">Add External Link</button>

                <label>Download Status:</label>
                 <button type="button" class="download-btn">Download Video</button>
                 <input type="text" name="data[${entryIndex}][download_message]" value="" readonly placeholder="Download status message...">
                 <input type="hidden" name="data[${entryIndex}][download_success]" value="false"> <!-- Store success state -->


                <label>Drive Path:</label>
                <input type="text" name="data[${entryIndex}][drive_path]" value="" readonly>
            </div>
        `;
    }

     function createRadioButtons(name, selectedValue) {
        const ratings = ["full flop", "false", "mostly false", "half true", "mostly true", "true", "unrated"];
        let radiosHtml = '';
        ratings.forEach(rating => {
            const id = `${name}_${rating.replace(/\s+/g, '_')}`; // Create unique ID
            const checked = (rating === selectedValue) ? 'checked' : '';
            radiosHtml += `
                <label for="${id}">
                    <input type="radio" id="${id}" name="${name}" value="${rating}" ${checked}>
                    ${rating.charAt(0).toUpperCase() + rating.slice(1)}
                </label>
            `;
        });
        return radiosHtml;
    }

    function createExternalLinkHtml(entryIndex, linkIndex, url = '', description = '') {
         // Ensure names match the expected structure for Flask parsing if using request.form
         // Or structure for easy JS collection if sending JSON
         return `
            <div class="external-link-pair">
                <input type="url" name="data[${entryIndex}][external_links_info][${linkIndex}][url]" value="${url}" placeholder="URL">
                <input type="text" name="data[${entryIndex}][external_links_info][${linkIndex}][description]" value="${description}" placeholder="Description">
                <button type="button" class="remove-link-btn">Remove</button>
            </div>
        `;
    }


    function attachListenersToEntry(entryElement) {
        // Find the social link input within this specific entry
        const socialLinkInput = entryElement.querySelector('input[name$="[social_link]"]');
        if (socialLinkInput) {
             // Attach the input listener directly (or rely on delegation)
             // socialLinkInput.addEventListener('input', () => updateSocialPlatform(socialLinkInput));
             // Initial check in case data is loaded
             updateSocialPlatform(socialLinkInput);
        }

        // Find the download button within this entry
        const downloadButton = entryElement.querySelector('.download-btn');
        if (downloadButton) {
             // downloadButton.addEventListener('click', () => handleDownload(downloadButton)); // Or rely on delegation
        }

         // Find Add External Link button
        const addLinkBtn = entryElement.querySelector('.add-link-btn');
        if (addLinkBtn) {
            // addLinkBtn.addEventListener('click', () => { /* Handled by delegation */ });
        }

         // Add listener for Remove Entry button (optional if using delegation)
        const removeEntryBtn = entryElement.querySelector('.remove-entry-btn');
        if(removeEntryBtn) {
            // removeEntryBtn.addEventListener('click', () => { /* Handled by delegation */ });
        }

        // Find remove link buttons (optional if using delegation)
        entryElement.querySelectorAll('.remove-link-btn').forEach(btn => {
           // btn.addEventListener('click', () => btn.closest('.external-link-pair').remove());
        });
    }

    function getSocialPlatform(url) {
        if (!url) return '';
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            // Basic stripping
            let platform = hostname.replace(/^www\./, ''); // Remove www.
            platform = platform.substring(0, platform.lastIndexOf('.')); // Remove TLD like .com, .org

             // Handle common shorteners and specific domains
            if (hostname.includes('x.com') || hostname.includes('twitter.com') || hostname.includes('t.co')) return 'x'; // Or 'twitter'
            if (hostname.includes('facebook.com') || hostname.includes('fb.me') || hostname.includes('fb.watch')) return 'facebook';
            if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) return 'instagram';
            if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
            if (hostname.includes('tiktok.com')) return 'tiktok';
            if (hostname.includes('linkedin.com')) return 'linkedin';
            if (hostname.includes('reddit.com')) return 'reddit';
            // Add more rules as needed

            return platform; // Return the stripped hostname if no specific rule matches
        } catch (e) {
            console.error("Error parsing URL for platform:", url, e);
            return ''; // Invalid URL
        }
    }

     function updateSocialPlatform(socialLinkInput) {
        const entryGroup = socialLinkInput.closest('.entry-group');
        if (!entryGroup) return;
        const platformInput = entryGroup.querySelector('input[name$="[social_platform]"]');
        if (!platformInput) return;

        const platform = getSocialPlatform(socialLinkInput.value);
        platformInput.value = platform;
     }


    async function handleDownload(button) {
        const entryGroup = button.closest('.entry-group');
        const urlInput = entryGroup.querySelector('input[name$="[politifact_url]"]');
        const idInput = entryGroup.querySelector('input[name$="[id]"]');
        const messageInput = entryGroup.querySelector('input[name$="[download_message]"]');
        const pathInput = entryGroup.querySelector('input[name$="[drive_path]"]');
        const successInput = entryGroup.querySelector('input[name$="[download_success]"]');


        const url = urlInput.value.trim();
        const id = idInput.value;

        if (!url) {
            messageInput.value = "Politifact URL is required for download.";
            return;
        }

        messageInput.value = "Downloading...";
        pathInput.value = "";
        successInput.value = "false"; // Set to false initially
        button.disabled = true;
        button.textContent = "Downloading...";

        try {
            const response = await fetch('/download_video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url, id: id }),
            });

            const result = await response.json();

            if (response.ok) {
                messageInput.value = result.message || "Download status unknown";
                pathInput.value = result.drive_path || "";
                successInput.value = result.success ? "true" : "false"; // Update hidden input
            } else {
                messageInput.value = `Error: ${result.error || response.statusText}`;
                pathInput.value = "";
                 successInput.value = "false";
            }

        } catch (error) {
            console.error('Download fetch error:', error);
            messageInput.value = `Network error: ${error}`;
            pathInput.value = "";
            successInput.value = "false";
        } finally {
            button.disabled = false;
            button.textContent = "Download Video";
        }
    }

    function collectDataFromForm() {
        const entries = [];
        const entryElements = dataContainer.querySelectorAll('.entry-group');

        entryElements.forEach((entryElement, entryIndex) => {
            const entryData = {
                id: parseInt(entryElement.querySelector(`input[name="data[${entryIndex}][id]"]`)?.value || '0', 10),
                politifact_url: entryElement.querySelector(`input[name="data[${entryIndex}][politifact_url]"]`)?.value || '',
                politifact_headline: entryElement.querySelector(`input[name="data[${entryIndex}][politifact_headline]"]`)?.value || '',
                politifact_subheadline: entryElement.querySelector(`input[name="data[${entryIndex}][politifact_subheadline]"]`)?.value || '',
                rating: entryElement.querySelector(`input[name="data[${entryIndex}][rating]"]:checked`)?.value || '',
                video_duration: entryElement.querySelector(`input[name="data[${entryIndex}][video_duration]"]`)?.value || '',
                social_link: entryElement.querySelector(`input[name="data[${entryIndex}][social_link]"]`)?.value || '',
                social_platform: entryElement.querySelector(`input[name="data[${entryIndex}][social_platform]"]`)?.value || '',
                social_duration: parseFloat(entryElement.querySelector(`input[name="data[${entryIndex}][social_duration]"]`)?.value || '0'),
                social_text: entryElement.querySelector(`textarea[name="data[${entryIndex}][social_text]"]`)?.value || '',
                external_links_info: [],
                 // Use hidden input value, default to false if not found or invalid
                download_success: entryElement.querySelector(`input[name="data[${entryIndex}][download_success]"]`)?.value === 'true',
                download_message: entryElement.querySelector(`input[name="data[${entryIndex}][download_message]"]`)?.value || '',
                drive_path: entryElement.querySelector(`input[name="data[${entryIndex}][drive_path]"]`)?.value || '',
            };

             // Validate/Sanitize Numbers
             if (isNaN(entryData.id)) entryData.id = 0; // Or handle error appropriately
             if (isNaN(entryData.social_duration)) entryData.social_duration = 0.0;


            // Collect external links
            const linkPairs = entryElement.querySelectorAll('.external-link-pair');
            linkPairs.forEach((pair, linkIndex) => {
                 // Important: Use the correct naming convention used when creating links
                 const urlInput = pair.querySelector(`input[name="data[${entryIndex}][external_links_info][${linkIndex}][url]"]`);
                 const descInput = pair.querySelector(`input[name="data[${entryIndex}][external_links_info][${linkIndex}][description]"]`);

                 if (urlInput && descInput && urlInput.value) { // Only add if URL is present
                     entryData.external_links_info.push({
                         url: urlInput.value,
                         description: descInput.value || ''
                     });
                 }
            });

            entries.push(entryData);
        });

         // Re-assign sequential IDs before returning, ensuring correctness after removals/additions
         entries.forEach((entry, index) => {
            entry.id = index;
         });


        return entries;
    }

}); // End DOMContentLoaded