<script>
    import { onMount, onDestroy } from 'svelte';
  
    let standards = [];
    let selectedStandard = {
      standard: '',
      content: '',
    };
    let accessToken = '';
  
    async function fetchStandards() {
      const response = await fetch(`${apiBaseUrl}/standards`, {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
        },
      });
  
      const payload = await response.json();
      console.log(payload);
      // Check if payload.standards is an array or not
      standards = Array.isArray(payload.standards) ? payload.standards : [];
    }
  
    onMount(() => {
        // Get the access token from the extension host
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
                user = data.user;
                loading = false;
                break;
            }
        });

      tsvscode.postMessage({ type: 'get-token' });

      fetchStandards();
    });
  
    onDestroy(() => {
      // Clean up any resources if needed
    });
  
    function selectStandard(standard) {
      selectedStandard = standard;
    }

    function checkNameUniqueness(name) {
      // Convert the name to lowercase for case-insensitive comparison
      const lowerCaseName = name.toLowerCase();
      console.log(lowerCaseName);

      // Check if any existing standard in the 'standards' array has the same name
      console.log(standards);
      const isNameUnique = standards.every((standard) => {
        let test1 = standard != selectedStandard;
        let test2 = standard.standard.toLowerCase() != lowerCaseName;
        return test1 === test2;
      });

      return isNameUnique;
    }
  
    async function updateStandard() {
        console.log(`updateStandard() called`)
      if (!selectedStandard) return;

      const isNewStandard = !selectedStandard.id;

      const isNameUnique = checkNameUniqueness(selectedStandard.standard);
      if (!isNameUnique) {
        console.log(`updateStandard() called non-unique name`)
        tsvscode.postMessage({ type: 'onError', value: 'Standard name must be unique!' })
        return;
      }

      const url = isNewStandard
        ? `${apiBaseUrl}/standards`
        : `${apiBaseUrl}/update-standard`;

      const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
           'Content-Type': 'application/json', 
          },
          body: JSON.stringify(selectedStandard),
        });

        const payload = await response.json();

        await fetchStandards();
        tsvscode.postMessage({ type: 'refreshStandards' });

        if (payload.error) {
          tsvscode.postMessage({ type: 'onError', value: payload.error })
          return;
        }
    }
  
    function addNewStandard() {
      // Create a new standard object and add it to the standards array
      const newStandard = {
        standard: 'New Standard', // Set the default name or any other default values
        content: '',
      };
      standards.push(newStandard);
    
      // Automatically select the newly added standard
      selectedStandard = newStandard;
    }
  </script>
  
  <div class="container">
    <div class="left-column">
      {#each standards as standard}
        <div
          class="standard-item {selectedStandard === standard ? 'selected' : ''}"
          on:click={() => selectStandard(standard)}
        >
          <span class="standard-name">{standard.standard}</span>
        </div>
      {/each}
      {#if standards.length < 5}
        <button style="margin-top: 0.5cm;" on:click="{addNewStandard}">Add a Standard</button>
      {/if}
    </div>
    <div class="right-column">
      {#if selectedStandard && selectedStandard.standard !== ''}
        <div>
          <input type="text" bind:value="{selectedStandard.standard}" />
        </div>
        <div>
          <textarea bind:value="{selectedStandard.content}" rows="10"></textarea>
        </div>
        <div>
          <button on:click="{updateStandard}">Save Changes</button>
        </div>
      {/if}
    </div>
  </div>

  <style>
    .container {
      display: flex;
    }
  
    .left-column {
      width: 30%;
      padding: 1rem;
      border-right: 1px solid #ccc;
    }
  
    .right-column {
      flex: 1;
      padding: 1rem;
    }
  
    .standard-item {
      cursor: pointer;
      padding: 0.5rem;
    }
  
    .standard-item:hover {
      background-color: #4d4d4d;
    }
  
    .selected {
      background-color: #0e639c;
    }
  
    .standard-name {
      font-weight: bold;
    }
  </style>
  