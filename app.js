document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const SERVER_URL = 'https://octopus-app-iwic4.ondigitalocean.app';

    // --- UI Element Selectors ---
    const itemsFeed = document.getElementById('items-feed');
    const actionsBar = document.getElementById('actions-bar');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');

    // --- RENDER FUNCTIONS ---

    function renderActionButtons() {
        // This data would normally come from a user session
        const actions = [
            { label: 'הוספת פריט', icon: '➕', color: 'bg-red-500' },
            { label: 'הפריטים שלי', icon: '👕', color: 'bg-blue-500' },
            { label: 'הודעות', icon: '💬', color: 'bg-green-500' },
            { label: 'מועדפים', icon: '❤️', color: 'bg-yellow-500' },
        ];
        actionsBar.innerHTML = actions.map(action => `
            <button class="${action.color} text-white action-btn">
                <span>${action.icon}</span>
                <span>${action.label}</span>
            </button>
        `).join('');
    }

    function renderStars(rating = 0) {
        let stars = '';
        const fullStars = Math.round(rating);
        for (let i = 0; i < 5; i++) {
            stars += `<svg class="w-4 h-4 ${i < fullStars ? 'text-yellow-400' : 'text-gray-300'}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>`;
        }
        return `<div class="flex items-center">${stars}</div>`;
    }

    function createItemCard(item) {
        const ownerName = item.owner?.displayName || 'מוכר אנונימי';
        const ownerImage = item.owner?.image || 'https://via.placeholder.com/40';
        const isVerified = item.owner?.isVerified || false;
        const mainImage = item.imageUrls?.[0] || 'https://via.placeholder.com/400x300.png?text=אין+תמונה';
        const ratingStars = renderStars(item.owner?.averageRating);
        const itemConditionText = { 'new-with-tags': 'חדש עם טיקט', 'new-without-tags': 'חדש ללא טיקט', 'like-new': 'כמו חדש', 'good': 'מצב טוב', 'used': 'משומש' };
        const infoText = item.size ? `מידה: ${item.size}` : (itemConditionText[item.condition] || '');

        const verifiedBadge = isVerified ? `<svg class="verified-badge" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>` : '';

        return `
            <div class="item-card">
                <div class="relative"><img src="${mainImage}" alt="${item.title || ''}" class="w-full h-56 object-cover"></div>
                <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 border-t border-b dark:border-gray-600">
                    <span class="text-lg font-bold text-teal-600">₪${item.price || '0'}</span>
                    <span class="text-sm text-gray-600 dark:text-gray-300 font-semibold">${infoText}</span>
                </div>
                <div class="flex justify-between items-center p-3">
                    <div class="flex items-center"><img src="${ownerImage}" alt="${ownerName}" class="w-8 h-8 rounded-full ml-2"><div><p class="font-bold text-sm">${ownerName}</p>${ratingStars}</div></div>
                </div>
                <div class="card-actions"><button>שליחת הודעה</button><button>הוספה לסל</button></div>
            </div>`;
    }

    async function loadItems() {
        // ... (loadItems function remains the same)
    }

    // --- INITIALIZE APP ---
    renderActionButtons();
    loadItems();
});
