const fetch = require('node-fetch');

// ==================== ALLIANCE CHAT ENTERTAINMENT ====================

// Static content for Call of Dragons and gaming
const staticContent = [
    // Call of Dragons Facts & Tips
    { type: 'tip', content: '💡 **Pro Tip:** Always scout before attacking! Knowledge is power in Call of Dragons. 🐉' },
    { type: 'tip', content: '💡 **Pro Tip:** Save your speedups for important events like KvK or Heroic Race!' },
    { type: 'tip', content: '💡 **Pro Tip:** Join rallies even if you\'re small - every troop counts and you get rewards! 🏰' },
    { type: 'tip', content: '💡 **Pro Tip:** Don\'t forget to collect your free daily gems from the tavern! 💎' },
    { type: 'tip', content: '💡 **Pro Tip:** Upgrade your watchtower first - information about incoming attacks is crucial! 👀' },
    { type: 'tip', content: '💡 **Pro Tip:** Always keep your hospital capacity higher than your march size! 🏥' },
    { type: 'tip', content: '💡 **Pro Tip:** Focus on one troop type early game for maximum efficiency! ⚔️' },
    { type: 'tip', content: '💡 **Pro Tip:** Resource nodes near your alliance territory give bonus gathering speed! 🌾' },
    { type: 'tip', content: '💡 **Pro Tip:** Coordinate with your alliance for garrison defense - teamwork makes the dream work! 🤝' },
    { type: 'tip', content: '💡 **Pro Tip:** Check the Events tab daily - free rewards are waiting for you! 🎁' },
    { type: 'tip', content: '💡 **Pro Tip:** Use your alliance shop points wisely - teleports and speedups are the best value!' },
    { type: 'tip', content: '💡 **Pro Tip:** Don\'t neglect your pet system - those buffs add up significantly! 🐾' },
    { type: 'tip', content: '💡 **Pro Tip:** Keep your troops training 24/7 - consistency builds armies! 🪖' },
    { type: 'tip', content: '💡 **Pro Tip:** Always use a shield when you\'re offline with troops at home! 🛡️' },
    { type: 'tip', content: '💡 **Pro Tip:** Artifacts can change the tide of battle - don\'t ignore them! ✨' },
    
    // Gaming Memes (text-based)
    { type: 'meme', content: '😂 When you finally get a legendary hero after 100 summons... and it\'s a duplicate. 💀' },
    { type: 'meme', content: '😂 Me: "I\'ll just do one more rally before bed"\n*3 hours later*\n☀️🌅' },
    { type: 'meme', content: '😂 Alliance chat at 3 AM: "Anyone online?"\nThe whole alliance: 👀' },
    { type: 'meme', content: '😂 When someone attacks your farm account thinking it\'s your main... 🎣' },
    { type: 'meme', content: '😂 My sleep schedule: 💀\nMy power in CoD: 📈\nWorth it? Absolutely.' },
    { type: 'meme', content: '😂 "I\'m F2P"\n*proceeds to buy the $0.99 pack*\n"Still counts as F2P" 🤡' },
    { type: 'meme', content: '😂 When you set a 5 AM alarm for SvS reset... Gaming dedication level: 💯' },
    { type: 'meme', content: '😂 Recruiter: "Do you have leadership experience?"\nMe: "I lead a 100-player alliance in CoD"\nRecruiter: 🤔' },
    { type: 'meme', content: '😂 When you accidentally send your main march to gather instead of attack... 🚶‍♂️🌾' },
    { type: 'meme', content: '😂 My bank account before CoD: 💰\nMy bank account after CoD: 🪙' },
    { type: 'meme', content: '😂 When the rally timer hits 0 and you realize you forgot to join... 🤦' },
    { type: 'meme', content: '😂 "Just one more upgrade" - Famous last words before spending all your gems 💎➡️💨' },
    { type: 'meme', content: '😂 When you see a zeroed city next to yours... "I suddenly don\'t need to gather anymore" 👀' },
    { type: 'meme', content: '😂 Alliance leader: "We need to be more active"\nAlso alliance leader: *offline for 3 days* 🙃' },
    { type: 'meme', content: '😂 When your farm has better luck with summons than your main... RNG is personal 🎲' },
    
    // Call of Dragons Fun Facts
    { type: 'fact', content: '🐉 **Did you know?** Call of Dragons has over 50 unique heroes to collect and upgrade!' },
    { type: 'fact', content: '🐉 **Did you know?** The behemoths in CoD are based on mythological creatures from various cultures!' },
    { type: 'fact', content: '🐉 **Did you know?** Flying units can bypass walls - use them strategically! 🦅' },
    { type: 'fact', content: '🐉 **Did you know?** The game world map is procedurally generated for each new server!' },
    { type: 'fact', content: '🐉 **Did you know?** Lilith Games, the developer of CoD, also made Rise of Kingdoms! 🎮' },
    { type: 'fact', content: '🐉 **Did you know?** The three factions (League of Order, Wilderburg, Springwardens) each have unique architectural styles!' },
    { type: 'fact', content: '🐉 **Did you know?** Magic units deal extra damage to flying units! Rock-paper-scissors in action! ✨' },
    { type: 'fact', content: '🐉 **Did you know?** You can have multiple marches gathering at the same time to maximize efficiency!' },
    { type: 'fact', content: '🐉 **Did you know?** Alliance territory provides buffs to all members inside it!' },
    { type: 'fact', content: '🐉 **Did you know?** The game has over 20 million downloads worldwide! 🌍' },
    
    // Motivational Gaming Quotes
    { type: 'quote', content: '🎮 "In the world of gaming, the real treasure is the friends we make along the way." - Every Alliance Ever 💜' },
    { type: 'quote', content: '🎮 "Victory requires strategy, but glory requires teamwork!" 🏆' },
    { type: 'quote', content: '🎮 "A true gamer doesn\'t give up, they just respawn and try again!" 💪' },
    { type: 'quote', content: '🎮 "The best alliances aren\'t built on power alone, but on trust and friendship." 🤝' },
    { type: 'quote', content: '🎮 "May your summons be legendary and your rallies victorious!" ✨' },
    { type: 'quote', content: '🎮 "Every expert was once a beginner. Keep grinding!" 📈' },
    { type: 'quote', content: '🎮 "The only impossible journey is the one you never begin." - Tony Robbins 🚀' },
    { type: 'quote', content: '🎮 "Strength doesn\'t come from winning. It comes from struggles and hardship." 💪' },
    { type: 'quote', content: '🎮 "United we stand, divided we fall. That\'s alliance life!" ⚔️' },
    { type: 'quote', content: '🎮 "The battlefield is a scene of constant chaos. The winner will be the one who controls that chaos." 🎯' },
    
    // Interactive Questions
    { type: 'question', content: '🤔 **Question of the day:** What\'s your favorite hero in Call of Dragons and why? Drop your answer below! 👇' },
    { type: 'question', content: '🤔 **Question of the day:** Infantry, Cavalry, or Ranged - which is your main troop type? 🏹🐴⚔️' },
    { type: 'question', content: '🤔 **Question of the day:** What\'s the funniest thing that happened to you in CoD? Share your story! 📖' },
    { type: 'question', content: '🤔 **Question of the day:** If you could add any feature to Call of Dragons, what would it be? 💭' },
    { type: 'question', content: '🤔 **Question of the day:** What time zone are you playing from? Let\'s see how global we are! 🌍' },
    { type: 'question', content: '🤔 **Question of the day:** What\'s your most embarrassing gaming moment? We won\'t judge! 😅' },
    { type: 'question', content: '🤔 **Question of the day:** Which behemoth is the most fun to fight? 🐲' },
    { type: 'question', content: '🤔 **Question of the day:** Do you prefer attacking or defending? ⚔️🛡️' },
    { type: 'question', content: '🤔 **Question of the day:** What got you started playing Call of Dragons? 🎮' },
    { type: 'question', content: '🤔 **Question of the day:** Night owl gamer or early bird? When do you usually play? 🦉🐦' },
    
    // Alliance Spirit
    { type: 'spirit', content: '🔥 **FTS CLAN STRONG!** Remember: Together we conquer, divided we fall! Let\'s dominate! 💪❄️' },
    { type: 'spirit', content: '❄️ **FTS runs through our veins!** Who\'s ready for the next battle? React if you\'re online! 🙋' },
    { type: 'spirit', content: '⚔️ **Rally time soon?** Tag your favorite rally leader and let them know you\'re ready! 🏰' },
    { type: 'spirit', content: '🌟 **Shoutout to our active members!** Your dedication makes FTS Clan the best! 🏆' },
    { type: 'spirit', content: '💪 **Reminder:** Help your alliance members with constructions and research! Every bit helps! 🔨' },
    { type: 'spirit', content: '❄️ **FTS never melts under pressure!** Keep pushing, keep growing! 📈' },
    { type: 'spirit', content: '🏆 **Victory is sweeter when shared!** Great job on recent battles, everyone! 🎉' },
    { type: 'spirit', content: '💎 **Quality over quantity!** FTS Clan - small but mighty! 💪' },
    { type: 'spirit', content: '🌐 **From all corners of the world, united under FTS!** That\'s what makes us special! 🤝' },
    { type: 'spirit', content: '⚡ **Energy check!** How\'s everyone doing today? Drop an emoji to show your mood! 😊😴🔥' }
];

// Gaming-related subreddits for memes
const memeSubreddits = [
    'gaming',
    'gamingmemes', 
    'pcgaming',
    'mobilegaming',
    'strategygames',
    'memes',
    'dankmemes',
    'wholesomememes'
];

// Fetch a random meme from Reddit
const fetchRandomMeme = async () => {
    try {
        const subreddit = memeSubreddits[Math.floor(Math.random() * memeSubreddits.length)];
        const response = await fetch(`https://meme-api.com/gimme/${subreddit}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch meme');
        }
        
        const data = await response.json();
        
        // Check if the meme is appropriate (not NSFW)
        if (data.nsfw) {
            return null;
        }
        
        return {
            type: 'reddit_meme',
            title: data.title,
            url: data.url,
            subreddit: data.subreddit,
            postLink: data.postLink
        };
    } catch (error) {
        console.error('Error fetching meme from Reddit:', error);
        return null;
    }
};

// Fetch a random meme from Imgflip
const fetchImgflipMeme = async () => {
    try {
        const response = await fetch('https://api.imgflip.com/get_memes');
        
        if (!response.ok) {
            throw new Error('Failed to fetch from Imgflip');
        }
        
        const data = await response.json();
        
        if (data.success && data.data.memes.length > 0) {
            const randomMeme = data.data.memes[Math.floor(Math.random() * data.data.memes.length)];
            return {
                type: 'imgflip_meme',
                title: randomMeme.name,
                url: randomMeme.url
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching meme from Imgflip:', error);
        return null;
    }
};

// Main function to get content for alliance chat
const getAllianceChatContent = async () => {
    // 40% chance to try fetching a meme from the internet
    const shouldFetchMeme = Math.random() < 0.4;
    
    if (shouldFetchMeme) {
        // Try Reddit first, then Imgflip as fallback
        let meme = await fetchRandomMeme();
        
        if (!meme) {
            meme = await fetchImgflipMeme();
        }
        
        if (meme) {
            return {
                type: meme.type,
                content: meme.title ? `😂 **${meme.title}**` : '😂 **Random Gaming Meme!**',
                imageUrl: meme.url,
                source: meme.subreddit ? `r/${meme.subreddit}` : 'Imgflip'
            };
        }
    }
    
    // Return static content if meme fetch failed or wasn't attempted
    return staticContent[Math.floor(Math.random() * staticContent.length)];
};

// Function to get random interval between 2-3 hours (in milliseconds)
const getRandomInterval = () => {
    const minHours = 10;
    const maxHours = 14;
    const randomHours = minHours + Math.random() * (maxHours - minHours);
    return randomHours * 60 * 60 * 1000; // Convert to milliseconds
};

// Create the entertainment manager
class AllianceEntertainment {
    constructor(client, channelId) {
        this.client = client;
        this.channelId = channelId;
        this.isRunning = false;
    }

    // Send content to the alliance chat
    async sendContent() {
        try {
            const channel = this.client.channels.cache.get(this.channelId);
            if (!channel) {
                console.log('Alliance chat channel not found');
                return;
            }

            const content = await getAllianceChatContent();
            
            // If it's an image meme, send with embed
            if (content.imageUrl) {
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setTitle(content.content.replace('😂 **', '').replace('**', ''))
                    .setImage(content.imageUrl)
                    .setColor(0x7289DA)
                    .setFooter({ text: `Source: ${content.source} | 🎮 Gaming Entertainment` });
                
                await channel.send({ embeds: [embed] });
                console.log(`Alliance chat: Sent image meme from ${content.source}`);
            } else {
                // Send text content
                await channel.send(content.content);
                console.log(`Alliance chat: Sent ${content.type} content`);
            }
        } catch (error) {
            console.error('Error sending alliance chat content:', error);
        }
    }

    // Schedule the next message
    scheduleNext() {
        if (!this.isRunning) return;
        
        const interval = getRandomInterval();
        const nextTime = new Date(Date.now() + interval);
        console.log(`Next alliance chat message scheduled for: ${nextTime.toLocaleString()}`);
        
        setTimeout(async () => {
            await this.sendContent();
            this.scheduleNext();
        }, interval);
    }

    // Start the entertainment system
    start(initialDelay = 1800000) { // Default: 30 minutes
        if (this.isRunning) {
            console.log('Alliance entertainment is already running');
            return;
        }
        
        this.isRunning = true;
        console.log('Starting Alliance Chat Entertainment system...');
        console.log('Alliance chat entertainment scheduled: every 10-14 hours');
        
        // Send first message after initial delay
        setTimeout(async () => {
            console.log('Sending first alliance chat content...');
            await this.sendContent();
            this.scheduleNext();
        }, initialDelay);
    }

    // Stop the entertainment system
    stop() {
        this.isRunning = false;
        console.log('Alliance entertainment system stopped');
    }

    // Manually trigger a message (useful for testing)
    async triggerNow() {
        await this.sendContent();
    }
}

module.exports = {
    AllianceEntertainment,
    getAllianceChatContent,
    fetchRandomMeme,
    staticContent
};
