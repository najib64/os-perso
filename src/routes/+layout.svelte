<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();
  let currentPath = $state('');

$effect(() => {
  currentPath = window.location.pathname;
});

  const navItems = [
    { href: '/', label: 'Dashboard', icon: '🏠' },
    { href: '/gym', label: 'Gym', icon: '🏋️' },
    { href: '/deen', label: 'Deen', icon: '🕌' },
    { href: '/pro', label: 'Pro', icon: '💼' },
    { href: '/perso', label: 'Perso', icon: '🧠' },
  ];
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="manifest" href="/manifest.json" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet" />
</svelte:head>

<div class="app">
  <aside class="sidebar">
    <div class="logo">OS-PERSO</div>
{#each navItems as item}
  <a
    href={item.href}
    onclick={() => currentPath = item.href}
    class="bottom-nav-item {currentPath === item.href ? 'active' : ''}"
  >
    <span>{item.icon}</span>
    {item.label}
  </a>
{/each}
  </aside>

  <main class="main">
    <div class="content">
      {@render children()}
    </div>
  </main>

  <nav class="bottom-nav">
{#each navItems as item}
  <a
    href={item.href}
    onclick={() => currentPath = item.href}
    class="bottom-nav-item {currentPath === item.href ? 'active' : ''}"
  >
    <span>{item.icon}</span>
    {item.label}
  </a>
{/each}
  </nav>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #0D0D0D;
    color: #F5F5F5;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .app {
    display: flex;
    height: 100dvh;
    background-color: #0D0D0D;
  }

  .sidebar {
    display: none;
    flex-direction: column;
    width: 200px;
    border-right: 1px solid #262626;
    padding: 16px;
    gap: 4px;
  }

  @media (min-width: 768px) {
    .sidebar {
      display: flex;
    }
  }

  .logo {
    color: #F5F5F5;
    font-size: 18px;
    font-weight: 500;
    padding: 12px 16px;
    margin-bottom: 16px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 14px;
    text-decoration: none;
    color: #8C8C8C;
    transition: background 0.15s, color 0.15s;
  }

  .nav-item:hover {
    color: #F5F5F5;
    background: #141414;
  }

  .nav-item.active {
    background: #1A1A1A;
    color: #F5F5F5;
  }

  .main {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 64px;
  }

  @media (min-width: 768px) {
    .main {
      padding-bottom: 0;
    }
  }

  .content {
    max-width: 768px;
    margin: 0 auto;
    padding: 24px 16px;
  }

  @media (min-width: 768px) {
    .content {
      padding: 32px 24px;
    }
  }

  .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #141414;
    border-top: 1px solid #262626;
    justify-content: space-around;
    padding: 8px 4px;
    z-index: 50;
  }

  @media (min-width: 768px) {
    .bottom-nav {
      display: none;
    }
  }

  .bottom-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    text-decoration: none;
    min-width: 56px;
    color: #595959;
  }

  .bottom-nav-item.active {
    color: #3B82F6;
  }
</style>