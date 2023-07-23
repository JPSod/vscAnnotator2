
<script lang="js">
    import { onMount } from "svelte";

    let accessToken = ''

    let options = [
      { id: 0, label: 'Please select a standard'},
      { id: 1, label: 'Standard A'},
      { id: 2, label: 'Standard B'},
      { id: 3, label: 'Standard C'},
      { id: 2, label: 'Standard D'},
      { id: 3, label: 'Standard E'}
    ];

    let loading = true;
    let user = null;
    let data = null;
    let scans = [];
    let selectedStandard = options[0].label;

    let showDropdown = false;

    // Toggle dropdown visibility
    function toggleDropdown() {
      showDropdown = !showDropdown;
    }

    // Handle option selection
    function selectOption(optionLabel) {
      selectedStandard = optionLabel;
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
  
    function handleClick() {
      tsvscode.postMessage({ type: 'onScan', standard: selectedStandard, accessToken: accessToken });

      setTimeout(async () => {
        tsvscode.postMessage({ type: 'get-token' });

        const response = await fetch(`${apiBaseUrl}/scans`,{
              headers: { 
                Authorization: `Bearer ${accessToken}`,
               },
            });

        const payload = await response.json();
        scans = payload.scans;
        displayedScans = getScansForPage();
      }, 1000);

    };


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
    return scans.slice(startIndex, endIndex);
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

    $: displayedScans = getScansForPage();
    $: hasNextPage = scans && scans.length > currentPage * itemsPerPage;
    $: hasPreviousPage = currentPage > 1;

    onMount(async () => {

      window.addEventListener('message', async event => {
        const message = event.data;
        switch (message.type) {
          case 'token':
            accessToken = message.value;
            
            const response = await fetch(`${apiBaseUrl}/me`,{ 
              headers: { 
                Authorization: `Bearer ${accessToken}`,
               },
            });
          
            const data = await response.json();
          
            console.log(data);
            user = data.user;
            console.log(user);
            loading = false;
            break;
        }
      });

      tsvscode.postMessage({ type: 'get-token' });

      const response = await fetch(`${apiBaseUrl}/scans`,{
              headers: { 
                Authorization: `Bearer ${accessToken}`,
               },
            });
      
      const payload = await response.json();
      scans = payload.scans;
      displayedScans = getScansForPage();

      });
    
  </script>

  {#if loading}
    <div>Loading...</div>
  {:else if !user}
    <button on:click={handleLogin}>Login with GitHub</button>
  {:else}
    <div>Hello <strong>{user.name}!</strong></div>
    <button on:click={handleLogout}>Logout</button>

    <main>
      <div style="margin-bottom: 1rem;">
          <p>Please choose which scan you would like to perform:</p>
      </div>
      
      <div class="vscode-select">
        <div class="selected-option" on:click={toggleDropdown}>
          {selectedStandard}
          <div class="vscode-select-arrow"></div>
        </div>
        {#if showDropdown}
          <div class="options-container">
            {#each options as option}
              <div class="option" on:click={() => selectOption(option.label)}>
                {option.label}
              </div>
            {/each}
          </div>
        {/if}
      </div>
  
      <div style="margin-top: 1rem; margin-bottom: 1rem;">
          <button on:click={handleClick}>Scan</button>
      </div>

      <div>
        <div style="margin-top: 1rem; margin-bottom: 1rem;">
          <strong>Previous Scans:</strong>
        </div>
        {#each displayedScans as scan}
          <div class="scan-card">
            <div>
              <p class="heading">Standard: {scan.standard}</p>
              <p class="heading">Date: {formatDate(scan.createdDate)}</p>
              <!-- Include the time below the date -->
              <p class="heading">Time: {formatTime(scan.createdDate)}</p>
              <p class="heading">File: {extractFileName(scan.file)}</p>
            </div>
            <div class="value">
              <p class="value-heading">Value:</p>
              <p class="value-number">{scan.value}</p>
            </div>
          </div>
        {/each}
      </div>
  
      <div class="pagination">
        {#if hasPreviousPage}
          <button on:click={PreviousPage}>Previous</button>
        {/if}
        {#if hasNextPage}
          <button on:click={NextPage}>Next</button>
        {/if}

      </div>
  
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
        width: 28px; /* Width of the space between the option text and arrow */
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
        margin-bottom: 1rem;
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
    </style>
  {/if}
  
