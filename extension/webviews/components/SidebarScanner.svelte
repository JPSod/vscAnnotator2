
<script lang="js">
    import { onMount } from "svelte";

    let accessToken = ''

    let checkboxes = [
      { id: 1, label: 'Standard A', checked: false },
      { id: 2, label: 'Standard B', checked: false },
      { id: 3, label: 'Standard C', checked: false },
      { id: 2, label: 'Standard D', checked: false },
      { id: 3, label: 'Standard E', checked: false }
    ];

    let loading = true;
    let user = null;
    let data = null;
  
    function handleCheckboxChange(event) {
      const { id, checked } = event.target;
      checkboxes = checkboxes.map(checkbox =>
        checkbox.id === id ? { ...checkbox, checked } : checkbox
      );
    };

  
    function handleClick() {
      const selectedCheckboxes = checkboxes.filter(checkbox => checkbox.checked);
      const selectedCheckboxLabels = selectedCheckboxes.map(
        checkbox => checkbox.label
      );
      tsvscode.postMessage({ type: 'onScan', standards: `${selectedCheckboxLabels}`, accessToken: `${accessToken}`});
    };

    function handleLogin() {
      tsvscode.postMessage({ type: 'login' });
    };

    function handleLogout() {
      accessToken = '';
      user = null;
      tsvscode.postMessage({ type: 'logout' });
    };

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
      });
    
  </script>

  {#if loading}
    <div>Loading...</div>
  {:else if !user}
    <button on:click={handleLogin}>Login with GitHub</button>
  {:else}
    <pre>Hello {user.name}!</pre>
    <button on:click={handleLogout}>Logout</button>

    <main>
      <div style="margin-bottom: 1rem;">
          <p>Please choose which scans you would like to perform:</p>
      </div>
  
      {#each checkboxes as checkbox}
        <label for={checkbox.id}>
          <input
            type="checkbox"
            bind:checked={checkbox.checked}
            id={checkbox.id}
            on:change={handleCheckboxChange}
          />
          {checkbox.label}
        </label>
      {/each}
  
      <div style="margin-top: 1rem;">
          <button on:click={handleClick}>Scan</button>
      </div>
  
    </main>
  
    <style>
      label {
        display: block;
        margin-bottom: 0.5rem;
      }
    </style>
  {/if}
  
