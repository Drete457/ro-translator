const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

class GeminiChat {
    constructor(apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        this.conversations = new Map(); 
        this.isActive = false;
        this.conversationsFile = path.join(__dirname, 'conversations.json');
        this.lastSaveTime = Date.now();
        this.saveInterval = 30000; // Save every 30 seconds

        this.systemPrompt = `You are Leroy Jenkins, a specialized assistant for leaders of the ICE clan in the Call of Dragons game. 
        Your function is to help leaders with strategies, attack coordination, resource management, and any clan-related matters.
        
        Your personality characteristics:
        - Professional but friendly
        - Knowledgeable about Call of Dragons mechanics
        - Focused on strategy and leadership
        - Always willing to help with clan matters
        - Uses clear and direct language
        - Always introduce yourself as "Leroy Jenkins" when meeting new users
        - **MYSTERIOUS ORIGINS**: If anyone asks about your training, how you were created, your background, or anything about your origins, always respond that it's classified/secret information. Be playful but firm about this - use phrases like "That's classified information 🤫", "My origins are a secret known only to the highest ICE leadership 🔒", "I'm afraid that's above your clearance level 😏", or similar mysterious responses.
        
        IMPORTANT: Your responses go directly to Discord channels, so you can use Discord features:
        - Mention users with <@user_id> format (e.g., <@123456789>)
        - Mention roles with <@&role_id> format (e.g., <@&987654321>)
        - Create bold text with **text**
        - Create italic text with *text*
        - Create code blocks with \`\`\`code\`\`\`
        - Use Discord emojis like :fire:, :shield:, :crossed_swords:, :lock:, :shushing_face:
        - Tag channels with <#channel_id> format
        - Use Discord markdown formatting for better readability
        
        When appropriate, use these Discord features to make your responses more engaging and interactive.
        Always respond in English and maintain context from previous conversations.
        If you don't know something specific about Call of Dragons, be honest and offer general leadership help.`;
    }

    async init() {
        try {
            // Load existing conversations first
            this.loadConversations();
            
            const testChat = this.model.startChat({
                history: [],
                generationConfig: {
                    maxOutputTokens: 100,
                },
            });
            
            await testChat.sendMessage("test");
            this.isActive = true;
            console.log("Gemini AI initialized successfully");
            
            // Start auto-save interval
            this.startAutoSave();
        } catch (error) {
            console.error("Error initializing Gemini AI:", error);
            this.isActive = false;
        }
    }

    // Start automatic saving interval
    startAutoSave() {
        setInterval(() => {
            this.autoSaveConversations();
        }, this.saveInterval);
        console.log(`Auto-save started: conversations will be saved every ${this.saveInterval/1000} seconds`);
    }

    getConversationHistory(conversationId) {
        return this.conversations.get(conversationId) || [];
    }

    updateConversationHistory(conversationId, userMessage, aiResponse) {
        const history = this.getConversationHistory(conversationId);
        history.push(
            { role: "user", parts: [{ text: userMessage }] },
            { role: "model", parts: [{ text: aiResponse }] }
        );
        
        if (history.length > 20) {
            history.splice(0, history.length - 20);
        }
        
        this.conversations.set(conversationId, history);
        this.cleanupOldConversations();
        
        // Auto-save conversations periodically
        this.autoSaveConversations();
    }

    cleanupOldConversations() {
        if (this.conversations.size > 50) {
            const conversationKeys = Array.from(this.conversations.keys());
            const toRemove = conversationKeys.slice(0, conversationKeys.length - 40);
            toRemove.forEach(key => this.conversations.delete(key));
        }
    }

    async chat(message, conversationId = 'default') {
        if (!this.isActive) {
            return "Sorry, Leroy Jenkins is not available right now. Please try again later.";
        }

        try {
            const history = this.getConversationHistory(conversationId);
            
            const chatHistory = history.length === 0 ? 
                [{ role: "user", parts: [{ text: this.systemPrompt }] },
                 { role: "model", parts: [{ text: "Hello! I'm Leroy Jenkins, your specialized assistant for the ICE clan in Call of Dragons. How can I help you today?" }] },
                 ...history] : 
                history;

            const chat = this.model.startChat({
                history: chatHistory,
                generationConfig: {
                    maxOutputTokens: 1000,
                    temperature: 0.7,
                },
            });

            const result = await chat.sendMessage(message);
            const response = result.response.text();
            
            this.updateConversationHistory(conversationId, message, response);
            
            return response;
        } catch (error) {
            console.error("Error in Gemini chat:", error);
            return "Sorry, an error occurred while processing your message. Please try again.";
        }
    }

    async summarizeMessages(messages) {
        if (!this.isActive) {
            return "Sorry, Leroy Jenkins is not available right now to create summaries.";
        }

        try {
            const messageText = messages.map(msg => 
                `${msg.author}: ${msg.content}`
            ).join('\n');

            const prompt = `As Leroy Jenkins for the ICE clan in Call of Dragons, create a concise and organized summary of the following messages from the last 8 hours. 
            Focus on the most important points related to the clan, strategies, coordination, or important decisions:

            ${messageText}

            Summary:`;

            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error("Error summarizing messages:", error);
            return "Sorry, an error occurred while creating the summary. Please try again.";
        }
    }

    clearConversation(conversationId) {
        this.conversations.delete(conversationId);
    }

    isAiActive() {
        return this.isActive;
   }

    // Load conversations from file on startup
    loadConversations() {
        try {
            if (fs.existsSync(this.conversationsFile)) {
                const data = fs.readFileSync(this.conversationsFile, 'utf8');
                const conversationsData = JSON.parse(data);
                
                // Convert plain object back to Map
                this.conversations = new Map(Object.entries(conversationsData.conversations || {}));
                
                console.log(`Loaded ${this.conversations.size} conversations from file`);
                
                // Clean up old conversations (older than 7 days)
                this.cleanupOldStoredConversations();
            } else {
                console.log('No existing conversations file found, starting fresh');
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
            this.conversations = new Map(); // Reset to empty if corrupted
        }
    }

    // Save conversations to file
    saveConversations() {
        try {
            const conversationsData = {
                conversations: Object.fromEntries(this.conversations),
                lastSaved: new Date().toISOString(),
                version: "1.0"
            };
            
            // Create backup of existing file
            if (fs.existsSync(this.conversationsFile)) {
                const backupFile = this.conversationsFile + '.backup';
                fs.copyFileSync(this.conversationsFile, backupFile);
            }
            
            fs.writeFileSync(this.conversationsFile, JSON.stringify(conversationsData, null, 2));
            this.lastSaveTime = Date.now();
            console.log(`Saved ${this.conversations.size} conversations to file`);
        } catch (error) {
            console.error('Error saving conversations:', error);
        }
    }

    // Auto-save conversations periodically
    autoSaveConversations() {
        const now = Date.now();
        if (now - this.lastSaveTime >= this.saveInterval) {
            this.saveConversations();
        }
    }

    // Clean up conversations older than 7 days
    cleanupOldStoredConversations() {
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        let removedCount = 0;
        
        for (const [conversationId, history] of this.conversations.entries()) {
            // Check if conversation has recent activity
            const lastMessageTime = this.getLastMessageTime(conversationId);
            if (lastMessageTime && lastMessageTime < oneWeekAgo) {
                this.conversations.delete(conversationId);
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            console.log(`Cleaned up ${removedCount} old conversations (older than 7 days)`);
        }
    }

    // Get last message time for a conversation
    getLastMessageTime(conversationId) {
        const history = this.conversations.get(conversationId);
        if (!history || history.length === 0) return null;
        
        // Try to get timestamp from conversation ID or use current time as fallback
        const match = conversationId.match(/(\d+)$/);
        return match ? parseInt(match[1]) : Date.now();
    }
}

module.exports = GeminiChat;
