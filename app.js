document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const SERVER_URL = 'https://octopus-app-iwic4.ondigitalocean.app'; // ✨ כתובת השרת המתוקנת
    const ADMIN_EMAIL = 'ohadf1976@gmail.com';
    const CLIENT_URL = window.location.origin;

    // --- UI Element Selectors ---
    const mainView = document.getElementById('main-view');
    const profileView = document.getElementById('profile-view');
    const publicProfileView = document.getElementById('public-profile-view');
    const adminView = document.getElementById('admin-view');
    const adminDashboardContent = document.getElementById('admin-dashboard-content');
    const adminUserProfileView = document.getElementById('admin-user-profile-view');
    const itemsFeed = document.getElementById('items-feed');
    const profileItemsFeed = document.getElementById('profile-items-feed');
    const headerRightContent = document.getElementById('header-right-content');
    const headerLeft = document.getElementById('header-left');
    const installAppContainer = document.getElementById('install-app-container');
    const actionsBar = document.getElementById('actions-bar');
    const openModalBtn = document.getElementById('open-modal-btn');
    const filterInput = document.getElementById('filter-input');
    const categorySelect = document.getElementById('category-select');
    const sortSelect = document.getElementById('sort-select');
    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');
    const favoritesFilterBtn = document.getElementById('favorites-filter-btn');
    const emptyState = document.getElementById('empty-state');
    const chatView = document.getElementById('chat-view');
    const conditionSelect = document.getElementById('condition-select');
    const sizeFilterInput = document.getElementById('size-filter');
    const loadingIndicator = document.getElementById('loading-indicator');
    const brandFilterInput = document.getElementById('brand-filter');
    const locationFilterInput = document.getElementById('location-filter');
    const profileActionsContainer = document.getElementById('profile-actions-container');
    const shopsView = document.getElementById('shops-view');
    const shopsFeed = document.getElementById('shops-feed');
    const singleShopView = document.getElementById('single-shop-view');
    const savedSearchesView = document.getElementById('saved-searches-view');

    // --- Modals & Forms Selectors ---
    const allModals = document.querySelectorAll('.modal-backdrop, .gallery-backdrop');
    const uploadModal = document.getElementById('upload-modal');
    const galleryModal = document.getElementById('gallery-modal');
    const customModal = document.getElementById('custom-modal');
    const shareModal = document.getElementById('share-modal');
    const ratingModal = document.getElementById('rating-modal');
    const reportModal = document.getElementById('report-modal');
    const shopModal = document.getElementById('shop-modal');
    const uploadForm = document.getElementById('upload-form');
    const ratingForm = document.getElementById('rating-form');
    const reportForm = document.getElementById('report-form');
    const shopForm = document.getElementById('shop-form');
    const uploadModalTitle = document.getElementById('upload-modal-title');
    const editingItemIdInput = document.getElementById('editing-item-id');

    // --- Gallery Elements Selectors ---
    const galleryImage = document.getElementById('gallery-image');
    const galleryClose = document.getElementById('gallery-close');
    const galleryPrev = document.getElementById('gallery-prev');
    const galleryNext = document.getElementById('gallery-next');
    const galleryCounter = document.getElementById('gallery-counter');
    const galleryPanzoomViewport = document.getElementById('gallery-panzoom-viewport');
    const galleryZoomInBtn = document.getElementById('gallery-zoom-in');
    const galleryZoomOutBtn = document.getElementById('gallery-zoom-out');

    const toastNotification = document.getElementById('toast-notification');

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        const swUrl = `/sw.js`;
        navigator.serviceWorker.register(swUrl).then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, err => {
          console.log('ServiceWorker registration failed: ', err);
        });
      });
    }

    // --- PWA Custom Install Prompt ---
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      updateUIForAuthState();
    });

    async function handleInstallClick() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
            updateUIForAuthState();
        }
    }

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      console.log('PWA was installed');
      updateUIForAuthState();
    });

    // --- Global State ---
    let socket;
    let currentUser = null;
    let allItemsCache = {};
    let galleryImages = [];
    let currentImageIndex = 0;
    let favorites = [];
    let currentConversationId = null;
    let currentConversationDetails = null;
    let notificationsCache = [];
    let panzoomInstance = null;
    let currentUserProfile = null;
    let pushSubscription = null;

    // --- Infinite Scroll State ---
    let currentPage = 1;
    let isLoading = false;
    let hasMorePages = true;

    // --- Category and Condition Mapping ---
    const categoryMap = {
        'pants': 'מכנסיים',
        'shirts': 'חולצות',
        'jackets': 'ג\'קטים',
        'dresses': 'שמלות',
        'skirts': 'חצאיות',
        'top': 'טופ',
        'tank-tops': 'גופיות',
        'blazer': 'בלייזר',
        'accessories': 'אקססוריז',
        'general': 'כללי'
    };

    const conditionMap = {
        'new-with-tags': 'חדש עם טיקט',
        'new-without-tags': 'חדש ללא טיקט',
        'like-new': 'כמו חדש',
        'good': 'במצב טוב',
        'used': 'משומש'
    };

    function initializeSocket(token) {
        if (socket) {
            socket.disconnect();
        }

        socket = io(SERVER_URL, {
            auth: { token: token }
        });

        socket.off('connect');
        socket.off('newItem');
        socket.off('itemDeleted');
        socket.off('itemUpdated');
        socket.off('newMessage');
        socket.off('newConversation');
        socket.off('newNotification');

        socket.on('connect', () => {
            console.log('Connected to server with socket ID:', socket.id);
        });

        socket.on('newItem', (item) => {
            if (filterInput.value === '' && categorySelect.value === 'all' && conditionSelect.value === 'all' && sizeFilterInput.value === '' && minPriceInput.value === '' && maxPriceInput.value === '') {
                displayItem(item, true, itemsFeed);
            } else {
                showToast("פריט חדש עלה! נקה סינונים כדי לראות.");
            }
        });
        socket.on('itemDeleted', (itemId) => {
            const itemElement = document.getElementById(`item-${itemId}`);
            if (itemElement) itemElement.remove();
            const itemElementProfile = profileItemsFeed.querySelector(`#item-${itemId}`);
            if (itemElementProfile) itemElementProfile.remove();
        });
        socket.on('itemUpdated', (updatedItem) => {
            const card = document.getElementById(`item-${updatedItem._id}`);
            if(card) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = createItemCard(updatedItem);
                card.replaceWith(tempDiv.firstChild);
            }
            const profileFeedCard = document.querySelector(`#profile-items-feed #item-${updatedItem._id}`);
            if (profileFeedCard) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = createItemCard(updatedItem);
                profileFeedCard.replaceWith(tempDiv.firstChild.cloneNode(true));
            }
        });

        socket.on('newMessage', (message) => {
            if (chatView.classList.contains('active') && message.conversation === currentConversationId) {
                appendMessage(message);
            }
        });

        socket.on('newConversation', (data) => {
            showToast(`שיחה חדשה התחילה עם ${data.buyerName} לגבי "${data.itemName}"`);
        });

        socket.on('newNotification', (notification) => {
            notificationsCache.unshift(notification);
            updateNotificationBell();
            showToast(notification.message);
        });
    }

    // ... (וכאן ממשיך כל שאר הקוד המלא והתקין מהגיבוי שלך) ...

});
