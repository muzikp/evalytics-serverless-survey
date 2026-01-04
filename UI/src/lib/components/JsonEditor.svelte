<script>
  import { onMount, onDestroy } from "svelte";
  import loader from "@monaco-editor/loader";

  export let value = "{}";
  export let readonly = false;
  export let height = "400px";

  let container;
  let editor;
  let monaco;

  onMount(async () => {
    try {
      monaco = await loader.init();

      editor = monaco.editor.create(container, {
        value:
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
        language: "json",
        theme: "vs",
        automaticLayout: true,
        readOnly: readonly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: "on",
        renderLineHighlight: "all",
        quickSuggestions: true,
        formatOnPaste: true,
        formatOnType: true,
      });

      // Update value when editor content changes
      if (!readonly) {
        editor.onDidChangeModelContent(() => {
          value = editor.getValue();
        });
      }
    } catch (err) {
      console.error("Failed to initialize Monaco Editor:", err);
    }
  });

  onDestroy(() => {
    if (editor) {
      editor.dispose();
    }
  });

  // Update editor when value prop changes externally
  $: if (editor && typeof value === "string") {
    const currentValue = editor.getValue();
    if (currentValue !== value) {
      editor.setValue(value);
    }
  }

  // Method to get parsed JSON
  export function getJson() {
    try {
      return JSON.parse(editor.getValue());
    } catch (err) {
      throw new Error("Invalid JSON: " + err.message);
    }
  }

  // Method to format JSON
  export function format() {
    if (editor) {
      editor.getAction("editor.action.formatDocument").run();
    }
  }
</script>

<div class="json-editor" bind:this={container} style="height: {height}"></div>

<style>
  .json-editor {
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
  }
</style>
