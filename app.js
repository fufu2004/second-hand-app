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

        if (viewId === 'admin-view') {
            fetchAdminDashboardData();
        }
        if (viewId === 'shops-view') {
            fetchShops();
        }
    }
    function hideAllModals() { allModals.forEach(modal => { modal.classList.add('opacity-0'); const content = modal.querySelector('.modal-content, .gallery-content'); if (content) { content.classList.add('opacity-0', '-translate-y-10'); } setTimeout(() => { modal.classList.add('hidden'); }, 300); }); }
    function showModal(modalElement) { allModals.forEach(modal => { if (modal !== modalElement) { modal.classList.add('hidden', 'opacity-0'); } }); modalElement.classList.remove('hidden'); setTimeout(() => { modalElement.classList.remove('opacity-0'); const content = modalElement.querySelector('.modal-content, .gallery-content'); if (content) { content.classList.remove('opacity-0', '-translate-y-10'); } }, 10); }
    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', hideAllModals));
    allModals.forEach(modal => modal.addEventListener('click', (e) => { if (e.target === modal) hideAllModals(); }));

    // --- START: UPDATED Gallery (Lightbox) System with Panzoom ---
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
    // --- END: UPDATED Gallery System ---

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
            <a href="${notif.link || '#'}" class="block p-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b dark:border-gray-600 ${!notif.isRead ? 'font-bold' : ''}">
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

            const actionButtons = `
                <div id="push-notification-container" class="hidden">
                    <button id="push-notification-btn" class="flex items-center gap-2 text-gray-800 font-bold py-2 px-3 rounded-full shadow-md transition transform hover:scale-105" title="טוען סטטוס התראות..."></button>
                </div>
                <button data-action="show-shops-view" class="text-center text-sm bg-pink-500 text-white py-2 px-4 rounded-md hover:bg-pink-600 transition whitespace-nowrap">חנויות</button>
                <button data-action="show-saved-searches" class="text-center text-sm bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-600 transition whitespace-nowrap">חיפושים שמורים</button>
                <button id="chat-btn" class="text-center text-sm bg-cyan-500 text-white py-2 px-4 rounded-md hover:bg-cyan-600 transition whitespace-nowrap">הודעות</button>
                <button id="profile-btn" class="text-center text-sm bg-teal-500 text-white py-2 px-4 rounded-md hover:bg-teal-600 transition whitespace-nowrap">האזור האישי</button>
                ${currentUser.email === ADMIN_EMAIL ? `<button id="admin-btn" class="text-center text-sm bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-600 transition whitespace-nowrap">פאנל ניהול</button>` : ''}
                <button id="logout-btn" class="text-center text-sm bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition whitespace-nowrap">התנתקות</button>
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

    // ... (Paste the rest of the app.js content from your backup here) ...
});
