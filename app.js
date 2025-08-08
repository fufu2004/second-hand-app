// תוכן מלא ומעודכן לקובץ app.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Configuration ---
    const SERVER_URL = 'https://second-hand-app-j1t7.onrender.com';
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
    const saveSearchBtn = document.getElementById('save-search-btn');
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
    const offersView = document.getElementById('offers-view');
    
    // --- Modals & Forms Selectors ---
    const allModals = document.querySelectorAll('.modal-backdrop, .gallery-backdrop');
    const uploadModal = document.getElementById('upload-modal');
    const galleryModal = document.getElementById('gallery-modal');
    const customModal = document.getElementById('custom-modal');
    const shareModal = document.getElementById('share-modal');
    const ratingModal = document.getElementById('rating-modal');
    const reportModal = document.getElementById('report-modal'); 
    const shopModal = document.getElementById('shop-modal');
    const offerModal = document.getElementById('offer-modal');
    const uploadForm = document.getElementById('upload-form');
    const ratingForm = document.getElementById('rating-form');
    const reportForm = document.getElementById('report-form'); 
    const shopForm = document.getElementById('shop-form');
    const offerForm = document.getElementById('offer-form');
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
    let isFavoritesFilterActive = false;

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
        socket.off('offerUpdated');

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
            // If the offers view is open, refresh it when an offer-related notification arrives
            if (offersView.classList.contains('active') && (notification.type === 'new-offer' || notification.type === 'offer-update')) {
                showOffersView();
            }
        });

        socket.on('offerUpdated', (updatedOffer) => {
            if (offersView.classList.contains('active')) {
                showOffersView();
            }
        });
    }
    
    // --- Custom Modal System ---
    let modalResolver;
    function showCustomModal({ title, message, buttons, bodyHtml = '' }) {
        document.getElementById('custom-modal-title').textContent = title;
        document.getElementById('custom-modal-message').innerHTML = message; 
        document.getElementById('custom-modal-body').innerHTML = bodyHtml;
        const buttonsContainer = document.getElementById('custom-modal-buttons');
        buttonsContainer.innerHTML = '';
        buttons.forEach(btn => {
            const buttonEl = document.createElement('button');
            buttonEl.textContent = btn.text;
            buttonEl.className = btn.class;
            buttonEl.onclick = () => {
                hideAllModals();
                if (modalResolver) {
                    const bodyEl = document.getElementById('custom-modal-body');
                    const input = bodyEl.querySelector('input');
                    const value = input ? input.value : null;
                    modalResolver({ confirmed: btn.resolves, value: value });
                }
            };
            buttonsContainer.appendChild(buttonEl);
        });
        showModal(customModal);
        return new Promise(resolve => { modalResolver = resolve; });
    }
    
    async function showAlert(message, title = 'הודעה') {
        await showCustomModal({
            title: title,
            message: message,
            buttons: [{ text: 'הבנתי', class: 'bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-md transition', resolves: true }]
        });
    }
    
    function showToast(message) {
        toastNotification.textContent = message;
        toastNotification.classList.remove('hidden', 'opacity-0');
        setTimeout(() => {
            toastNotification.classList.add('opacity-0');
            setTimeout(() => {
                toastNotification.classList.add('hidden');
            }, 2500);
        }, 2500);
    }

    // --- View & Modal Management ---
    function showView(viewId) { 
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); 
        const viewToShow = document.getElementById(viewId);
        if(viewToShow) {
            viewToShow.classList.add('active'); 
        }
        window.scrollTo(0, 0); 
        
        if (viewId === 'admin-view') fetchAdminDashboardData();
        if (viewId === 'shops-view') fetchShops();
        if (viewId === 'offers-view') showOffersView();
    }
    function hideAllModals() { allModals.forEach(modal => { modal.classList.add('opacity-0'); const content = modal.querySelector('.modal-content, .gallery-content'); if (content) { content.classList.add('opacity-0', '-translate-y-10'); } setTimeout(() => { modal.classList.add('hidden'); }, 300); }); }
    function showModal(modalElement) { allModals.forEach(modal => { if (modal !== modalElement) { modal.classList.add('hidden', 'opacity-0'); } }); modalElement.classList.remove('hidden'); setTimeout(() => { modalElement.classList.remove('opacity-0'); const content = modalElement.querySelector('.modal-content, .gallery-content'); if (content) { content.classList.remove('opacity-0', '-translate-y-10'); } }, 10); }
    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', hideAllModals));
    allModals.forEach(modal => modal.addEventListener('click', (e) => { if (e.target === modal) hideAllModals(); }));

    // --- Gallery (Lightbox) System ---
    function openGallery(images, startIndex = 0) {
        if (!images || images.length === 0) return;
        galleryImages = images;
        showModal(galleryModal);
        document.body.style.overflow = 'hidden';
        
        panzoomInstance = Panzoom(galleryImage, {
            maxScale: 4,
            minScale: 1,
            canvas: true,
            startScale: 1,
        });
        
        galleryPanzoomViewport.addEventListener('wheel', panzoomInstance.zoomWithWheel);
        
        updateGalleryImage(startIndex);
    }

    function closeGallery() {
        hideAllModals();
        document.body.style.overflow = '';
        if (panzoomInstance) {
            galleryPanzoomViewport.removeEventListener('wheel', panzoomInstance.zoomWithWheel);
            panzoomInstance.destroy();
            panzoomInstance = null;
        }
    }

    function updateGalleryImage(index) {
        currentImageIndex = index;
        if (panzoomInstance) {
            panzoomInstance.reset();
        }
        galleryImage.src = galleryImages[index];
        galleryCounter.textContent = `${index + 1} / ${galleryImages.length}`;
        galleryPrev.disabled = index === 0;
        galleryNext.disabled = index === galleryImages.length - 1;
    }

    galleryPrev.addEventListener('click', () => { if (currentImageIndex > 0) updateGalleryImage(currentImageIndex - 1); });
    galleryNext.addEventListener('click', () => { if (currentImageIndex < galleryImages.length - 1) updateGalleryImage(currentImageIndex + 1); });
    galleryClose.addEventListener('click', closeGallery);
    galleryZoomInBtn.addEventListener('click', () => panzoomInstance?.zoomIn());
    galleryZoomOutBtn.addEventListener('click', () => panzoomInstance?.zoomOut());
    
    document.addEventListener('keydown', (e) => { 
        if (galleryModal.classList.contains('hidden')) return; 
        if (e.key === 'Escape') closeGallery(); 
        if (e.key === 'ArrowRight') galleryNext.click(); 
        if (e.key === 'ArrowLeft') galleryPrev.click(); 
    });
    
    function parseJwt (token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("Invalid token:", e);
            return null;
        }
    }
    
    // --- Authentication & Notification System ---
    
    async function fetchUserFavorites() {
        if (!currentUser) {
            favorites = [];
            return;
        }
        const token = localStorage.getItem('authToken');
        try {
            const response = await fetch(`${SERVER_URL}/api/my-favorites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error('Could not fetch favorites');
            }
            favorites = await response.json();
        } catch (error) {
            console.error('Failed to fetch user favorites:', error);
            favorites = []; 
        }
    }

    async function fetchNotifications() {
        if (!currentUser) return;
        const token = localStorage.getItem('authToken');
        try {
            const response = await fetch(`${SERVER_URL}/api/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch notifications');
            notificationsCache = await response.json();
            updateNotificationBell();
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    function updateNotificationBell() {
        if (!currentUser) return;
        const unreadCount = notificationsCache.filter(n => !n.isRead).length;
        const badge = document.getElementById('notification-badge');
        const bellIcon = document.getElementById('notifications-btn');

        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.classList.remove('hidden');
                if(bellIcon) bellIcon.classList.add('bell-animation');
            } else {
                badge.classList.add('hidden');
                if(bellIcon) bellIcon.classList.remove('bell-animation');
            }
        }
    }
    
    async function initializePushNotifications() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push messaging is not supported');
            return;
        }

        const pushButtonContainer = document.getElementById('push-notification-container');
        if (!pushButtonContainer) return;

        pushButtonContainer.classList.remove('hidden');

        const pushButton = document.getElementById('push-notification-btn');
        
        let isSubscribed = false;

        const registration = await navigator.serviceWorker.ready;
        pushSubscription = await registration.pushManager.getSubscription();
        isSubscribed = !(pushSubscription === null);

        updateBtn();

        if (isSubscribed) {
            console.log('User IS subscribed.');
        } else {
            console.log('User is NOT subscribed.');
        }
        
        if(pushButton) pushButton.addEventListener('click', handleSubscriptionChange);

        function updateBtn() {
            if (Notification.permission === 'denied') {
                updateButtonUI('התראות חסומות', '#fca5a5', true); // red-300
                return;
            }

            if (isSubscribed) {
                updateButtonUI('כבי התראות', '#d1d5db'); // gray-300
            } else {
                updateButtonUI('קבלי עדכונים', '#fcd34d'); // amber-300
            }
        }
        
        function updateButtonUI(text, color, disabled = false) {
            const buttonHtml = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg><span>${text}</span>`;
            
            if (pushButton) {
                pushButton.innerHTML = buttonHtml;
                pushButton.style.backgroundColor = color;
                pushButton.disabled = disabled;
                pushButton.title = disabled ? 'שנה הרשאות בדפדפן' : text;
            }
        }

        async function handleSubscriptionChange() {
            if (isSubscribed) {
                await unsubscribeUser();
            } else {
                await subscribeUser();
            }
        }

        async function subscribeUser() {
            try {
                const response = await fetch(`${SERVER_URL}/api/vapid-public-key`);
                const vapidPublicKey = await response.text();
                const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

                pushSubscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedVapidKey
                });

                await sendSubscriptionToServer(pushSubscription, 'subscribe');
                isSubscribed = true;
                showToast('נרשמת בהצלחה לעדכונים!');
            } catch (err) {
                if (Notification.permission === 'denied') {
                     showAlert('חסמת את האפשרות לקבל התראות. כדי להפעיל אותן, יש לשנות את ההגדרות בדפדפן.');
                } else {
                    console.error('Failed to subscribe the user: ', err);
                    showAlert('נכשלנו בהרשמה לעדכונים. נסה/י שוב.');
                }
                isSubscribed = false;
            }
            updateBtn();
        }

        async function unsubscribeUser() {
            try {
                await sendSubscriptionToServer(pushSubscription, 'unsubscribe');
                await pushSubscription.unsubscribe();
                pushSubscription = null;
                isSubscribed = false;
                showToast('ההרשמה לעדכונים בוטלה.');
            } catch (err) {
                console.error('Error unsubscribing', err);
                showAlert('שגיאה בביטול ההרשמה.');
            }
            updateBtn();
        }

        async function sendSubscriptionToServer(subscription, action) {
            const token = localStorage.getItem('authToken');
            if (!token) return;
            
            const endpoint = action === 'subscribe' ? '/api/subscribe' : '/api/unsubscribe';
            
            await fetch(`${SERVER_URL}${endpoint}`, {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
        }

        function urlBase64ToUint8Array(base64String) {
            const padding = '='.repeat((4 - base64String.length % 4) % 4);
            const base64 = (base64String + padding)
                .replace(/\-/g, '+')
                .replace(/_/g, '/');

            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);

            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            return outputArray;
        }
    }

    function toggleNotificationsPanel(button) {
        const panel = document.getElementById('notifications-panel');
        if (!panel) return;

        if (panel.style.display === 'block') {
            panel.style.display = 'none';
        } else {
            renderNotifications();
            panel.style.display = 'block';
        }
    }

    function renderNotifications() {
        const panel = document.getElementById('notifications-panel');
        const containerHtml = `<div class="p-2 text-sm text-gray-700 dark:text-gray-300">טוען...</div>`;
        
        if(panel) panel.innerHTML = containerHtml;

        if (notificationsCache.length === 0) {
            const emptyHtml = `<div class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">אין התראות חדשות.</div>`;
            if(panel) panel.innerHTML = emptyHtml;
            return;
        }

        let notificationsHtml = notificationsCache.map(notif => `
            <a href="#" data-link="${notif.link}" data-action="navigate-from-notification" class="block p-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b dark:border-gray-600 ${!notif.isRead ? 'font-bold' : ''}">
                <p class="text-sm">${notif.message}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${new Date(notif.createdAt).toLocaleString('he-IL')}</p>
            </a>
        `).join('');

        const fullHtml = `<div class="text-right p-2 border-b dark:border-gray-600"><button id="mark-read-btn" class="text-xs text-teal-500 hover:underline">סמן הכל כנקרא</button></div>${notificationsHtml}`;
        
        if(panel) panel.innerHTML = fullHtml;

        document.getElementById('mark-read-btn')?.addEventListener('click', markNotificationsAsRead);
    }

    async function markNotificationsAsRead() {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        try {
            await fetch(`${SERVER_URL}/api/notifications/mark-as-read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            notificationsCache.forEach(n => n.isRead = true);
            updateNotificationBell();
            renderNotifications();
        } catch (error) {
            console.error('Failed to mark notifications as read:', error);
        }
    }
    
    async function checkAuthState() {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');

        if (tokenFromUrl) {
            localStorage.setItem('authToken', tokenFromUrl);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const storedToken = localStorage.getItem('authToken');
        
        if (storedToken) {
            const decodedUser = parseJwt(storedToken);
            currentUser = (decodedUser && decodedUser.id) ? decodedUser : null;
            if (!currentUser) localStorage.removeItem('authToken');
        } else {
            currentUser = null;
        }
        
        initializeSocket(storedToken);

        updateUIForAuthState();
        
        if(currentUser) {
            await Promise.all([fetchUserProfile(), fetchUserFavorites(), fetchNotifications()]);
            initializePushNotifications(); 
        }
        
        resetAndFetchItems();
    }

    function updateUIForAuthState() {
        const themeToggleBtnHtml = `
            <button id="theme-toggle" type="button" class="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 rounded-lg text-sm p-2.5">
                <svg id="theme-toggle-dark-icon" class="hidden w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
                <svg id="theme-toggle-light-icon" class="hidden w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm-.707 8.486a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
            </button>
        `;
        const shareButtonHtml = `
            <button id="share-app-btn" class="text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition p-2 rounded-lg" title="שתף את האפליקציה">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367 2.684z" /></svg>
            </button>
        `;
        
        headerRightContent.innerHTML = themeToggleBtnHtml;
        
        // Clear previous buttons
        actionsBar.innerHTML = '';
        headerLeft.innerHTML = '';
        installAppContainer.innerHTML = '';

        const installButtonHtml = `
            <button id="install-app-btn" class="flex items-center gap-2 bg-amber-400 text-gray-800 font-bold py-2 px-3 rounded-full shadow-md transition transform hover:scale-105" title="להורדת האפליקקציה">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                <span class="text-sm">להורדת האפליקציה</span>
            </button>
        `;

        if (currentUser) {
            const usernameHtml = `<span class="hidden sm:block text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">שלום, ${currentUser.name}</span>`;
            actionsBar.innerHTML += usernameHtml;

            const notificationButtonHtml = `
                <div class="relative">
                    <button id="notifications-btn" class="text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-2 rounded-full transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        <span id="notification-badge" class="notification-badge hidden"></span>
                    </button>
                    <div id="notifications-panel" class="bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700"></div>
                </div>
            `;
            headerLeft.innerHTML = notificationButtonHtml + shareButtonHtml;
            if (deferredPrompt) installAppContainer.innerHTML = installButtonHtml;

            // *** UPDATED: Added Offers Button ***
            const actionButtons = `
                <div id="push-notification-container" class="hidden">
                    <button id="push-notification-btn" class="flex items-center gap-2 text-gray-800 font-bold py-2 px-3 rounded-full shadow-md transition transform hover:scale-105" title="טוען סטטוס התראות..."></button>
                </div>
                <button data-action="show-shops-view" class="text-center text-sm bg-pink-500 text-white py-2 px-4 rounded-md hover:bg-pink-600 transition whitespace-nowrap">חנויות</button>
                <button data-action="show-offers-view" class="text-center text-sm bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-600 transition whitespace-nowrap">הצעות מחיר</button>
                <button data-action="show-saved-searches" class="text-center text-sm bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-600 transition whitespace-nowrap">חיפושים שמורים</button>
                <button id="chat-btn" class="text-center text-sm bg-cyan-500 text-white py-2 px-4 rounded-md hover:bg-cyan-600 transition whitespace-nowrap">הודעות</button>
                <button id="profile-btn" class="text-center text-sm bg-teal-500 text-white py-2 px-4 rounded-md hover:bg-teal-600 transition whitespace-nowrap">האזור האישי</button>
                ${currentUser.email === ADMIN_EMAIL ? `<button id="admin-btn" class="text-center text-sm bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition whitespace-nowrap">פאנל ניהול</button>` : ''}
                <button id="logout-btn" class="text-center text-sm bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition whitespace-nowrap">התנתקות</button>
            `;
            actionsBar.innerHTML += actionButtons;
            updateNotificationBell();

        } else {
            if (deferredPrompt) installAppContainer.innerHTML = installButtonHtml;
            headerLeft.innerHTML = shareButtonHtml;
             actionsBar.innerHTML += `
                <button data-action="show-shops-view" class="text-center text-sm bg-pink-500 text-white py-2 px-4 rounded-md hover:bg-pink-600 transition whitespace-nowrap">חנויות</button>
                <button id="google-login-btn" class="flex justify-center items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold py-2 px-4 text-base border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                    <svg class="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.618-3.319-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.244,44,30.036,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                    <span>התחברות עם Google</span>
                </button>
            `;
        }

        // Re-attach event listeners for all states
        document.getElementById('install-app-btn')?.addEventListener('click', handleInstallClick);
        document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleLogin);
        document.getElementById('profile-btn')?.addEventListener('click', showProfileView);
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
        document.getElementById('chat-btn')?.addEventListener('click', () => showChatView());
        document.getElementById('admin-btn')?.addEventListener('click', () => showView('admin-view'));
        document.getElementById('share-app-btn').addEventListener('click', shareApp);
        
        document.getElementById('notifications-btn')?.addEventListener('click', (e) => toggleNotificationsPanel(e.currentTarget));

        // Theme toggle logic
        const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
        const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

        if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            themeToggleLightIcon.classList.remove('hidden');
        } else {
            themeToggleDarkIcon.classList.remove('hidden');
        }

        const themeToggleBtn = document.getElementById('theme-toggle');
        themeToggleBtn.addEventListener('click', function() {
            themeToggleDarkIcon.classList.toggle('hidden');
            themeToggleLightIcon.classList.toggle('hidden');

            if (localStorage.getItem('color-theme')) {
                if (localStorage.getItem('color-theme') === 'light') {
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('color-theme', 'dark');
                } else {
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('color-theme', 'light');
                }
            } else {
                if (document.documentElement.classList.contains('dark')) {
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('color-theme', 'light');
                } else {
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('color-theme', 'dark');
                }
            }
        });
    }
    
    function handleGoogleLogin() { window.location.href = `${SERVER_URL}/auth/google`; }
    function handleLogout() { 
        localStorage.removeItem('authToken'); 
        currentUser = null; 
        initializeSocket(null);
        showView('main-view'); 
        updateUIForAuthState(); 
        resetAndFetchItems(); 
    }
    
    // --- Profile View Logic ---
    async function fetchUserProfile() {
        const token = localStorage.getItem('authToken'); 
        if (!token || !currentUser) return null;
        try {
            const response = await fetch(`${SERVER_URL}/api/users/${currentUser.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Could not fetch user profile'); 
            currentUserProfile = await response.json();
        } catch(error) {
            console.error("Failed to fetch user profile:", error);
            currentUserProfile = null;
        }
    }

    async function showProfileView() { 
        showView('profile-view'); 
        profileItemsFeed.innerHTML = Array(3).fill(createSkeletonCard()).join(''); 
        const token = localStorage.getItem('authToken'); 
        if (!token) { 
            profileItemsFeed.innerHTML = `<p class="text-center text-red-500">עליך להתחבר כדי לראות את הפריטים שלך.</p>`; 
            return; 
        } 
        try { 
            const itemsResponse = await fetch(`${SERVER_URL}/items/my-items`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!itemsResponse.ok) throw new Error('Could not fetch user items'); 
            const items = await itemsResponse.json(); 

            await fetchUserProfile();

            if (currentUserProfile) {
                if (currentUserProfile.isVerified) {
                    const buttonText = currentUserProfile.shop ? 'נהל את החנות שלי' : 'צור חנות חדשה';
                    profileActionsContainer.innerHTML = `
                        <button data-action="manage-shop" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md transition">${buttonText}</button>
                    `;
                } else {
                    profileActionsContainer.innerHTML = `
                        <button data-action="start-verification" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition">הפוך למוכר מאומת</button>
                    `;
                }
            } else {
                profileActionsContainer.innerHTML = '';
            }
            
            profileItemsFeed.innerHTML = ''; 
            if (items.length === 0) { 
                profileItemsFeed.innerHTML = `<div class="text-center py-16 px-4"><h3 class="mt-2 text-lg font-medium text-gray-900 dark:text-gray-200">עדיין לא העלית פריטים</h3><p class="mt-1 text-sm text-gray-500 dark:text-gray-400">לחץ על כפתור הפלוס כדי להתחיל למכור!</p></div>`; 
            } else { 
                items.forEach(item => { 
                    const cardHtml = createItemCard(item); 
                    profileItemsFeed.insertAdjacentHTML('beforeend', cardHtml); 
                }); 
            } 
        } catch (error) { 
            console.error('Failed to fetch profile items:', error); 
            profileItemsFeed.innerHTML = `<p class="text-center text-red-500">שגיאה בטעינת הפריטים שלך.</p>`; 
        } 
    }

    // --- Public Profile & Shops View Logic ---
    async function showPublicProfile(userId) {
        showView('public-profile-view');
        publicProfileView.innerHTML = `
            <div class="my-6 text-center space-y-2">
                <div class="skeleton-loader h-24 w-24 rounded-full mx-auto"></div>
                <div class="skeleton-loader h-8 w-48 mx-auto"></div>
            </div>
            <div class="space-y-6">${Array(2).fill(createSkeletonCard()).join('')}</div>`;

        try {
            const [userResponse, itemsResponse, ratingsResponse] = await Promise.all([
                fetch(`${SERVER_URL}/api/public/users/${userId}`),
                fetch(`${SERVER_URL}/api/public/users/${userId}/items`),
                fetch(`${SERVER_URL}/api/public/users/${userId}/ratings`)
            ]);

            if (!userResponse.ok || !itemsResponse.ok || !ratingsResponse.ok) {
                throw new Error('Failed to load profile data.');
            }

            const user = await userResponse.json();
            const items = await itemsResponse.json();
            const ratings = await ratingsResponse.json();

            let itemsHtml = '';
            if (items.length > 0) {
                items.forEach(item => {
                    itemsHtml += createItemCard(item);
                });
            } else {
                itemsHtml = `<div class="text-center py-16 px-4"><h3 class="mt-2 text-lg font-medium text-gray-900 dark:text-gray-200">למשתמש זה אין פריטים למכירה כרגע</h3></div>`;
            }
            
            let ratingsHtml = '';
            if (ratings.length > 0) {
                ratings.forEach(rating => {
                    ratingsHtml += `
                        <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                            <div class="flex items-center mb-2">
                                <img src="${rating.rater.image || 'https://placehold.co/40x40/e2e8f0/94a3b8?text=?'}" alt="${rating.rater.displayName}" class="w-10 h-10 rounded-full mr-3">
                                <div>
                                    <p class="font-bold">${rating.rater.displayName}</p>
                                    <div class="text-sm text-gray-500 dark:text-gray-400">${new Date(rating.createdAt).toLocaleDateString('he-IL')}</div>
                                </div>
                            </div>
                            <div class="flex items-center mb-2">
                                ${renderStars(rating.rating)}
                            </div>
                            <p class="text-gray-700 dark:text-gray-300">${rating.comment || ''}</p>
                        </div>
                    `;
                });
            } else {
                ratingsHtml = `<div class="text-center py-8 px-4"><p class="text-gray-500 dark:text-gray-400">עדיין אין דירוגים עבור מוכר זה.</p></div>`;
            }

            const rateButtonHtml = (currentUser && currentUser.id !== userId) ? 
                `<button data-action="rate-user" data-user-id="${userId}" data-user-name="${user.displayName}" class="mt-4 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-md transition">דרג את ${user.displayName}</button>` : '';

            const isFollowing = currentUser ? user.followers.includes(currentUser.id) : false;
            const followButtonHtml = (currentUser && currentUser.id !== userId) ?
                `<button data-action="follow-user" data-user-id="${userId}" class="mt-4 ${isFollowing ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600'} text-white font-bold py-2 px-4 rounded-md transition">${isFollowing ? 'הסר עוקב' : 'עקוב'}</button>` : '';
            
            const verifiedBadgeHtml = user.isVerified ? `<svg class="verified-badge" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>` : '';

            const shopButtonHtml = user.shop ? `<button data-action="view-shop" data-shop-id="${user.shop}" class="mt-4 bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-md transition">צפה בחנות</button>` : '';

            publicProfileView.innerHTML = `
                <div class="my-6">
                    <button data-action="show-main-view" class="mb-4 text-teal-500 hover:text-teal-700">&larr; חזרה לפיד הראשי</button>
                    <div class="flex flex-col items-center gap-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                        <img src="${user.image || 'https://placehold.co/96x96/e2e8f0/94a3b8?text=?'}" alt="${user.displayName}" class="w-24 h-24 rounded-full border-4 border-teal-200 dark:border-teal-700">
                        <h2 class="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center">${user.displayName} ${verifiedBadgeHtml}</h2>
                        <div class="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                            <span><strong>${user.followers.length}</strong> עוקבים</span>
                            <span><strong>${user.following.length}</strong> נעקבים</span>
                        </div>
                        <div class="flex items-center gap-2 text-lg">
                            <div class="static-stars">${renderStars(user.averageRating)}</div>
                            <span class="text-gray-600 dark:text-gray-400">(${ratings.length} דירוגים)</span>
                        </div>
                        <div class="flex gap-2">
                            ${shopButtonHtml}
                            ${followButtonHtml}
                            ${rateButtonHtml}
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 class="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4">המלתחה של ${user.displayName}</h3>
                        <div class="space-y-6">${itemsHtml}</div>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4">ביקורות אחרונות</h3>
                        <div class="space-y-4">${ratingsHtml}</div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Failed to show public profile:', error);
            publicProfileView.innerHTML = `<p class="text-center text-red-500">שגיאה בטעינת הפרופיל.</p>`;
        }
    }

    // --- Admin Dashboard Logic ---
    async function fetchAdminDashboardData() {
        // ... (admin code remains the same)
    }

    function renderAdminDashboard(dashboardData, subscribersData, usersData, reportsData) {
        // ... (admin code remains the same)
    }

    async function showAdminUserProfileView(userId) {
        // ... (admin code remains the same)
    }


    // --- Item Card Creation & Helpers ---
    function getWhatsAppLink(contact, title) {
        if (!contact) return null;
        let digits = String(contact).replace(/\D/g, '');
        if (digits.startsWith('9725')) { /* Correct format */ } 
        else if (digits.startsWith('05')) { digits = '972' + digits.substring(1); } 
        else { return null; }
        if (digits.length !== 12) return null;
        const whatsappMessage = encodeURIComponent(`היי, אני מתעניין/ת בפריט '${title}' שפרסמת בסטייל מתגלגל.`);
        return `https://wa.me/${digits}?text=${whatsappMessage}`;
    }
    
    function timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return `לפני ${Math.floor(interval)} שנים`;
        interval = seconds / 2592000;
        if (interval > 1) return `לפני ${Math.floor(interval)} חודשים`;
        interval = seconds / 86400;
        if (interval > 1) return `לפני ${Math.floor(interval)} ימים`;
        interval = seconds / 3600;
        if (interval > 1) return `לפני ${Math.floor(interval)} שעות`;
        interval = seconds / 60;
        if (interval > 1) return `לפני ${Math.floor(interval)} דקות`;
        return `ממש עכשיו`;
    }

    function renderStarsForCard(rating) {
        if (!rating || rating === 0) return '';
        const roundedRating = Math.round(rating);
        let starsHtml = '';
        for (let i = 0; i < 5; i++) {
            starsHtml += `<svg class="w-4 h-4 ${i < roundedRating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-500'}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>`;
        }
        return `<div class="flex items-center gap-1">${starsHtml}</div>`;
    }

    // *** THIS IS THE FULLY CORRECTED FUNCTION ***
    function createItemCard(item) {
        if (!item || !item.owner) {
            console.error("Attempting to render an item with a missing owner. Skipping.", item);
            return '';
        }
        allItemsCache[item._id] = item;
        
        const isOwner = currentUser && item.owner._id === currentUser.id;
        const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
        const isPostByAdmin = item.affiliateLink && item.affiliateLink.length > 0;
        
        const soldStampHtml = item.sold ? `<div class="sold-stamp">נמכר</div>` : '';
        
        const promotedBadgeHtml = item.isPromoted ? `<div class="promoted-badge"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg><span>מקודם</span></div>` : '';
        const promoteButtonHtml = (isOwner && !item.isPromoted && !item.sold) ? `<button data-id="${item._id}" data-action="promote-item" class="text-gray-400 hover:text-amber-500 transition" title="קדם פריט"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg></button>` : '';

        const soldButtonText = item.sold ? 'החזר למכירה' : 'סמן כנמכר';
        const soldButtonIcon = item.sold ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.707a1 1 0 00-1.414-1.414L9 8.586 7.707 7.293a1 1 0 00-1.414 1.414L7.586 10l-1.293 1.293a1 1 0 101.414 1.414L9 11.414l1.293 1.293a1 1 0 001.414-1.414L10.414 10l1.293-1.293z" clip-rule="evenodd" /></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>`;
        const soldButtonHtml = (isOwner || isAdmin) ? `<button data-id="${item._id}" data-action="toggle-sold" class="text-gray-400 hover:text-green-500 transition" title="${soldButtonText}">${soldButtonIcon}</button>` : '';
        const editButtonHtml = (isOwner || isAdmin) && !item.sold ? `<button data-id="${item._id}" data-action="edit-item" class="text-gray-400 hover:text-blue-500 transition" title="עריכת פריט"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg></button>` : '';
        const deleteButtonHtml = (isOwner || isAdmin) ? `<button data-id="${item._id}" data-action="delete-item" class="text-gray-400 hover:text-red-500 transition" title="מחיקת פריט"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg></button>` : '';
        const reportButtonHtml = (currentUser && !isOwner) ? `<button data-id="${item._id}" data-action="report-item" class="text-gray-400 hover:text-amber-500 transition flex items-center gap-1" title="דיווח על פריט"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 01-1-1V6z" clip-rule="evenodd" /></svg><span class="text-xs">דווח</span></button>` : '';
        const favoriteButtonHtml = currentUser ? `<button data-id="${item._id}" data-action="toggle-favorite" class="favorite-btn text-gray-400 hover:text-red-500 transition ${favorites.includes(item._id) ? 'favorited' : ''}" title="הוסף למועדפים"><svg class="w-6 h-6" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>` : '';
        const shopButtonHtml = item.owner.shop ? `<button data-action="view-shop" data-shop-id="${item.owner.shop}" class="text-gray-400 hover:text-pink-500 transition flex items-center gap-1" title="צפייה בחנות"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg><span class="text-xs font-medium whitespace-nowrap">צפייה בחנות</span></button>` : '';

    let ownerName = (item.owner.displayName) ? item.owner.displayName : 'אנונימי';
    if (item.owner.email && item.owner.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        ownerName = 'מנהל';
    }
    
    const imageUrlsJson = JSON.stringify(item.imageUrls || []);
    const categoryName = categoryMap[item.category] || 'ללא קטגוריה';
    const conditionName = conditionMap[item.condition] || 'לא צוין';
    const categoryHtml = `<span class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded-full">${categoryName}</span>`; 
    const conditionHtml = `<span class="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 text-xs font-medium px-2.5 py-0.5 rounded-full">${conditionName}</span>`;
    const brandHtml = item.brand ? `<span class="text-xs font-semibold text-gray-500 dark:text-gray-400">${item.brand}</span>` : '';
    const locationHtml = item.location ? `<span class="flex items-center text-xs text-gray-500 dark:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>${item.location}</span>` : '';
    
    const verifiedBadgeHtml = item.owner.isVerified ? `<svg class="verified-badge" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>` : '';
    const ownerRatingHtml = renderStarsForCard(item.owner.averageRating);
    const ownerNameHtml = `<div class="flex items-center gap-2"><p class="text-sm text-teal-700 dark:text-teal-400 font-semibold cursor-pointer hover:underline" data-action="view-profile" data-user-id="${item.owner._id}">${ownerName}</p>${ownerRatingHtml}</div>`;
    const dateHtml = `<p class="text-xs text-gray-400 dark:text-gray-500 mt-2">פורסם ${timeAgo(item.createdAt)}</p>`;


    let purchaseButtonsHtml = '';
    const whatsAppLink = getWhatsAppLink(item.contact, item.title);
    const baseButtonClasses = "mt-2 block w-full text-center text-white font-bold py-2 px-4 text-sm rounded-md transition flex items-center justify-center gap-2";
    
    if (isPostByAdmin) {
        const link = item.affiliateLink || whatsAppLink;
        purchaseButtonsHtml = link ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="${baseButtonClasses} bg-amber-500 hover:bg-amber-600">... לרכישה ...</a>` : '';
    } else if (!isOwner && currentUser) {
        const offerButton = `<button data-action="make-offer" data-item-id="${item._id}" data-item-name="${item.title}" class="${baseButtonClasses} bg-purple-500 hover:bg-purple-600"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a1.5 1.5 0 01.954 2.852l-2.46 1.64A1.5 1.5 0 118 6.5V3.5a1.5 1.5 0 012 0zM8.5 7a.5.5 0 00-1 0v3a.5.5 0 001 0V7z" /><path d="M3 6.5A1.5 1.5 0 014.5 5h1.125a1.5 1.5 0 110 3H4.5A1.5 1.5 0 013 6.5zM15 6.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" /></svg><span>הצע הצעה</span></button>`;
        const chatButton = `<button data-action="start-chat" data-seller-id="${item.owner._id}" data-item-id="${item._id}" class="${baseButtonClasses} bg-green-500 hover:bg-green-600"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg><span>צ'אט באפליקציה</span></button>`;
        const whatsappButton = whatsAppLink ? `<a href="${whatsAppLink}" target="_blank" rel="noopener noreferrer" class="${baseButtonClasses} bg-green-700 hover:bg-green-800"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.523.074-.797.347-.272.272-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg><span>שיחה בווטסאפ</span></a>` : '';
        purchaseButtonsHtml = `<div class="space-y-2">${offerButton}${chatButton}${whatsappButton}</div>`;
    }

    return `<div id="item-${item._id}" class="item-card bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-2xl overflow-hidden flex flex-col ${item.sold ? 'sold' : ''} ${item.isPromoted ? 'promoted' : ''}" data-category="${item.category || 'other'}">
                <div class="relative">
                    <div class="main-image-container relative" data-action="open-gallery" data-images='${imageUrlsJson}' data-index="0">
                        <img src="${item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls[0] : 'https://placehold.co/400x400/e2e8f0/94a3b8?text=אין+תמונה'}" alt="${item.title}" class="w-full h-64 object-cover cursor-pointer">
                        ${soldStampHtml}
                        ${promotedBadgeHtml}
                    </div>
                    <div class="absolute top-2 right-2">${favoriteButtonHtml}</div>
                </div>
                <div class="p-4 flex flex-col flex-grow">
                    <div class="flex justify-between items-start">
                        <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">${item.title}</h2>
                        <div class="bg-teal-500 text-white font-bold text-lg py-1 px-3 rounded-md flex-shrink-0 ${item.sold ? 'bg-gray-400' : ''}">₪${item.price}</div>
                    </div>
                    <div class="flex items-center my-2 gap-2 flex-wrap">${categoryHtml} ${conditionHtml} ${brandHtml}</div>
                    <p class="text-gray-600 dark:text-gray-300 text-sm flex-grow">${item.description || ''}</p>
                    ${dateHtml}
                    <div class="mt-2 text-sm">${locationHtml}</div>
                    <div class="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        ${!item.sold ? purchaseButtonsHtml : ''}
                        <div class="flex justify-between items-center">
                            <div class="flex items-center" title="פורסם על ידי ${ownerName}">
                                ${ownerNameHtml} ${verifiedBadgeHtml}
                            </div>
                            <div class="flex items-center gap-2">
                                ${shopButtonHtml}
                                ${promoteButtonHtml}
                                ${reportButtonHtml}
                                ${soldButtonHtml} 
                                ${editButtonHtml} 
                                ${deleteButtonHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
}

    
    // ... (rest of the file from rating logic onwards)
    // ...
    // --- The ENTIRE rest of the app.js file should follow from here ---
    // ...
