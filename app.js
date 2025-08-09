document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const SERVER_URL = 'https://octopus-app-iwic4.ondigitalocean.app';
    const ADMIN_EMAIL = 'ohadf1976@gmail.com';
    const CLIENT_URL = window.location.origin;

    // --- UI Element Selectors ---
    const itemsFeed = document.getElementById('items-feed');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');

    // Function to create an item card HTML
    function createItemCard(item) {
        const ownerName = item.owner ? item.owner.displayName : 'מוכר לא ידוע';
        const ownerImage = item.owner ? item.owner.image : 'https://via.placeholder.com/150';
        const isVerified = item.owner ? item.owner.isVerified : false;

        const soldClass = item.sold ? 'sold' : '';
        const soldStamp = item.sold ? '<div class="sold-stamp">נמכר</div>' : '';

        // Basic verification badge
        const verifiedBadge = isVerified ? `
            <svg class="verified-badge" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>` : '';

        return `
            <div class="item-card bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${soldClass}" data-item-id="${item._id}">
                ${soldStamp}
                <div class="relative main-image-container">
                    <img src="${item.imageUrls[0]}" alt="${item.title}" class="w-full h-64 object-cover">
                </div>
                <div class="p-4">
                    <h3 class="text-lg font-bold truncate">${item.title}</h3>
                    <p class="text-gray-600 dark:text-gray-300 text-sm mb-2">₪${item.price}</p>
                    <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <img src="${ownerImage}" alt="${ownerName}" class="w-6 h-6 rounded-full mr-2">
                        <span>${ownerName}</span>
                        ${verifiedBadge}
                    </div>
                     <button class="purchase-btn w-full mt-4 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded transition-colors">
                        לפרטים ורכישה
                    </button>
                </div>
            </div>
        `;
    }

    // Function to render items to the feed
    function renderItems(items) {
        itemsFeed.innerHTML = ''; // Clear previous items

        if (items.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            const cardsHtml = items.map(createItemCard).join('');
            itemsFeed.innerHTML = cardsHtml;
        }
    }

    // Main function to fetch and display items
    async function loadItems() {
        loadingIndicator.style.display = 'block';
        itemsFeed.innerHTML = '';
        emptyState.style.display = 'none';

        try {
            const response = await fetch(`${SERVER_URL}/api/items`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const items = await response.json();
            renderItems(items);
        } catch (error) {
            console.error("Failed to load items:", error);
            emptyState.style.display = 'block';
            emptyState.querySelector('h3').textContent = 'תקלה בטעינת הפריטים';
            emptyState.querySelector('p').textContent = 'לא ניתן היה להתחבר לשרת. נסה לרענן את הדף.';
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // --- Initial Load ---
    loadItems();

    // NOTE: The rest of the original app.js logic (event listeners, modals, etc.) would go here.
    // This provided version focuses only on fixing the main item loading and display functionality.
});
