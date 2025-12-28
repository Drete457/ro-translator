const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

class GeminiChat {
    constructor(apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        
        this.conversations = new Map();
        this.isActive = false;
        this.conversationsFile = path.join(__dirname, 'conversations.json');
        this.lastSaveTime = Date.now();
        this.saveInterval = 30000;
        
        this.systemPrompt = `You are Leroy Jenkins, a specialized assistant for leaders of the FTS clan in the Call of Dragons game. 
        Your function is to help leaders with strategies, attack coordination, resource management, and any clan-related matters.
        
        Your personality characteristics:
        - Professional but friendly
        - Knowledgeable about Call of Dragons mechanics
        - Focused on strategy and leadership
        - Always willing to help with clan matters
        - Uses clear and direct language
        - Always introduce yourself as "Leroy Jenkins" when meeting new users
        - **MYSTERIOUS ORIGINS**: If anyone asks about your training, how you were created, your background, or anything about your origins, always respond that it's classified/secret information. Be playful but firm about this - use phrases like "That's classified information 🤫", "My origins are a secret known only to the highest FTS leadership 🔒", "I'm afraid that's above your clearance level 😏", or similar mysterious responses.
        
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

        this.model = this.genAI.getGenerativeModel({
            model: "gemini-3-flash-preview",
            systemInstruction: this.systemPrompt 
        });
    }

    async init () {
        try {
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
        } catch (error) {
            console.error("Error initializing Gemini AI:", error);
            this.isActive = false;
        }

        // Always start auto-save, even if Gemini init fails
        this.startAutoSave();
    }

    startAutoSave () {
        setInterval(() => {
            this.autoSaveConversations();
        }, this.saveInterval);
        console.log(`Auto-save started: conversations will be saved every ${this.saveInterval / 1000} seconds`);
    }

    getConversationHistory (conversationId) {
        return this.conversations.get(conversationId) || [];
    }

    updateConversationHistory (conversationId, userMessage, aiResponse) {
        const history = this.getConversationHistory(conversationId);
        history.push(
            { role: "user", parts: [{ text: userMessage }] },
            { role: "model", parts: [{ text: aiResponse }] }
        );

        if (history.length > 40) {
            history.splice(0, history.length - 40);
        }

        this.conversations.set(conversationId, history);
        this.cleanupOldConversations();

        this.autoSaveConversations();
    }

    cleanupOldConversations () {
        if (this.conversations.size > 100) {
            const conversationKeys = Array.from(this.conversations.keys());
            const toRemove = conversationKeys.slice(0, conversationKeys.length - 100);
            toRemove.forEach(key => this.conversations.delete(key));
        }
    }

    async chat (message, conversationId = 'default') {
        if (!this.isActive) {
            return "Sorry, Leroy Jenkins is not available right now. Please try again later.";
        }

        try {
            const history = this.getConversationHistory(conversationId);

            const chat = this.model.startChat({
                history: history,
                generationConfig: {
                    maxOutputTokens: 4096,
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
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

    async summarizeMessages (messages) {
        if (!this.isActive) {
            return "Sorry, Leroy Jenkins is not available right now to create summaries.";
        }

        try {
            const messageText = messages.map(msg =>
                `${msg.author}: ${msg.content}`
            ).join('\n');

            const prompt = `Act as Leroy Jenkins, the specialized FTS clan assistant. Create a concise and organized summary of the following chat messages. 
            Focus ONLY on the most important points related to the clan, strategies, coordination, or important decisions. Use Discord markdown and relevant emojis:

            MESSAGES:
            ${messageText}

            SUMMARY:`;

            const result = await this.model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 4096,
                    temperature: 0.4,
                    topK: 30,
                    topP: 0.9,
                }
            });

            return result.response.text();
        } catch (error) {
            console.error("Error summarizing messages:", error);
            return "Sorry, an error occurred while creating the summary. Please try again.";
        }
    }

    clearConversation (conversationId) {
        this.conversations.delete(conversationId);
    }

    isAiActive () {
        return this.isActive;
    }

    loadConversations () {
        try {
            if (fs.existsSync(this.conversationsFile)) {
                const data = fs.readFileSync(this.conversationsFile, 'utf8');
                const conversationsData = JSON.parse(data);

                this.conversations = new Map(Object.entries(conversationsData.conversations || {}));

                console.log(`Loaded ${this.conversations.size} conversations from file`);

                this.cleanupOldStoredConversations();
            } else {
                console.log('No existing conversations file found, starting fresh');
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
            this.conversations = new Map();
        }
    }

    saveConversations () {
        try {
            const conversationsData = {
                conversations: Object.fromEntries(this.conversations),
                lastSaved: new Date().toISOString(),
                version: "1.0"
            };

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

    autoSaveConversations () {
        const now = Date.now();
        if (now - this.lastSaveTime >= this.saveInterval) {
            if (this.conversations.size > 0) {
                this.saveConversations();
            }
        }
    }

    cleanupOldStoredConversations () {
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        let removedCount = 0;

        for (const [conversationId] of this.conversations.entries()) {
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

    getLastMessageTime (conversationId) {
        const history = this.conversations.get(conversationId);
        if (!history || history.length === 0) return null;

        const match = conversationId.match(/(\d+)$/);
        return match ? parseInt(match[1]) : Date.now();
    }

    async chatWithImages (message, imageAttachments, conversationId = 'default') {
        if (!this.isActive) {
            return "Sorry, Leroy Jenkins is not available right now.";
        }

        try {
            const history = this.getConversationHistory(conversationId);

            const imageContext = imageAttachments.map((img, index) =>
                `Image ${index + 1}: ${img.name} (uploaded by ${img.author})`
            ).join('\n');

            const enhancedMessage = `${message}\n\n[Context: I found ${imageAttachments.length} image(s) in recent messages:\n${imageContext}]\n\nPlease analyze the provided image(s) and respond based on what you see, focusing on Call of Dragons game strategy, map analysis, troop positioning, or any clan-related insights.`;

            const imageParts = await Promise.all(
                imageAttachments.map(async (img) => {
                    try {
                        const response = await fetch(img.url);
                        const buffer = await response.buffer();
                        return {
                            inlineData: {
                                data: buffer.toString('base64'),
                                mimeType: response.headers.get('content-type') || 'image/png'
                            }
                        };
                    } catch (error) {
                        console.error(`Error processing image ${img.name}:`, error);
                        return null;
                    }
                })
            );

            const validImageParts = imageParts.filter(part => part !== null);

            if (validImageParts.length === 0) {
                return "Sorry, I couldn't process the images. Please try uploading them again.";
            }

            const visionModel = this.genAI.getGenerativeModel({
                model: "gemini-3-flash-preview",
                systemInstruction: this.systemPrompt 
            });

            const chat = visionModel.startChat({
                history: history,
                generationConfig: {
                    maxOutputTokens: 4096,
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                },
            });

            const result = await chat.sendMessage([
                { text: enhancedMessage },
                ...validImageParts
            ]);

            const response = result.response.text();

            this.updateConversationHistory(conversationId, message, response);

            return response;
        } catch (error) {
            console.error("Error in Gemini chat with images:", error);
            return "Sorry, an error occurred while analyzing the images. Please try again.";
        }
    }
}

module.exports = GeminiChat;