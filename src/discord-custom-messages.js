const richMessage = (userName, errorMessage) => ({
    content: `Hello @${userName}! **Opening the game on your cell phone and taking a print-screen!. The game need to be in English!!** and then send the print-screen here in the chat. \nError: ${errorMessage}`,
    embeds: [
        {
            title: 'Explanation',
            description: 'Here is image example of how the profile should be posted:',
            image: {
                url: 'https://cdn.discordapp.com/attachments/1154116444662005913/1165356670340321390/Screenshot_2023-10-21-13-18-28-549_com.farlightgames.samo.gp2.jpg?ex=65468df9&is=653418f9&hm=95f2b95724f71ed59ec3b9f304380151bd3c1018d74775782fb262deabfc43e3&',
            },
        },
    ],
}
)

module.exports = { richMessage };