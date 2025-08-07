const fs = require('fs').promises;
const path = require('path');

const subscribersFilePath = path.join(__dirname, 'subscribers.json');

// Function to read subscribers from the file
async function getSubscribers() {
    try {
        const data = await fs.readFile(subscribersFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If the file doesn't exist, return an empty array
        if (error.code === 'ENOENT') {
            return [];
        }
        // For other errors, re-throw them
        throw error;
    }
}

// Function to add a new subscriber
async function addSubscriber(newUser) {
    try {
        const subscribers = await getSubscribers();
        
        // Check if the user's email already exists to avoid duplicates
        const existingSubscriber = subscribers.find(sub => sub.email === newUser.email);
        
        if (!existingSubscriber) {
            subscribers.push({
                displayName: newUser.displayName,
                email: newUser.email,
                subscribedAt: new Date().toISOString()
            });
            await fs.writeFile(subscribersFilePath, JSON.stringify(subscribers, null, 2));
            console.log(`New subscriber added: ${newUser.email}`);
        } else {
            console.log(`Subscriber already exists: ${newUser.email}`);
        }
    } catch (error) {
        console.error('Error adding subscriber:', error);
    }
}

module.exports = {
    getSubscribers,
    addSubscriber
};
