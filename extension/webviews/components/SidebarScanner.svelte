
<script lang="js">
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import { loadScript } from "@paypal/paypal-js";

    const sdkURL = "https://www.paypal.com/sdk/js?client-id=test";
    console.log(nonce)
    let paypal;
    let accessToken = ''
    let loading = true;

    let user = null;
    let searchTerm = '';
    let scans = [];
    const displayedScansStore = writable([]);
    let displayedScans = [];
    let options = [];
    let selectedStandard = 'Please select a Standard'
    let selectedStandardId = null;
    let expandedCardId = null;
    let filteredScans = [];
    let dateFilterInput= '';
    let filterDate = '';

    let showDropdown = false;

    // Toggle dropdown visibility
    function toggleDropdown() {
      showDropdown = !showDropdown;
    }

    // Handle option selection
    function selectOption(optionLabel, optionID) {
      selectedStandard = optionLabel;
      selectedStandardId = optionID;
      showDropdown = false;
    }

    let currentPage = 1;
    const itemsPerPage = 5;

    function handleLogin() {
      tsvscode.postMessage({ type: 'login' });
    };

    function handleLogout() {
      accessToken = '';
      user = null;
      tsvscode.postMessage({ type: 'logout' });
    };
  
    async function initiateScan() {
      if (options.length == 0) {
        tsvscode.postMessage({ type: 'onInfo', value: 'Please add a standard to perform a scan!' });
        return;
      }
    
      try {
        tsvscode.postMessage({ type: 'onInfo', value: 'Scan initiated...' });
        tsvscode.postMessage({ type: 'onScan', standardId: selectedStandardId, accessToken: accessToken });
      } catch (error) {
        console.error('Error initiating scan:', error);
      }
    }

    async function fetchResults() {
      // Get scan once a response is received from the server
      tsvscode.postMessage({ type: 'get-token' });
      
      const response = await fetch(`${apiBaseUrl}/scans`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    
      const payload = await response.json();
      scans = payload.scans;
      filterScans();
      displayedScansStore.set(filteredScans);
      displayedScans = getScansForPage();
    }

    function handleFormSubmit(event) {
       event.preventDefault(); // Prevent form submission (and page refresh)
    }

    function handleSearch(event) {
      searchTerm = event.target.value;
      filterScans(); 
      currentPage = 1; 
      displayedScans = getScansForPage();
    }

    function applyDateFilter(scan) {
      if (!filterDate) return true; // If filterDate is empty, no filter applied

      const scanDate = new Date(scan.createdDate);
      const filterDateValue = new Date(filterDate);

      return scanDate >= filterDateValue;
    }
    
    function filterScans() {
      filteredScans = scans.filter((scan) => {
        const formattedDate = formatDate(scan.createdDate);
        const formattedTime = formatTime(scan.createdDate);
        const fileName = extractFileName(scan.file);
      
        const dateFilterCondition = applyDateFilter(scan);
      
        return (
          scan.standardName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          formattedDate.includes(searchTerm) ||
          formattedTime.includes(searchTerm) ||
          fileName.toLowerCase().includes(searchTerm.toLowerCase())
        ) && dateFilterCondition;
      });
    
      displayedScansStore.set(filteredScans);
      currentPage = 1;
    }

    //This was created because before this there would be an error when using the enter key to search
    function handleSearchOnEnter(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        searchTerm = event.target.value;
        filterScans(); // Filter scans based on the search term
        currentPage = 1; 
        displayedScans.update(() => {
          return getScansForPage();
        });
      }
    }

    function NextPage() {
      currentPage += 1;
      displayedScans = getScansForPage();
    }

    function PreviousPage() {
      currentPage -= 1;
      displayedScans = getScansForPage();
    }

    function getScansForPage() {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      return $displayedScansStore.slice(startIndex, endIndex);
    }

    function extractFileName(filePath) {
      const parts = filePath.split(/[\\/]/);
      return parts[parts.length - 1];
    }

    function formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString(); // Format the date as per the user's locale
    }

    function formatTime(dateString) {
      const date = new Date(dateString);
      return date.toLocaleTimeString(); // Format the time as per the user's locale
    }

    $: hasNextPage = $displayedScansStore.length > currentPage * itemsPerPage;
    $: hasPreviousPage = currentPage > 1;

    $: {
      // When dateFilterInput changes, update filterDate
      filterDate = dateFilterInput.trim(); // Assuming dateFilterInput contains a valid date string
      filterScans(); // Trigger the scan filtering when the date input changes
    }

    $: {
        displayedScans = getScansForPage();
        hasNextPage = $displayedScansStore.length > currentPage * itemsPerPage;
        hasPreviousPage = currentPage > 1;
      }

    function editStandards() {
      tsvscode.postMessage({ type: 'editStandards', accessToken: accessToken });
    };

    function seeScanDetails(scan) {
      tsvscode.postMessage({ type: 'seeScanDetails', scan: scan});
    };

    function expandCard(cardId) {
      expandedCardId = expandedCardId === cardId ? null : cardId;
    }

    async function sendScan(cardId, email) {
      try {
        const sendButton = document.getElementById('send-button');
        sendButton.disabled = true;
      
        const response = await fetch(`${apiBaseUrl}/email-scans`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scanId: cardId, email: email }),
        });
      
        if (response.status == 200) {
          console.log('Scan sent successfully!');
          tsvscode.postMessage({ type: 'onInfo', value: 'Scan sent successfully!' });
        } else {
          const errorMessage = response.statusText || 'Something went wrong - scan failed to send!';
          tsvscode.postMessage({ type: 'onError', value: errorMessage });
        }
      } catch (error) {
        console.error(error);
        tsvscode.postMessage({ type: 'onError', value: 'An error occurred while sending the scan!' });
      } finally {
        sendButton.disabled = false;
      }
    }

    async function ConfirmArchiveScan(scanId) {
      tsvscode.postMessage({ type: 'onConfirmArchiveScan', scanId: scanId });
    }

    async function archiveScan(scanId) {
      try {
        // Disable the archive button while the archive operation is in progress
        console.log('archive-button-' + scanId);
        const archiveButton = document.getElementById('archive-button-' + scanId);
        archiveButton.disabled = true;
      
        // Make an API request to archive the scan using its scanId
        const response = await fetch(`${apiBaseUrl}/archive-scan/${scanId}`, {
          method: 'POST', // You can use the appropriate HTTP method (POST, PUT, etc.) for your API
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      
        if (response.status == 200) {
          console.log('Scan archived successfully!');
          tsvscode.postMessage({ type: 'onInfo', value: 'Scan archived successfully!' });
          fetchResults();
        } else {
          const errorMessage = response.statusText || 'Something went wrong - scan failed to archive!';
          tsvscode.postMessage({ type: 'onError', value: errorMessage });
        }
      } catch (error) {
        console.log(error);
        tsvscode.postMessage({ type: 'onError', value: 'An error occurred while archiving the scan!' });
      } finally {
        // Re-enable the archive button after the operation is complete
        const archiveButton = document.getElementById('archive-button-' + scanId);
        archiveButton.disabled = false;
      }
    }

    onMount(async () => {

      window.addEventListener('message', async event => {
        const message = event.data;
        switch (message.type) {
          case 'token': {
            accessToken = message.value;
            
            const response = await fetch(`${apiBaseUrl}/me`,{ 
              headers: { 
                Authorization: `Bearer ${accessToken}`,
               },
            });
          
            const data = await response.json();
            user = data.user;
            loading = false;
            break;
          }

          // Message that scan was completed successfully
          case 'archiveScanConfirmation': {
            // Trigger the fetchResults function when the "scanComplete" message is received
            archiveScan(message.scanId);
            break;
          }

          // Message that scan was completed successfully
          case 'scanComplete': {
            // Trigger the fetchResults function when the "scanComplete" message is received
            tsvscode.postMessage({ type: 'onInfo', value: 'Scan completed successfully!' });
              fetchResults();
          }
        }
      });

      tsvscode.postMessage({ type: 'get-token' });

      // Make an API request to get the user's scans using their JWT

      const responseScans = await fetch(`${apiBaseUrl}/scans`,{
              headers: { 
                Authorization: `Bearer ${accessToken}`,
               },
            });
      
      const payload = await responseScans.json();
      scans = payload.scans;
      displayedScansStore.set(scans);
      displayedScans = getScansForPage();
      
      // Make an API request to get the user's standards using their JWT

      const responseStandards = await fetch(`${apiBaseUrl}/standards`,{
              headers: { 
                Authorization: `Bearer ${accessToken}`,
               },
            });
      
      const payloadStandards = await responseStandards.json();
      options = payloadStandards.standards;
      if (options.length == 0) {
        selectedStandard = 'Please add a Standard!';
      }

      // Load the PayPal SDK
      try {
        paypal = await loadScript({ clientId: "test", dataCspNonce: nonce});
      } catch (error) {
          console.error("failed to load the PayPal JS SDK script", error);
      }

      setTimeout(() => {
        if (paypal) {
          try {
            paypal.Buttons().render("#paypal-button-container");
          } catch (error) {
            console.error("Failed to render the PayPal Buttons", error);
          }
        }
      }, 1000); 

  });

  </script>

  {#if loading}
    <div>Loading...</div>
  {:else if !user}
    <button on:click={handleLogin}>Login with GitHub</button>
  {:else}
    <div style="margin-top: 0.5cm;">Hello <strong>{user.name}!</strong></div>
    <button on:click={handleLogout}>Logout</button>
    <!-- svelte-ignore missing-declaration -->
    <main>
      <div style="margin-bottom: 1rem;">
          <p>Please choose which scan you would like to perform:</p>
      </div>
      
      {#if options}
        <div class="vscode-select">
          <div class="selected-option" on:click={toggleDropdown}>
            {selectedStandard}
            <div class="vscode-select-arrow"></div>
          </div>
          {#if showDropdown}
            <div class="options-container">
              {#if options.length == 0}
                <div class="option" on:click={() => selectOption('Please add a standard!', null)}>
                  {'Please add a standard!'}
                </div>
              {:else}
                <div class="option" on:click={() => selectOption('Please select a standard', null)}>
                  {'Please select a standard'}
                </div>
              {/if}
              {#each options as option}
                <div class="option" on:click={() => selectOption(option.standard, option.id)}>
                  {option.standard}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <p>Loading options...</p>
      {/if}

      <div style="margin-top: 1rem; margin-bottom: 1rem;">
          <button on:click={initiateScan}>Scan</button>
      </div>

      <div style="margin-top: 1rem; margin-bottom: 1cm;">
        <button on:click={editStandards} style="background-color: #0e639c; color: white;">Edit Standards</button>
      </div>

      <div>
        <div style="margin-top: 1rem; margin-bottom: 1rem;">
          <strong>Previous Scans:</strong>
        </div>

        <div style="margin-top: 1rem;">
          <form on:submit={handleFormSubmit}>
            <input
              type="text"
              placeholder="Search scans..."
              bind:value={searchTerm}
              on:input={handleSearch}
              on:keydown={handleSearchOnEnter}
            />
          </form>
        </div>

        <input
          type="text"
          id="date-filter"
          placeholder="Enter date to filter by..."
          bind:value={dateFilterInput}
          on:input={filterScans}
        />

        {#each displayedScans as scan}
          <div class="scan-card" style="margin-top: 1rem;" on:click={() => expandCard(scan.id)}>
            <div>
              <p class="heading">Standard: {scan.standardName}</p>
              <p class="heading">Date: {formatDate(scan.createdDate)}</p>
              <p class="heading">Time: {formatTime(scan.createdDate)}</p>
              <p class="heading">File: {extractFileName(scan.file)}</p>
            </div>
            <div class="value">
              <p class="value-heading">Score:</p>
              <p class="value-number">{scan.value}</p>
            </div>
          </div>
          {#if expandedCardId === scan.id}
            <input type="email" placeholder="Enter email" bind:value={scan.email} />
            <!-- Add the archive button -->
            <button id="send-button" on:click={() => sendScan(scan.id, scan.email)}>Send Scan</button>
            <button id="see-scan-button" on:click={() => seeScanDetails(scan)}  style="background-color: #0e639c; color: white; margin-top: 1rem;">Scan Details</button>
            <button on:click={() => ConfirmArchiveScan(scan.id)} class="archive-button dark-red-button" style="margin-top: 1rem;" id={`archive-button-${scan.id}`}>
              Archive
            </button>
          {/if}
        {/each}
      </div>
  
      <div class="pagination" style="margin-bottom: 1rem;">
        {#if hasPreviousPage}
          <button on:click={PreviousPage}>Previous</button>
        {/if}
        {#if hasNextPage}
          <button on:click={NextPage}>Next</button>
        {/if}

      </div>
      <div id="paypal-button-container"></div>
      <!-- svelte-ignore missing-declaration -->
      <script nonce="${nonce}" src="${sdkURL}" data-csp-nonce="${nonce}"></script>
      <!-- svelte-ignore missing-declaration -->
      <script nonce="${nonce}">
                paypal.Buttons().render('#paypal-button-container');
      </script>
    </main>
  
    <style>
      label {
        display: block;
        margin-bottom: 0.5rem;
      }

      .vscode-select {
        position: relative;
        display: inline-block;
        font-family: inherit;
        color: #fff;
      }
    
      /* Style the selected option container */
      .selected-option {
        position: relative;
        padding: 4px 28px 4px 8px; /* Add some space to the right (28px) for the arrow */
        border: 1px solid #4d4d4d;
        border-radius: 3px;
        background-color: #333;
        cursor: pointer;
        display: flex;
        align-items: center;
      }
    
      /* Style the select arrow */
      .vscode-select-arrow {
        position: absolute;
        top: 50%;
        right: 8px;
        transform: translateY(-50%);
        border-width: 5px 4px 0;
        border-color: #ccc transparent transparent;
        border-style: solid;
        pointer-events: none;
      }
    
      /* Create space between option text and arrow using ::after pseudo-element */
      .option::after {
        content: "";
        display: inline-block;
        width: 28px; 
      }
    
      /* Style the options container */
      .options-container {
        position: absolute;
        top: 100%;
        left: 0;
        z-index: 1;
        display: flex;
        flex-direction: column;
        background-color: #4d4d4d;
        border: 1px solid #4d4d4d;
        border-radius: 3px;
        overflow: hidden;
      }
    
      /* Style the options */
      .option {
        padding: 8px 12px;
        color: #fff;
        cursor: pointer;
      }
    
      /* Style the options on hover */
      .option:hover {
        background-color: #333;
      }

      .scan-card {
        border: 1px solid #ccc;
        padding: 1rem;
        margin-bottom: 0rem;
        display: flex; 
        justify-content: space-between; 
        align-items: center;
      }
    
      .scan-card p.heading {
        font-weight: bold;
      }
    
      .scan-card .value-heading {
        font-size: 1rem;
        font-weight: bold;
      }

      /* Style the value number */
      .scan-card .value-number {
        font-size: 2.2rem;
      }
    
      .pagination {
        display: flex;
        justify-content: center;
        margin-top: 1rem;
      }

      .pagination button {
        margin: 0 0.5rem;
      }

      .dark-red-button {
        background-color: darkred;
        color: white;
        border: none;
        padding: 8px 16px;
        cursor: pointer;
      }
    
      /* Hover effect for the button */
      .dark-red-button:hover {
        background-color: #8b0000; /* Darken the color on hover */
      }
    </style>
  {/if}
  
