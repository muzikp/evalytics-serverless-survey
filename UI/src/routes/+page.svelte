<script>
  import { auth } from "$lib/auth.js";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  onMount(() => {
    if ($auth) {
      goto("/admin/templates");
    } else {
      goto("/login");
    }
  });
</script>

<div class="welcome">
  <h1>Evalytics Serverless Survey</h1>
  <p>Loading...</p>
</div>

<style>
  .welcome {
    text-align: center;
    padding: 60px 20px;
  }
</style>
