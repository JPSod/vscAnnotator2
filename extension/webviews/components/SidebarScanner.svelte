
<script lang="js">
    import { onMount } from "svelte";

    let checkboxes = [
      { id: 1, label: 'Standard A', checked: false },
      { id: 2, label: 'Standard B', checked: false },
      { id: 3, label: 'Standard C', checked: false },
      { id: 2, label: 'Standard D', checked: false },
      { id: 3, label: 'Standard E', checked: false }
    ];
  
    function handleCheckboxChange(event) {
      const { id, checked } = event.target;
      checkboxes = checkboxes.map(checkbox =>
        checkbox.id === id ? { ...checkbox, checked } : checkbox
      );
    }

  
    function handleClick() {
      const selectedCheckboxes = checkboxes.filter(checkbox => checkbox.checked);
      const selectedCheckboxLabels = selectedCheckboxes.map(
        checkbox => checkbox.label
      );
      tsvscode.postMessage({ type: 'onInfo', value: `Selected checkboxes: ${selectedCheckboxLabels.join(', ')}`
      });
    }

    let expanded = false;
    let headerText = 'Scan Results';
    
  </script>
  
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

  <!--
 <button
     on:click={() => {
         tsvscode.postMessage({ type: 'onError', value: 'error message' });
     }}>click me for error</button>
     -->

<style>
    label {
      display: block;
      margin-bottom: 0.5rem;
    }
  </style>
