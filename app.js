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
        // *** THIS IS THE UPDATED PART ***
        const offerButton = `<button data-action="make-offer" data-item-id="${item._id}" data-item-name="${item.title}" class="${baseButtonClasses} bg-purple-500 hover:bg-purple-600"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17.707 9.293a1 1 0 00-1.414 0L10 15.586 3.707 9.293a1 1 0 00-1.414 1.414l7 7a1 1 0 001.414 0l7-7a1 1 0 000-1.414zM10 2a1 1 0 011 1v11a1 1 0 11-2 0V3a1 1 0 011-1z" clip-rule="evenodd" /></svg><span>הצע הצעה</span></button>`;
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
