// PWA Registration and Management
class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    this.init();
  }

  async init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered: ', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              this.showUpdateNotification();
            }
          });
        });
      } catch (error) {
        console.log('SW registration failed: ', error);
      }
    }

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Listen for appinstalled event
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.hideInstallButton();
      this.deferredPrompt = null;
    });

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('App is running in standalone mode');
      this.hideInstallButton();
    }
  }

  showInstallButton() {
    // Create install button if it doesn't exist
    if (!this.installButton) {
      this.installButton = document.createElement('button');
      this.installButton.id = 'pwa-install-btn';
      this.installButton.className = 'pwa-install-btn';
      this.installButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        App installieren
      `;
      this.installButton.addEventListener('click', () => this.installApp());
      
      // Add to the top of the app
      const app = document.getElementById('app');
      if (app) {
        app.insertBefore(this.installButton, app.firstChild);
      }
    }
    
    this.installButton.style.display = 'block';
  }

  hideInstallButton() {
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
  }

  async installApp() {
    if (!this.deferredPrompt) {
      return;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    this.deferredPrompt = null;
    this.hideInstallButton();
  }

  showUpdateNotification() {
    // Create update notification
    const notification = document.createElement('div');
    notification.className = 'pwa-update-notification';
    notification.innerHTML = `
      <div class="pwa-update-content">
        <span>Neue Version verfügbar!</span>
        <button onclick="location.reload()" class="pwa-update-btn">Aktualisieren</button>
        <button onclick="this.parentElement.parentElement.remove()" class="pwa-close-btn">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  // Check if app is installed
  isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  // Get install prompt state
  canInstall() {
    return this.deferredPrompt !== null;
  }
}

// Initialize PWA manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.pwaManager = new PWAManager();
});

// Add PWA-specific CSS
const pwaStyles = `
  .pwa-install-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 25px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
    transition: all 0.3s ease;
  }

  .pwa-install-btn:hover {
    background: #357abd;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(74, 144, 226, 0.4);
  }

  .pwa-install-btn svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }

  .pwa-update-notification {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1001;
    background: #333;
    color: white;
    border-radius: 8px;
    padding: 16px 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideDown 0.3s ease;
  }

  .pwa-update-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pwa-update-btn {
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
  }

  .pwa-close-btn {
    background: none;
    color: #ccc;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @keyframes slideDown {
    from {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }

  @media (max-width: 768px) {
    .pwa-install-btn {
      top: 10px;
      right: 10px;
      padding: 10px 16px;
      font-size: 12px;
    }
    
    .pwa-update-notification {
      left: 10px;
      right: 10px;
      transform: none;
    }
  }
`;

// Inject PWA styles
const styleSheet = document.createElement('style');
styleSheet.textContent = pwaStyles;
document.head.appendChild(styleSheet);
