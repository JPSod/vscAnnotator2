<script>
    // based on suggestions from:
    // Inclusive Components by Heydon Pickering https://inclusive-components.design/collapsible-sections/
    export let headerText;

    let expanded = false
</script>

<style>
    .collapsible {
      border: 0px solid #ccc;
      border-radius: 0px;
      margin-bottom: 1rem;
    }
  
    .collapsible h3 {
      margin: 0;
      padding: 0;
    }
  
    .collapsible h3 button {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 1rem;
      background-color: #6d6d6d;
      border: none;
      outline: none;
      cursor: pointer;
    }
  
    .collapsible h3 button:focus {
      background-color: #6d6d6d;;
    }
  
    .collapsible .contents {
      padding: 1rem;
      background-color: #6d6d6d;
      overflow: hidden;
      transition: max-height 0.2s ease-in-out;
    }
  
  </style>

<div class="collapsible">
    <h3>
      <button aria-expanded={expanded} on:click={() => (expanded = !expanded)}>
        {headerText}
      </button>
    </h3>
  
    <div class="contents" hidden={!expanded}>
      <slot></slot>
    </div>
  </div>