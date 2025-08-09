// app.js (גרסה סופית ויציבה)

document.addEventListener('DOMContentLoaded', () => {

    const SERVER_URL = 'https://octopus-app-iwic4.ondigitalocean.app/';
    const ADMIN_EMAIL = 'ohadf1976@gmail.com';
    const CLIENT_URL = window.location.origin;

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

    const galleryImage = document.getElementById('gallery-image');
    const galleryClose = document.getElementById('gallery-close');
    const galleryPrev = document.getElementById('gallery-prev');
    const galleryNext = document.getElementById('gallery-next');
    const galleryCounter = document.getElementById('gallery-counter');
    const galleryPanzoomViewport = document.getElementById('gallery-panzoom-viewport');
    const galleryZoomInBtn = document.getElementById('gallery-zoom-in');
    const galleryZoomOutBtn = document.getElementById('gallery-zoom-out');

    const toastNotification = document.getElementById('toast-notification');

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

    let currentPage = 1;
    let isLoading = false;
    let hasMorePages = true;

    const categoryMap = {
        'pants': 'מכנסיים', 'shirts': 'חולצות', 'jackets': 'ג\'קטים',
        'dresses': 'שמלות', 'skirts': 'חצאיות', 'top': 'טופ',
        'tank-tops': 'גופיות', 'blazer': 'בלייזר', 'accessories': 'אקססוריז',
        'general': 'כללי'
    };

    const conditionMap = {
        'new-with-tags': 'חדש עם טיקט', 'new-without-tags': 'חדש ללא טיקט',
        'like-new': 'כמו חדש', 'good': 'במצב טוב', 'used': 'משומש'
    };

    function initializeSocket(token) {
        if (socket) {
            socket.disconnect();
        }
        socket = io(SERVER_URL, {
            transports: ['websocket'],
            auth: { token: token }
        });

        socket.on('connect', () => console.log('Connected to server with socket ID:', socket.id));
        socket.on('newItem', (item) => {
            if (filterInput.value === '' && categorySelect.value === 'all') {
                displayItem(item, true, itemsFeed);
            } else {
                showToast("פריט חדש עלה! נקה סינונים כדי לראות.");
            }
        });
        socket.on('itemDeleted', (itemId) => {
            document.getElementById(`item-${itemId}`)?.remove();
            profileItemsFeed.querySelector(`#item-${itemId}`)?.remove();
        });
        socket.on('itemUpdated', (updatedItem) => {
            const card = document.getElementById(`item-${updatedItem._id}`);
            if (card) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = createItemCard(updatedItem);
                const newCard = tempDiv.firstChild;
                if (newCard) card.replaceWith(newCard);
            }
            const profileCard = profileItemsFeed.querySelector(`#item-${updatedItem._id}`);
            if (profileCard) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = createItemCard(updatedItem);
                const newCard = tempDiv.firstChild;
                if (newCard) profileCard.replaceWith(newCard.cloneNode(true));
            }
        });
        socket.on('newMessage', (message) => {
            if (chatView.classList.contains('active') && message.conversation === currentConversationId) {
                appendMessage(message);
            }
        });
        socket.on('newConversation', (data) => showToast(`שיחה חדשה התחילה עם ${data.buyerName} לגבי "${data.itemName}"`));
        socket.on('newNotification', (notification) => {
            notificationsCache.unshift(notification);
            updateNotificationBell();
            showToast(notification.message);
        });
    }

    function showToast(message) {
        toastNotification.textContent = message;
        toastNotification.classList.remove('hidden', 'opacity-0');
        setTimeout(() => {
            toastNotification.classList.add('opacity-0');
            setTimeout(() => toastNotification.classList.add('hidden'), 500);
        }, 2500);
    }

    function showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId)?.classList.add('active');
        window.scrollTo(0, 0);
        if (viewId === 'admin-view') fetchAdminDashboardData();
        if (viewId === 'shops-view') fetchShops();
    }

    function createItemCard(item) {
        try {
            if (!item || !item.owner) {
                console.error("Skipping item due to missing owner data:", item);
                return '';
            }

            allItemsCache[item._id] = item;
            const isOwner = currentUser && item.owner._id === currentUser.id;
            const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
            const soldStampHtml = item.sold ? `<div class="sold-stamp">נמכר</div>` : '';
            const promotedBadgeHtml = item.isPromoted ? `<div class="promoted-badge"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg><span>מקודם</span></div>` : '';
            const favoriteButtonHtml = currentUser ? `<button data-id="${item._id}" data-action="toggle-favorite" class="favorite-btn ${favorites.includes(item._id) ? 'favorited' : ''}" title="הוסף למועדפים"><svg class="w-6 h-6" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>` : '';
            const imageUrlsJson = JSON.stringify(item.imageUrls || []);
            const categoryName = categoryMap[item.category] || 'כללי';
            const conditionName = conditionMap[item.condition] || 'לא צוין';
            let ownerName = (item.owner.displayName) ? item.owner.displayName : 'אנונימי';
            const verifiedBadgeHtml = item.owner.isVerified ? `<svg class="verified-badge" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>` : '';
            const ownerNameHtml = `<p class="text-sm text-teal-700 dark:text-teal-400 font-semibold cursor-pointer hover:underline" data-action="view-profile" data-user-id="${item.owner._id}">${ownerName}</p>`;
            const dateHtml = `<p class="text-xs text-gray-400 dark:text-gray-500 mt-2">פורסם ${timeAgo(item.createdAt)}</p>`;
            let purchaseButtonsHtml = '';
            const whatsAppLink = getWhatsAppLink(item.contact, item.title);
            if (!isOwner) {
                const chatButton = `<button data-action="start-chat" data-seller-id="${item.owner._id}" data-item-id="${item._id}" class="mt-2 block w-full text-center text-white font-bold py-2 px-4 text-sm rounded-md transition flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600">צ'אט באפליקציה</button>`;
                const whatsappButton = whatsAppLink ? `<a href="${whatsAppLink}" target="_blank" rel="noopener noreferrer" class="mt-2 block w-full text-center text-white font-bold py-2 px-4 text-sm rounded-md transition flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800">שיחה בווטסאפ</a>` : '';
                purchaseButtonsHtml = `<div class="space-y-2">${chatButton}${whatsappButton}</div>`;
            }
            const editButtons = (isOwner || isAdmin) ? `
                <button data-id="${item._id}" data-action="toggle-sold" class="text-gray-400 hover:text-green-500 transition" title="${item.sold ? 'החזר למכירה' : 'סמן כנמכר'}">${item.sold ? 'Undo' : 'Sold'}</button>
                ${!item.sold ? `<button data-id="${item._id}" data-action="edit-item" class="text-gray-400 hover:text-blue-500 transition" title="עריכת פריט">Edit</button>` : ''}
                <button data-id="${item._id}" data-action="delete-item" class="text-gray-400 hover:text-red-500 transition" title="מחיקת פריט">Delete</button>
            ` : '';
            const reportButtonHtml = (currentUser && !isOwner) ? `<button data-id="${item._id}" data-action="report-item" class="text-gray-400 hover:text-amber-500 transition" title="דיווח על פריט">Report</button>` : '';

            return `<div id="item-${item._id}" class="item-card bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col ${item.sold ? 'sold' : ''} ${item.isPromoted ? 'promoted' : ''}">
                        <div class="relative">
                            <div class="main-image-container relative" data-action="open-gallery" data-images='${imageUrlsJson}'>
                                <img src="${item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls[0] : 'https://placehold.co/400x400'}" alt="${item.title}" class="w-full h-64 object-cover cursor-pointer">
                                ${soldStampHtml}${promotedBadgeHtml}
                            </div>
                            <div class="absolute top-2 right-2">${favoriteButtonHtml}</div>
                        </div>
                        <div class="p-4 flex flex-col flex-grow">
                            <div class="flex justify-between items-start">
                                <h2 class="text-lg font-bold">${item.title}</h2>
                                <div class="bg-teal-500 text-white font-bold text-lg py-1 px-3 rounded-md flex-shrink-0">${'₪' + item.price}</div>
                            </div>
                            <div class="flex items-center my-2 gap-2 flex-wrap">
                                <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">${categoryName}</span>
                                <span class="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">${conditionName}</span>
                            </div>
                            <p class="text-gray-600 dark:text-gray-300 text-sm flex-grow">${item.description || ''}</p>
                            ${dateHtml}
                            <div class="mt-auto pt-4 border-t">
                                ${purchaseButtonsHtml}
                                <div class="flex justify-between items-center mt-2">
                                    <div class="flex items-center gap-2">${ownerNameHtml}${verifiedBadgeHtml}</div>
                                    <div class="flex items-center gap-2">${editButtons}${reportButtonHtml}</div>
                                </div>
                            </div>
                        </div>
                    </div>`;
        } catch (error) {
            console.error('Error creating card for item:', item, error);
            return ''; // Return empty string on error to prevent crashing the entire render
        }
    }

    async function fetchItems(reset = false) {
        if (isLoading) return;
        isLoading = true;

        if (reset) {
            currentPage = 1;
            hasMorePages = true;
            itemsFeed.innerHTML = '';
            emptyState.classList.add('hidden');
        }

        loadingIndicator.classList.toggle('hidden', reset);
        if(reset) itemsFeed.innerHTML = Array(4).fill(createSkeletonCard()).join('');

        try {
            const params = new URLSearchParams({
                page: currentPage, limit: 10, sort: sortSelect.value,
                category: categorySelect.value, condition: conditionSelect.value,
                size: sizeFilterInput.value.trim(), searchTerm: filterInput.value.trim(),
                brand: brandFilterInput.value.trim(), location: locationFilterInput.value.trim(),
            });
            if (minPriceInput.value) params.append('minPrice', minPriceInput.value);
            if (maxPriceInput.value) params.append('maxPrice', maxPriceInput.value);

            const response = await fetch(`${SERVER_URL}/items?${params.toString()}`);
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            if (reset) itemsFeed.innerHTML = '';

            data.items.forEach(item => displayItem(item, false, itemsFeed));

            hasMorePages = data.currentPage < data.totalPages;
            currentPage++;

            emptyState.classList.toggle('hidden', itemsFeed.children.length > 0);

        } catch (error) {
            console.error('Failed to fetch items:', error);
            if (reset) itemsFeed.innerHTML = `<div class="text-center text-red-500 col-span-full py-8"><p>שגיאה בטעינת הפריטים.</p><p class="text-xs text-gray-400">${error.message}</p><button data-action="retry-fetch" class="mt-4 bg-teal-500 text-white font-bold py-2 px-4 rounded-md">נסה שוב</button></div>`;
        } finally {
            isLoading = false;
            loadingIndicator.classList.add('hidden');
        }
    }

    // --- All other functions (checkAuthState, updateUIForAuthState, etc.) remain the same ---
    // Make sure to copy the full app.js content from previous turns, only replacing createItemCard.
});
